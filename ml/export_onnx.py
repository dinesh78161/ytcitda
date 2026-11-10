"""Export a trusted research checkpoint for CPU inference in the Node backend."""
import argparse
import hashlib
import json
from pathlib import Path

import onnx
import torch
from model import load_checkpoint


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("Choose a new model output directory.")
    torch.set_num_threads(2)
    model, checkpoint = load_checkpoint(args.checkpoint)
    args.output.mkdir(parents=True)
    target = args.output / "model.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, 224, 224), target,
                      input_names=["images"], output_names=["logits"],
                      opset_version=18, dynamo=False, external_data=False)
    onnx.checker.check_model(str(target))
    metadata = {key: checkpoint[key] for key in ["architecture", "classes", "model_version", "temperature", "clinical_use", "evaluation_unit", "limitations"]}
    metadata.update({"format": "onnx", "input": "images", "output": "logits", "input_shape": [1, 3, 224, 224],
                     "preprocessing": "pil-bilinear-256-center-crop-224-imagenet-v1",
                     "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                     "source_checkpoint_sha256": hashlib.sha256(args.checkpoint.read_bytes()).hexdigest(),
                     "dataset_source": "https://data.mendeley.com/datasets/mhjyrn35p4/2",
                     "dataset_license": "CC BY 4.0",
                     "dataset_attribution": "Chandrashekar H S, Geetha Kiran A, Murali S, Dinesh M S, Nanditha B R (2021), Oral Images Dataset, Version 2, doi:10.17632/mhjyrn35p4.2"})
    (args.output / "model.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"model_version": metadata["model_version"], "sha256": metadata["sha256"], "bytes": target.stat().st_size}))


if __name__ == "__main__":
    main()
