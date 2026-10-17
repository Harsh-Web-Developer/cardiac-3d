"""
PyTorch MLP for CARDIA hidden physiological state estimation.
"""

import torch
import torch.nn as nn


class CardiaMLP(nn.Module):
    """
    Small multilayer perceptron.

    Inputs:
        HR
        SBP
        DBP
        EDV
        ESV

    Outputs:
        Blood Volume
        Contractility
        SVR
    """

    def __init__(
        self,
        input_size=5,
        hidden_size_1=32,
        hidden_size_2=16,
        output_size=3,
    ):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size_1),
            nn.ReLU(),

            nn.Linear(hidden_size_1, hidden_size_2),
            nn.ReLU(),

            nn.Linear(hidden_size_2, output_size),
        )

    def forward(self, x):
        return self.network(x)


if __name__ == "__main__":
    model = CardiaMLP()

    example = torch.randn(1, 5)

    output = model(example)

    print(model)
    print("\nExample output shape:", output.shape)