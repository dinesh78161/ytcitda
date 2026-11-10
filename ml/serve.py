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
from model import load_checkpoint, predict_image


def create_server(checkpoint_path, key, port=8090):
    if len(key) < 24:
        raise ValueError("Set SCREENING_MODEL_KEY to a private random key of at least 24 characters.")
    torch.set_num_threads(4)
    model, checkpoint = load_checkpoint(checkpoint_path)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(30)

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
                if not isinstance(payload, dict):
                    raise ValueError("Expected a JSON object.")
                if payload.get("model_version") != checkpoint["model_version"] or payload.get("mime_type") != "image/jpeg":
                    raise ValueError("Unexpected model version or image format.")
                raw = base64.b64decode(payload["image_base64"], validate=True)
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format != "JPEG" or min(image.size) < 256 or image.width * image.height > 4_000_000:
                        raise ValueError("Invalid JPEG dimensions or format.")
                    result = predict_image(model, checkpoint, image)
                self.respond(200, result)
            except (ValueError, KeyError, TypeError, OSError):
                self.respond(400, {"error": "Invalid inference request or undecodable image."})
            except Exception:
                self.respond(500, {"error": "Inference failed; no result was produced."})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    server = create_server(args.checkpoint, os.environ.get("SCREENING_MODEL_KEY", ""), args.port)
    server.timeout = 30
    print(f"Research model listening on http://127.0.0.1:{args.port}/infer", flush=True)
    print("Use an authenticated HTTPS reverse proxy to connect the care API. This server does not store uploads.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
