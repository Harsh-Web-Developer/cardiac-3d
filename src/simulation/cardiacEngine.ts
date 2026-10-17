import { HemodynamicKnobs, LiveMetrics } from '../types/cardiac';

export function computeHemodynamics(knobs: HemodynamicKnobs, cyclePhase: number, time_s: number): LiveMetrics {
  const { hr, bloodVolume, contractility, svr } = knobs;
  const isSystole = cyclePhase < 0.35;

  // Preload & Frank-Starling mechanics
  // Baseline nominal blood volume is 5.0 L -> ~128 mL EDV
  const edv = Math.round(115 + (bloodVolume - 5.0) * 22);

  // End-systolic volume governed by contractility and afterload
  // Increased contractility decreases ESV; high SVR increases ESV slightly
  const svrFactor = svr / 1120.0;
  const esv = Math.max(18, Math.round((44 / Math.max(0.35, contractility)) * Math.pow(svrFactor, 0.25)));

  // Stroke volume & ejection fraction
  const sv = Math.max(15, edv - esv);
  const ef = parseFloat(((sv / edv) * 100).toFixed(1));

  // Cardiac Output (L/min)
  const co = parseFloat(((sv * hr) / 1000).toFixed(2));

  // Systemic Pressures:
  // SBP driven by contractility, stroke volume, and arterial stiffness/SVR
  const sbp = Math.round(105 + (contractility - 1.0) * 26 + (svrFactor - 1.0) * 32 + (bloodVolume - 5.0) * 8);
  const dbp = Math.round(72 + (svrFactor - 1.0) * 22 + (bloodVolume - 5.0) * 4);
  const mapVal = parseFloat((dbp + (sbp - dbp) / 3).toFixed(1));

  // Coronary Perfusion Pressure (CPP): DBP minus central venous pressure (~8 mmHg)
  const cvp = Math.max(3, 8.0 + (bloodVolume - 5.0) * 2.5);
  const cpp = Math.max(8, Math.round(dbp - cvp));

  // Myocardial Oxygen Demand (MVO2 in mL O2/min/100g)
  // Tension-time index / rate-pressure product proxy
  const mvo2 = parseFloat(((co * (sbp / 100) * 1.45) * Math.sqrt(contractility)).toFixed(1));

  // Ventricular volume during beat
  let lvVolume = edv;
  if (isSystole) {
    const t = cyclePhase / 0.35;
    // Rapid ejection then reduced ejection
    lvVolume = Math.round(edv - (edv - esv) * Math.sin(t * Math.PI * 0.5));
  } else {
    const t = (cyclePhase - 0.35) / 0.65;
    // Rapid filling then diastasis then atrial kick
    lvVolume = Math.round(esv + (edv - esv) * Math.min(1.0, Math.pow(t, 0.7)));
  }

  // Left Ventricle pressure
  let lvPressure = 10;
  if (isSystole) {
    const t = cyclePhase / 0.35;
    lvPressure = Math.round(12 + (sbp - 12) * Math.sin(t * Math.PI));
  } else {
    lvPressure = 8;
  }

  // Right ventricle volume & pressure (low pressure pulmonary circuit)
  const rvEdv = Math.round(edv * 0.95);
  const rvEsv = Math.round(esv * 0.95);
  const rvSystolic = Math.round(sbp * 0.22);
  const rvPressure = isSystole ? Math.round(4 + (rvSystolic - 4) * Math.sin((cyclePhase / 0.35) * Math.PI)) : 4;
  const rvVolume = isSystole ? rvEsv : rvEdv;

  return {
    time_s: parseFloat(time_s.toFixed(2)),
    map: mapVal,
    sbp,
    dbp,
    co,
    sv: parseFloat(sv.toFixed(1)),
    edv,
    esv,
    ef,
    cpp,
    mvo2,
    valves: {
      mitral: { is_open: !isSystole },
      aortic: { is_open: isSystole },
      tricuspid: { is_open: !isSystole },
      pulmonic: { is_open: isSystole }
    },
    chambers: {
      left_ventricle: {
        volume_ml: lvVolume,
        pressure_mmhg: lvPressure
      },
      right_ventricle: {
        volume_ml: rvVolume,
        pressure_mmhg: rvPressure
      },
      left_atrium: {
        volume_ml: isSystole ? 68 : 32,
        pressure_mmhg: 12
      },
      right_atrium: {
        volume_ml: isSystole ? 62 : 28,
        pressure_mmhg: Math.round(cvp)
      }
    }
  };
}

// ECG waveform generator function (Lead II)
export function getEcgSample(cyclePhase: number): number {
  if (cyclePhase < 0.15) return 0;
  if (cyclePhase < 0.22) {
    const p = (cyclePhase - 0.15) / 0.07;
    return Math.sin(p * Math.PI) * 0.18; // P wave
  }
  if (cyclePhase < 0.28) return 0; // PR segment
  if (cyclePhase < 0.30) return -0.16; // Q wave
  if (cyclePhase < 0.35) {
    const r = (cyclePhase - 0.30) / 0.05;
    return Math.sin(r * Math.PI) * 1.0; // R wave spike
  }
  if (cyclePhase < 0.38) return -0.28; // S wave
  if (cyclePhase < 0.45) return 0; // ST segment
  if (cyclePhase < 0.65) {
    const tw = (cyclePhase - 0.45) / 0.20;
    return Math.sin(tw * Math.PI) * 0.32; // T wave
  }
  return 0; // TP baseline
}
