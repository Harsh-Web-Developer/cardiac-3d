import torch

from ml.models.mlp import CardiaMLP


def test_model_input_output_shape():

    model = CardiaMLP()

    inputs = torch.randn(8, 5)

    outputs = model(inputs)

    assert outputs.shape == (8, 3)