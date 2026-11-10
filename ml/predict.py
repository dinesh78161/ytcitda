"""Run an oral research checkpoint on a local photograph without storing the image."""
import argparse
import json
from pathlib import Path

import torch
from PIL import Image
from model import load_checkpoint, predict_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("image", type=Path)
    args = parser.parse_args()
    torch.set_num_threads(4)
    model, checkpoint = load_checkpoint(args.checkpoint)
    with Image.open(args.image) as image:
        result = predict_image(model, checkpoint, image)
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
