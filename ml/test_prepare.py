"""Dataset-integrity checks using generated non-medical image fixtures."""
import csv
import random
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from prepare import FIELDS, audit_manifest, manifest_split_unit, split_images, split_patients, verify_splits


class DatasetChecks(unittest.TestCase):
    def test_exploratory_split_is_stratified_and_never_fabricates_patients(self):
        rows = [{"patient_id": "", "label": "a" if i % 2 else "b", "pixel_sha256": str(i)} for i in range(30)]
        split = split_images(rows)
        verify_splits(split, "image")
        self.assertEqual(manifest_split_unit(split), "image")
        self.assertEqual(split, split_images(list(reversed(rows))))
        self.assertTrue(all(r["patient_id"] == "" for r in split))
        with self.assertRaises(ValueError):
            verify_splits(split)
        split[0]["split_unit"] = "patient"
        with self.assertRaises(ValueError):
            manifest_split_unit(split)

    def test_known_patients_cannot_use_exploratory_image_split(self):
        with self.assertRaisesRegex(ValueError, "Patient IDs"):
            split_images([{"patient_id": "known", "label": "a", "pixel_sha256": "1"}])

    def test_exploratory_split_rejects_pixel_leakage(self):
        rows = split_images([{"patient_id": "", "label": "a" if i % 2 else "b", "pixel_sha256": str(i)} for i in range(30)])
        other = next(r for r in rows if r["split"] != rows[0]["split"])
        other["pixel_sha256"] = rows[0]["pixel_sha256"]
        with self.assertRaisesRegex(ValueError, "leakage"):
            verify_splits(rows, "image")

    def test_patient_groups_and_split_reproducibility(self):
        rows = [{"patient_id": f"subject-{i}", "label": "benign_lesion" if i % 2 else "malignant_lesion", "pixel_sha256": str(i)} for i in range(30)]
        split = split_patients(rows)
        verify_splits(split)
        self.assertEqual(split, split_patients(rows))
        self.assertEqual(len({r["patient_id"] for r in split}), 30)

    def test_same_patient_or_pixels_cannot_cross_splits(self):
        rows = split_patients([{"patient_id": f"p-{i}", "label": "a" if i % 2 else "b", "pixel_sha256": str(i)} for i in range(30)])
        different = next(i for i in range(1, len(rows)) if rows[i]["split"] != rows[0]["split"])
        for key in ["patient_id", "pixel_sha256"]:
            bad = [r.copy() for r in rows]
            bad[different][key] = bad[0][key]
            with self.assertRaisesRegex(ValueError, "leakage"):
                verify_splits(bad)

    def test_audit_rejects_duplicate_photos_even_with_different_filenames(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(Path(__file__).resolve().parent))
            root = Path(directory)
            image = Image.new("RGB", (256, 256), "#888888")
            image.save(root / "a.png"); image.save(root / "b.png")
            manifest = root / "manifest.csv"
            with manifest.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=FIELDS); writer.writeheader()
                for name in ["a", "b"]:
                    writer.writerow(dict(zip(FIELDS, [f"{name}.png", f"subject-{name}", name, "clinician_review", "synthetic-fixture", "test-only"])))
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                audit_manifest(manifest)

    def test_end_to_end_audit_of_original_fixtures(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(Path(__file__).resolve().parent))
            root = Path(directory); manifest = root / "manifest.csv"
            with manifest.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=FIELDS); writer.writeheader()
                for i in range(20):
                    rng = random.Random(i)
                    Image.frombytes("RGB", (256, 256), rng.randbytes(256 * 256 * 3)).save(root / f"{i}.png")
                    writer.writerow(dict(zip(FIELDS, [f"{i}.png", f"subject-{i}", "a" if i % 2 else "b", "synthetic_label", "test-only", "test-only"])))
            rows = audit_manifest(manifest)
            self.assertTrue(all(Path(r["image_path"]).is_absolute() for r in rows))
            verify_splits(split_patients(rows))


if __name__ == "__main__":
    unittest.main()
