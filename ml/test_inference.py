"""Checkpoint and HTTP contract checks using an untrained synthetic model."""
import base64
import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import torch
from PIL import Image
from model import build_model, load_checkpoint, predict_image
from serve import create_server


class InferenceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.directory = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        cls.path = Path(cls.directory.name) / "fixture.pt"
        cls.checkpoint = {"architecture": "mobilenet_v3_small", "classes": ["benign_lesion", "malignant_lesion"], "model_version": "synthetic-test", "clinical_use": False, "evaluation_unit": "image", "temperature": 1.0, "state_dict": build_model(["a", "b"]).state_dict()}
        torch.save(cls.checkpoint, cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_saved_checkpoint_and_local_prediction(self):
        model, checkpoint = load_checkpoint(self.path)
        result = predict_image(model, checkpoint, Image.new("RGB", (256, 256)))
        self.assertEqual(result["model_version"], "synthetic-test")
        self.assertEqual(result["evaluation_unit"], "image")
        self.assertFalse(result["clinical_use"])
        self.assertAlmostEqual(sum(result["class_scores"].values()), 1.0, places=6)
        self.assertAlmostEqual(result["score"], result["class_scores"][result["label"]])
        with self.assertRaises(ValueError):
            predict_image(model, checkpoint, Image.new("RGB", (100, 100)))

    def test_invalid_temperature_is_rejected(self):
        path = Path(self.directory.name) / "invalid.pt"
        torch.save({**self.checkpoint, "temperature": float("nan")}, path)
        with self.assertRaisesRegex(ValueError, "temperature"):
            load_checkpoint(path)

    def test_authenticated_http_contract_and_failure_cases(self):
        key = "synthetic-test-key-at-least-24-characters"
        server = create_server(self.path, key, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        buffer = io.BytesIO()
        Image.new("RGB", (256, 256)).save(buffer, format="JPEG")
        payload = {"model_version": "synthetic-test", "mime_type": "image/jpeg", "image_base64": base64.b64encode(buffer.getvalue()).decode()}

        def request(body, token=key):
            req = Request(f"http://127.0.0.1:{server.server_port}/infer", data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            return urlopen(req, timeout=20)

        try:
            with request(payload) as response:
                result = json.load(response)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(result["evaluation_unit"], "image")
            self.assertFalse(result["clinical_use"])
            for body, token, status in [(payload, "incorrect", 401), ({**payload, "model_version": "wrong"}, key, 400), ({**payload, "image_base64": "invalid"}, key, 400), ([], key, 400)]:
                with self.assertRaises(HTTPError) as error:
                    request(body, token)
                self.assertEqual(error.exception.code, status)
                error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
