export interface PatientProfile {
  sex: 'MALE' | 'FEMALE';
  age: number;
  weight: number;
  height: number;
  bsa: number;
  state: 'Euvolemic' | 'Hypervolemic' | 'Hypovolemic' | 'Vasodilated';
}

export interface HemodynamicKnobs {
  hr: number;           // BPM (40 - 180)
  co: number;           // L/min (2.0 - 10.0)
  bloodVolume: number;  // L (3.0 - 7.0)
  contractility: number;// x (0.4 - 2.0)
  svr: number;          // dyn·s/cm5 (600 - 2200)
}

export interface ValveState {
  is_open: boolean;
}

export interface ChamberMetric {
  volume_ml: number;
  pressure_mmhg: number;
}

export interface LiveMetrics {
  time_s: number;
  map: number;
  sbp: number;
  dbp: number;
  co: number;
  sv: number;
  edv: number;
  esv: number;
  ef: number;
  cpp: number;
  mvo2: number;
  valves: {
    mitral: ValveState;
    aortic: ValveState;
    tricuspid: ValveState;
    pulmonic: ValveState;
  };
  chambers: {
    left_ventricle: ChamberMetric;
    right_ventricle: ChamberMetric;
    left_atrium: ChamberMetric;
    right_atrium: ChamberMetric;
  };
}

export interface TelemetryState {
  patient: PatientProfile;
  knobs: HemodynamicKnobs;
  running: boolean;
  speed: number;
  cyclePhase: number;
  live: LiveMetrics;
}

export interface MLPrediction {
  blood_volume_l: number;
  contractility: number;
  systemic_vascular_resistance: number;
}

export interface RAGMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  sources?: string[];
  confidence?: number;
  mechanismBullets?: string[];
}
