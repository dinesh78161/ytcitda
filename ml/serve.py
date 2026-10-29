"""Private research inference adapter. Put behind HTTPS before connecting the app."""
import argparse
import base64
import hmac
import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch
from PIL import Image
from model import image_transform, load_checkpoint, normalized_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    key = os.environ.get("SCREENING_MODEL_KEY", "")
    if len(key) < 24:
        raise ValueError("Set SCREENING_MODEL_KEY to a private random key of at least 24 characters.")
    model, checkpoint = load_checkpoint(args.checkpoint)
    transform = image_transform()
    temperature = float(checkpoint.get("temperature", 1.0))
    if not 0.05 <= temperature <= 20:
        raise ValueError("Invalid checkpoint temperature.")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Do not log request contents or image data.

        def respond(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != "/infer":
                self.respond(404, {"error": "Not found"}); return
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + key):
                self.respond(401, {"error": "Unauthorized"}); return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 14_000_000:
                    raise ValueError("Invalid request length.")
                payload = json.loads(self.rfile.read(length))
                if payload.get("model_version") != checkpoint["model_version"] or payload.get("mime_type") != "image/jpeg":
                    raise ValueError("Unexpected model version or image format.")
                raw = base64.b64decode(payload["image_base64"], validate=True)
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format != "JPEG" or min(image.size) < 256 or image.width * image.height > 4_000_000:
                        raise ValueError("Invalid JPEG dimensions or format.")
                    tensor = transform(normalized_image(image)).unsqueeze(0)
                with torch.inference_mode():
                    probabilities = (model(tensor) / temperature).softmax(dim=1)[0]
                    index = int(probabilities.argmax())
                self.respond(200, {"model_version": checkpoint["model_version"], "label": checkpoint["classes"][index], "score": float(probabilities[index])})
            except (ValueError, KeyError, TypeError, OSError):
                self.respond(400, {"error": "Invalid inference request or undecodable image."})
            except Exception:
                self.respond(500, {"error": "Inference failed; no result was produced."})

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.timeout = 30
    print(f"Research model {checkpoint['model_version']} listening on http://127.0.0.1:{args.port}/infer")
    print("Use an authenticated HTTPS reverse proxy to connect the care API. This server does not store uploads.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
