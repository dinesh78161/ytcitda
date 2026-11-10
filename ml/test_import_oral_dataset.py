"""Importer tests with generated images; no medical performance claims."""
import csv
import random
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from import_oral_dataset import CLASSES, import_dataset
from prepare import audit_manifest


class ImportChecks(unittest.TestCase):
    def test_only_usable_originals_are_imported_with_honest_provenance(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            root = Path(directory)
            for folder in CLASSES:
                dest = root / "dataset" / "original_data" / folder
                dest.mkdir(parents=True)
                for i in range(4):
                    rng = random.Random(folder + str(i))
                    Image.frombytes("RGB", (256, 256), rng.randbytes(256 * 256 * 3)).save(dest / f"{i}.png")
                Image.new("RGB", (100, 100)).save(dest / "small.png")
                (dest / "broken.jpg").write_text("not an image")
                (dest / "duplicate.png").write_bytes((dest / "0.png").read_bytes())
            augmented = root / "dataset" / "augmented_data"
            augmented.mkdir()
            Image.new("RGB", (256, 256)).save(augmented / "do-not-import.png")
            output = root / "import"
            report = import_dataset(root / "dataset", output)
            self.assertEqual(sum(report["included_images"].values()), 8)
            self.assertEqual(len(report["excluded"]), 6)
            self.assertFalse(report["augmented_data_used"])
            with (output / "manifest.csv").open(newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertTrue(all(r["patient_id"] == "" for r in rows))
            self.assertTrue(all("not_independently_verified" in r["label_basis"] for r in rows))
            self.assertEqual(len(audit_manifest(output / "manifest.csv", "image")), 8)
            with self.assertRaises(ValueError):
                audit_manifest(output / "manifest.csv")
            with self.assertRaisesRegex(ValueError, "already exists"):
                import_dataset(root / "dataset", output)

    def test_wrong_dataset_structure_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            with self.assertRaisesRegex(ValueError, "Expected original_data"):
                import_dataset(directory, Path(directory) / "output")


if __name__ == "__main__":
    unittest.main()
