# CARDIA ML

CARDIA ML estimates hidden physiological parameters from observable
cardiovascular measurements.

## Current ML Pipeline

```text
Random physiological parameters
            ↓
Temporary mock simulator
            ↓
10,000+ virtual patients
            ↓
Training dataset
            ↓
PyTorch MLP
            ↓
Hidden physiological state