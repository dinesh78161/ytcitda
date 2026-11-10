# Bundled oral-image classifier

This package contains the actual MobileNetV3-Small checkpoint exported to ONNX
for CPU inference inside the Node server. It requires no Gemini API or external
model account. `model.json` pins its hash, class order, temperature and preprocessing.

Training used 199 eligible original images, validation 43, and test 43 from the
Mendeley Oral Images Dataset V2. The held-out Python result was 39/43 correct;
patient identifiers were unavailable and this is exploratory image-level evidence.
No clinical accuracy claim is made. It cannot establish healthy-mouth screening,
all oral diseases, non-oral rejection, histology, prognosis or treatment.

Export verification compared the Node implementation with Python on 43 paired
JPEG inputs: all 43 class labels agreed; mean absolute class-score difference
was 0.00683 and maximum 0.04363. Decoding/preprocessing can change scores. These
figures measure implementation parity, not medical validation.

Dataset attribution: Chandrashekar H S, Geetha Kiran A, Murali S, Dinesh M S,
Nanditha B R (2021), Oral Images Dataset, Version 2,
doi:10.17632/mhjyrn35p4.2. [Source](https://data.mendeley.com/datasets/mhjyrn35p4/2).
Dataset license: CC BY 4.0. No original photographs are redistributed in this package.
The model uses torchvision MobileNetV3-Small with ImageNet initialization.
