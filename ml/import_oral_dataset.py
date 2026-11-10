"""Import Mendeley Oral Images Dataset originals without inventing patient IDs."""
import argparse
import csv
import hashlib
import json
import os
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps
from prepare import FIELDS

SOURCE = "https://data.mendeley.com/datasets/mhjyrn35p4/2"
ATTRIBUTION = "Chandrashekar H S, Geetha Kiran A, Murali S, Dinesh M S, Nanditha B R (2021), Oral Images Dataset, Version 2, doi:10.17632/mhjyrn35p4.2"
CLASSES = {"benign_lesions": "benign_lesion", "malignant_lesions": "malignant_lesion"}


def import_dataset(dataset, output):
    dataset, output = Path(dataset).resolve(), Path(output).resolve()
    originals = dataset / "original_data"
    if output.exists():
        raise ValueError("Import output already exists. Choose a new versioned directory.")
    if not all((originals / folder).is_dir() for folder in CLASSES):
        raise ValueError("Expected original_data/benign_lesions and original_data/malignant_lesions.")
    rows, excluded, seen = [], [], {}
    input_counts = Counter()
    for folder, label in CLASSES.items():
        for path in sorted((originals / folder).rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(dataset).as_posix()
            input_counts[label] += 1
            reason = None
            try:
                if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                    raise ValueError("unsupported image extension")
                with Image.open(path) as image:
                    if min(image.size) < 256 or image.width * image.height > 40_000_000:
                        raise ValueError("dimensions outside 256-pixel minimum / 40-megapixel maximum")
                    if getattr(image, "n_frames", 1) != 1:
                        raise ValueError("animated image")
                    normalized = ImageOps.exif_transpose(image).convert("RGB")
                    fingerprint = hashlib.sha256(str(normalized.size).encode() + normalized.tobytes()).hexdigest()
                if fingerprint in seen:
                    if seen[fingerprint][1] != label:
                        raise ValueError("duplicate has conflicting class labels; resolve before importing")
                    reason = "duplicate of " + seen[fingerprint][0]
                else:
                    seen[fingerprint] = (relative, label)
            except (OSError, ValueError, Image.DecompressionBombError) as error:
                if "conflicting class" in str(error):
                    raise
                reason = str(error)
            if reason:
                excluded.append({"image": relative, "reason": reason})
                continue
            rows.append(dict(zip(FIELDS, [os.path.relpath(path, output), "", label, "dataset_folder_label_not_independently_verified", SOURCE, "CC BY 4.0"])))
    if any(sum(r["label"] == label for r in rows) < 3 for label in CLASSES.values()):
        raise ValueError("Not enough usable original images in both classes.")
    report = {
        "source": SOURCE, "attribution": ATTRIBUTION, "license": "CC BY 4.0",
        "original_images": dict(input_counts), "included_images": dict(Counter(r["label"] for r in rows)),
        "excluded": excluded, "augmented_data_used": False, "patient_ids_available": False,
        "label_basis": "Dataset folder labels; not independently clinically verified.",
        "limitations": "Exploratory image evaluation only. Patient/source overlap and near-duplicates may inflate results. No external or clinical validation.",
    }
    output.mkdir(parents=True)
    with (output / "manifest.csv").open("x", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    (output / "import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Extracted dataset containing original_data/ and augmented_data/")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = import_dataset(args.dataset, args.output)
    print(json.dumps({key: value for key, value in report.items() if key != "excluded"}, indent=2))
    print(f"Excluded {len(report['excluded'])} files; see import-report.json for reasons.")


if __name__ == "__main__":
    main()
