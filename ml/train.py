"""Fine-tune a research classifier. No claim of clinical performance is made."""
import argparse
import csv
import hashlib
import json
import random
from pathlib import Path

import torch
from PIL import Image
from sklearn.metrics import balanced_accuracy_score, classification_report, confusion_matrix, log_loss, roc_auc_score
from torch.utils.data import DataLoader, Dataset

from model import build_model, image_transform, load_checkpoint, normalized_image
from prepare import audit_manifest, verify_splits


class Photos(Dataset):
    def __init__(self, rows, classes, training=False):
        self.rows, self.classes, self.transform = rows, classes, image_transform(training)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        with Image.open(row["image_path"]) as image:
            tensor = self.transform(normalized_image(image))
        return tensor, self.classes.index(row["label"])


def predictions(model, loader, device):
    model.eval()
    logits, targets = [], []
    with torch.inference_mode():
        for images, labels in loader:
            logits.append(model(images.to(device)).cpu())
            targets.append(labels)
    return torch.cat(logits), torch.cat(targets)


def evaluate(logits, targets, classes):
    probabilities = logits.softmax(dim=1).numpy()
    expected, predicted = targets.numpy(), probabilities.argmax(axis=1)
    matrix = confusion_matrix(expected, predicted, labels=list(range(len(classes))))
    per_class = {}
    for i, label in enumerate(classes):
        tp = int(matrix[i, i]); fn = int(matrix[i].sum() - tp)
        fp = int(matrix[:, i].sum() - tp); tn = int(matrix.sum() - tp - fn - fp)
        per_class[label] = {"sensitivity": tp / (tp + fn) if tp + fn else None, "specificity": tn / (tn + fp) if tn + fp else None, "support": tp + fn}
    auc = roc_auc_score(expected, probabilities[:, 1]) if len(classes) == 2 else roc_auc_score(expected, probabilities, multi_class="ovr", labels=list(range(len(classes))))
    return {"images": len(expected), "balanced_accuracy": balanced_accuracy_score(expected, predicted), "roc_auc": float(auc), "log_loss": float(log_loss(expected, probabilities, labels=list(range(len(classes))))), "confusion_matrix": matrix.tolist(), "per_class": per_class, "classification_report": classification_report(expected, predicted, target_names=classes, labels=list(range(len(classes))), output_dict=True, zero_division=0)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=0.0001)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.output.exists() or not args.version.strip() or not 1 <= len(args.version) <= 120:
        raise ValueError("Choose a new output directory and a nonempty version of at most 120 characters.")
    if args.epochs < 1 or args.batch_size < 2 or args.learning_rate <= 0:
        raise ValueError("Positive epochs/rate and a batch size of at least two are required.")
    torch.manual_seed(args.seed); random.seed(args.seed)
    with args.manifest.open(encoding="utf-8-sig", newline="") as handle:
        saved = list(csv.DictReader(handle))
    # Re-audit files so an edited image cannot silently invalidate frozen splits.
    audited = audit_manifest(args.manifest)
    for old, current in zip(saved, audited):
        if old.get("image_sha256") != current["image_sha256"] or old.get("pixel_sha256") != current["pixel_sha256"]:
            raise ValueError("Dataset changed after splitting. Audit and version it again.")
    verify_splits(audited)
    classes = sorted({r["label"] for r in audited})
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    subsets = {s: [r for r in audited if r["split"] == s] for s in ["train", "validation", "test"]}
    loaders = {s: DataLoader(Photos(rows, classes, s == "train"), batch_size=args.batch_size, shuffle=s == "train", num_workers=0) for s, rows in subsets.items()}
    model = build_model(classes, pretrained=True).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    counts = torch.tensor([sum(r["label"] == c for r in subsets["train"]) for c in classes], dtype=torch.float32, device=device)
    criterion = torch.nn.CrossEntropyLoss(weight=counts.sum() / (len(classes) * counts))
    args.output.mkdir(parents=True)
    checkpoint_path = args.output / "model.pt"
    best, history = float("inf"), []
    for epoch in range(args.epochs):
        model.train()
        for images, labels in loaders["train"]:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images.to(device)), labels.to(device))
            loss.backward(); optimizer.step()
        logits, targets = predictions(model, loaders["validation"], device)
        validation_loss = float(torch.nn.functional.cross_entropy(logits, targets))
        history.append({"epoch": epoch + 1, "validation_loss": validation_loss})
        print(json.dumps(history[-1]))
        if validation_loss < best:
            best = validation_loss
            torch.save({"architecture": "mobilenet_v3_small", "classes": classes, "state_dict": {k: v.cpu() for k, v in model.state_dict().items()}, "model_version": args.version, "clinical_use": False, "temperature": 1.0}, checkpoint_path)
    model, checkpoint = load_checkpoint(checkpoint_path)
    # Fit one temperature on validation data only. Never tune on the test set.
    validation_logits, validation_targets = predictions(model, loaders["validation"], "cpu")
    log_temperature = torch.zeros((), requires_grad=True)
    calibrator = torch.optim.LBFGS([log_temperature], lr=0.1, max_iter=50)
    def closure():
        calibrator.zero_grad()
        loss = torch.nn.functional.cross_entropy(validation_logits / log_temperature.exp().clamp(0.05, 20), validation_targets)
        loss.backward()
        return loss
    calibrator.step(closure)
    temperature = float(log_temperature.detach().exp().clamp(0.05, 20))
    checkpoint["temperature"] = temperature
    torch.save(checkpoint, checkpoint_path)
    test_logits, test_targets = predictions(model, loaders["test"], "cpu")
    report = {"model_version": args.version, "classes": classes, "seed": args.seed, "temperature": temperature, "manifest_sha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(), "test_patients": len({r["patient_id"] for r in subsets["test"]}), "held_out_test": evaluate(test_logits / temperature, test_targets, classes), "history": history, "clinical_use": False, "limitations": "Internal patient-disjoint research evaluation only. No external or prospective validation. Scores are not cancer probabilities. More epochs do not guarantee improvement."}
    (args.output / "evaluation.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print("Saved research checkpoint and held-out evaluation to", args.output)


if __name__ == "__main__":
    main()
