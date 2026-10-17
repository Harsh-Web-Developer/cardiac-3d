# CARDIA Hemodynamic Twin | Clinical Cockpit

High-fidelity in-silico cardiovascular digital twin rewritten as a modern React + TypeScript application with Vite and Three.js.

## Overview

CARDIA provides real-time, interactive exploration of human cardiovascular hemodynamics based on Guyton-Coleman physiological principles:
- **0D/1D Hemodynamic Engine**: Real-time simulation of Frank-Starling mechanics, Windkessel arterial compliance, stroke volume, ejection fraction, EDP, valve timings, ventricular pressures, and myocardial oxygen demand ($MVO_2$).
- **Interactive 3D Cardiac Viewport**: Three.js WebGL viewport with 360° orbit controls, realistic matte myocardial muscle tissue, animated cardiac cycle contractions, and a dense dual-color blood flow particle system (720+ particles) separating oxygenated (red) and deoxygenated (blue) flow.
- **Anatomical 3D Annotations**: Live labels and tag cards attached to anatomical cardiac structures (LV, RV, LA, RA, Mitral, Aortic, Aorta, Pulmonary Artery) displaying real-time chamber metrics.
- **Telemetry Waveforms**: Synchronous 60Hz real-time Lead II ECG strip with animated sweep line, LV Pressure-Volume (PV) Loop with dynamic traveling phase marker, and Aortic Pressure & Flow Velocity waveforms.
- **ML Parameter Inference**: Inverse neural latent estimation of hidden physiological parameters (blood volume, contractility, SVR) from observable vitals.
- **AI Physiology Copilot ("Ask Why")**: Grounded clinical explanations with physiological citations and mechanistic steps.
- **Fork Experiment Comparison**: Side-by-side comparison of baseline trajectory against shock / perturbation states with one-click cockpit deployment.

## Getting Started

```bash
npm install
npm run dev
```

The application runs on port 3000 at `http://localhost:3000`.