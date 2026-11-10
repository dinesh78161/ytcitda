"""Audit original photos and split patients before performing any augmentation."""
import argparse
import csv
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path

FIELDS = ["image_path", "patient_id", "label", "label_basis", "source", "license"]
SPLITS = ("train", "validation", "test")
SPLIT_FIELDS = FIELDS + ["image_sha256", "pixel_sha256", "split", "split_unit"]


def audit_manifest(manifest, split_unit="patient"):
    from PIL import Image, ImageOps

    if split_unit not in {"patient", "image"}:
        raise ValueError("Split unit must be patient or image.")
    manifest = Path(manifest).resolve()
    with manifest.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not set(FIELDS).issubset(reader.fieldnames or []):
            raise ValueError("Manifest must contain: " + ", ".join(FIELDS))
        rows = list(reader)
    if not rows:
        raise ValueError("The manifest is empty.")
    fingerprints = set()
    for row in rows:
        required = [k for k in FIELDS if k != "patient_id" or split_unit == "patient"]
        if any(not str(row.get(k) or "").strip() for k in required):
            raise ValueError("Every original image needs a subject, verified label, source, and license.")
        for key in FIELDS:
            row[key] = str(row.get(key) or "").strip()
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,79}", row["label"]):
            raise ValueError("Use lowercase machine-readable labels, such as benign_lesion.")
        if split_unit == "patient" and row["patient_id"].lower() in {"unknown", "n/a", "none"}:
            raise ValueError("Patient grouping is required; do not invent one subject per photo.")
        path = (manifest.parent / row["image_path"]).resolve()
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise ValueError("Only original colour photographs are supported.")
        with Image.open(path) as image:
            if min(image.size) < 256 or image.width * image.height > 40_000_000:
                raise ValueError("Images must be at least 256 by 256 and below 40 megapixels.")
            if getattr(image, "n_frames", 1) != 1:
                raise ValueError("Use a single photograph, not an animation.")
            normalized = ImageOps.exif_transpose(image).convert("RGB")
            fingerprint = hashlib.sha256(str(normalized.size).encode() + normalized.tobytes()).hexdigest()
        if fingerprint in fingerprints:
            raise ValueError("Duplicate decoded photo detected. Remove duplicates before splitting.")
        fingerprints.add(fingerprint)
        row["image_path"] = str(path)
        row["image_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        row["pixel_sha256"] = fingerprint
    if len({row["label"] for row in rows}) < 2:
        raise ValueError("At least two independently labelled classes are required.")
    return rows


def split_images(rows, seed=42):
    """Exploratory stratified split; never claim patient independence."""
    # If grouping is known, use the stronger patient workflow instead.
    if any(row.get("patient_id", "").strip() for row in rows):
        raise ValueError("Patient IDs are present. Use the patient split workflow.")
    assigned = []
    for label in sorted({r["label"] for r in rows}):
        candidates = sorted((r for r in rows if r["label"] == label), key=lambda r: r["pixel_sha256"])
        if len(candidates) < 3:
            raise ValueError("Need at least three original images per class.")
        random.Random(seed).shuffle(candidates)
        n = max(1, round(len(candidates) * 0.15))
        for i, row in enumerate(candidates):
            assigned.append({**row, "split": "test" if i < n else "validation" if i < 2 * n else "train", "split_unit": "image"})
    verify_splits(assigned, "image")
    return assigned


def manifest_split_unit(rows):
    units = {r.get("split_unit") or "patient" for r in rows}
    if len(units) != 1 or not units.issubset({"patient", "image"}):
        raise ValueError("Missing or inconsistent split units.")
    return units.pop()


def split_patients(rows, seed=42):
    groups = sorted({r["patient_id"] for r in rows})
    labels = {r["label"] for r in rows}
    if len(groups) < 6 or any(len({r["patient_id"] for r in rows if r["label"] == label}) < 3 for label in labels):
        raise ValueError("Need at least six patients and at least three patients per class for three disjoint splits.")
    n_validation = max(1, round(len(groups) * 0.15))
    n_test = max(1, round(len(groups) * 0.15))
    for attempt in range(500):
        candidate = groups.copy()
        random.Random(seed + attempt).shuffle(candidate)
        membership = {g: "test" if i < n_test else "validation" if i < n_test + n_validation else "train" for i, g in enumerate(candidate)}
        assigned = [{**r, "split": membership[r["patient_id"]]} for r in rows]
        if all({r["label"] for r in assigned if r["split"] == split} == labels for split in SPLITS):
            return assigned
    raise ValueError("Could not create patient-disjoint splits containing every class. Add patients or provide a reviewed split strategy.")


def verify_splits(rows, split_unit="patient"):
    groups, pixels = {}, {}
    if not rows or any(r.get("split") not in SPLITS for r in rows):
        raise ValueError("Missing or invalid split.")
    for row in rows:
        split = row["split"]
        if (row.get("split_unit") or "patient") != split_unit:
            raise ValueError("Inconsistent split units.")
        if split_unit == "patient" and not row.get("patient_id", "").strip():
            raise ValueError("Patient grouping is required.")
        if split_unit == "image" and row.get("patient_id", "").strip():
            raise ValueError("Patient IDs are present. Use the patient split workflow.")
        keys = [(pixels, row["pixel_sha256"])]
        if split_unit == "patient":
            keys.append((groups, row["patient_id"]))
        for seen, key in keys:
            if key in seen and seen[key] != split:
                raise ValueError("Patient or image leakage across dataset splits.")
            seen[key] = split
    labels = {r["label"] for r in rows}
    if any({r["label"] for r in rows if r["split"] == split} != labels for split in SPLITS):
        raise ValueError("Every split must include each class.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--split-unit", choices=["patient", "image"], default="patient", help="image is exploratory only: patient independence cannot be established")
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("Output already exists. Preserve frozen test splits; choose a new output path deliberately.")
    audited = audit_manifest(args.manifest, args.split_unit)
    rows = split_images(audited, args.seed) if args.split_unit == "image" else split_patients(audited, args.seed)
    rows = [{**r, "split_unit": args.split_unit} for r in rows]
    verify_splits(rows, args.split_unit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SPLIT_FIELDS)
        writer.writeheader()
        writer.writerows({k: r[k] for k in writer.fieldnames} for r in rows)
    report = {s: {"images": sum(r["split"] == s for r in rows), "patients": len({r["patient_id"] for r in rows if r["split"] == s}) if args.split_unit == "patient" else None, "classes": dict(Counter(r["label"] for r in rows if r["split"] == s))} for s in SPLITS}
    report["split_unit"] = args.split_unit
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
