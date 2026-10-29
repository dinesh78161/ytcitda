"""Shared architecture and preprocessing for training and inference."""
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
    model = build_model(checkpoint["classes"])
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, checkpoint


def normalized_image(image):
    return ImageOps.exif_transpose(image).convert("RGB")
