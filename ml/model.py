"""Shared architecture and preprocessing for training and inference."""
import math
import torch
from PIL import ImageOps
from torchvision import models, transforms


def build_model(classes, pretrained=False):
    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)
    model.classifier[-1] = torch.nn.Linear(model.classifier[-1].in_features, len(classes))
    return model


def image_transform(training=False):
    operations = [transforms.Resize((256, 256))]
    if training:
        operations += [transforms.RandomRotation(8), transforms.ColorJitter(brightness=0.1, contrast=0.1)]
    operations += [transforms.CenterCrop(224), transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])]
    return transforms.Compose(operations)


def load_checkpoint(path):
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if checkpoint.get("architecture") != "mobilenet_v3_small" or checkpoint.get("clinical_use") is not False:
        raise ValueError("Unsupported research checkpoint.")
    classes = checkpoint.get("classes")
    if not isinstance(classes, list) or len(classes) < 2 or any(not isinstance(c, str) or not c.strip() for c in classes) or len(set(classes)) != len(classes):
        raise ValueError("Invalid checkpoint classes.")
    if not isinstance(checkpoint.get("model_version"), str) or not checkpoint["model_version"].strip():
        raise ValueError("Missing checkpoint version.")
    if checkpoint.get("evaluation_unit", "patient") not in {"patient", "image"}:
        raise ValueError("Invalid checkpoint evaluation unit.")
    temperature = float(checkpoint.get("temperature", 1.0))
    if not math.isfinite(temperature) or not 0.05 <= temperature <= 20:
        raise ValueError("Invalid checkpoint temperature.")
    model = build_model(checkpoint["classes"])
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, checkpoint


def normalized_image(image):
    return ImageOps.exif_transpose(image).convert("RGB")


def predict_image(model, checkpoint, image):
    if min(image.size) < 256 or image.width * image.height > 40_000_000 or getattr(image, "n_frames", 1) != 1:
        raise ValueError("Use one photograph at least 256 pixels per side and at most 40 megapixels.")
    tensor = image_transform()(normalized_image(image)).unsqueeze(0)
    with torch.inference_mode():
        probabilities = (model(tensor) / float(checkpoint.get("temperature", 1.0))).softmax(dim=1)[0]
    if not torch.isfinite(probabilities).all():
        raise ValueError("Model produced invalid scores.")
    index = int(probabilities.argmax())
    return {
        "model_version": checkpoint["model_version"], "label": checkpoint["classes"][index],
        "score": float(probabilities[index]),
        "class_scores": dict(zip(checkpoint["classes"], [float(p) for p in probabilities])),
        "clinical_use": False, "requires_clinician_review": True,
        "evaluation_unit": checkpoint.get("evaluation_unit", "patient"),
        "limitations": checkpoint.get("limitations", "Research evaluation only. No external or prospective clinical validation."),
        "warning": "NOT FOR CLINICAL USE. Class scores are not individual cancer probabilities.",
    }
