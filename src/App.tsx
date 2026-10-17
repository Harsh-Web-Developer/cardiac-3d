import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PatientProfile, HemodynamicKnobs, LiveMetrics } from './types/cardiac';
import { computeHemodynamics } from './simulation/cardiacEngine';
import { Header } from './components/Header';
import { PatientControls } from './components/PatientControls';
import { Heart3DViewport } from './components/Heart3DViewport';
import { TelemetryWaveforms } from './components/TelemetryWaveforms';
import { Footer } from './components/Footer';
import { AskWhyDrawer } from './components/AskWhyDrawer';
import { ForkModal } from './components/ForkModal';
import { MlInferenceModal } from './components/MlInferenceModal';

export const App: React.FC = () => {
  // Patient Profile State
  const [patient, setPatient] = useState<PatientProfile>({
    sex: 'MALE',
    age: 48,
    weight: 74,
    height: 178,
    bsa: 1.91,
    state: 'Euvolemic',
  });

  // Hemodynamic Knobs State
  const [knobs, setKnobs] = useState<HemodynamicKnobs>({
    hr: 74,
    co: 5.4,
    bloodVolume: 5.0,
    contractility: 1.0,
    svr: 1120,
  });

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [cyclePhase, setCyclePhase] = useState(0);

  // Modals & Drawers
  const [isAskWhyOpen, setIsAskWhyOpen] = useState(false);
  const [isForkOpen, setIsForkOpen] = useState(false);
  const [isMlOpen, setIsMlOpen] = useState(false);

  // Live Simulation Metrics
  const [live, setLive] = useState<LiveMetrics>(() => computeHemodynamics(knobs, 0, 0));

  const knobsRef = useRef(knobs);
  knobsRef.current = knobs;

  const runningRef = useRef(running);
  runningRef.current = running;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const cyclePhaseRef = useRef(cyclePhase);
  cyclePhaseRef.current = cyclePhase;

  // Real-time 60Hz Physics Step Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let totalTime = 0;

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (!runningRef.current) return;

      totalTime += dt * speedRef.current;
      const beatDuration = 60 / (Math.max(30, knobsRef.current.hr) * Math.max(0.2, speedRef.current));
      const nextPhase = (cyclePhaseRef.current + (dt / beatDuration)) % 1.0;
      cyclePhaseRef.current = nextPhase;
      setCyclePhase(nextPhase);

      const nextMetrics = computeHemodynamics(knobsRef.current, nextPhase, totalTime);
      setLive(nextMetrics);

      // Expose to window.__CARDIA_STATE for debugging or external scripts
      (window as any).__CARDIA_STATE = {
        hr: knobsRef.current.hr,
        contractility: knobsRef.current.contractility,
        bloodVolume: knobsRef.current.bloodVolume,
        svr: knobsRef.current.svr,
        running: runningRef.current,
        speed: speedRef.current,
        cyclePhase: nextPhase,
        live: nextMetrics
      };
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleUpdatePatient = useCallback((update: Partial<PatientProfile>) => {
    setPatient(prev => ({ ...prev, ...update }));
  }, []);

  const handleUpdateKnobs = useCallback((update: Partial<HemodynamicKnobs>) => {
    setKnobs(prev => {
      const next = { ...prev, ...update };
      // Keep CO consistent if SV changed
      if (update.hr !== undefined && update.co === undefined) {
        next.co = parseFloat(((next.co / prev.hr) * next.hr).toFixed(2));
      }
      return next;
    });
  }, []);

  const handleResetKnobs = useCallback(() => {
    setKnobs({
      hr: 74,
      co: 5.4,
      bloodVolume: 5.0,
      contractility: 1.0,
      svr: 1120,
    });
  }, []);

  const handleApplyPreset = useCallback((preset: 'hemorrhage' | 'hypertension' | 'tachycardia' | 'ischemia') => {
    if (preset === 'hemorrhage') {
      setKnobs({
        bloodVolume: 3.25,
        hr: 120,
        svr: 1680,
        contractility: 1.25,
        co: 3.35
      });
    } else if (preset === 'hypertension') {
      setKnobs({
        svr: 1950,
        contractility: 1.1,
        bloodVolume: 5.3,
        hr: 78,
        co: 5.6
      });
    } else if (preset === 'tachycardia') {
      setKnobs({
        hr: 145,
        contractility: 1.15,
        bloodVolume: 5.0,
        svr: 1120,
        co: 5.8
      });
    } else if (preset === 'ischemia') {
      setKnobs({
        contractility: 0.55,
        svr: 1400,
        hr: 95,
        bloodVolume: 4.8,
        co: 3.8
      });
    }
  }, []);

  const handleResetPatient = useCallback(() => {
    setPatient({
      sex: 'MALE',
      age: 48,
      weight: 74,
      height: 178,
      bsa: 1.91,
      state: 'Euvolemic',
    });
    setKnobs({
      hr: 74,
      co: 5.4,
      bloodVolume: 5.0,
      contractility: 1.0,
      svr: 1120,
    });
    setSpeed(1.0);
    setRunning(true);
  }, []);

  const handleDeployBranchB = useCallback(() => {
    setKnobs({
      bloodVolume: 3.25,
      hr: 128,
      contractility: 1.3,
      svr: 1750,
      co: 3.35
    });
  }, []);

  return (
    <div className="bg-[#f1f5f9] font-sans text-text-primary h-screen max-h-screen overflow-hidden flex flex-col antialiased select-none">
      {/* Top Header */}
      <Header
        running={running}
        onOpenAskWhy={() => setIsAskWhyOpen(true)}
      />

      {/* Main Zero-Scroll Cockpit Grid (4 - 5 - 3) */}
      <main className="flex-1 grid grid-cols-12 gap-2.5 p-2 min-h-0 overflow-hidden relative">
        {/* Left Column: Patient Profile, Vitals & Controls (Col-4) */}
        <PatientControls
          patient={patient}
          knobs={knobs}
          running={running}
          speed={speed}
          onUpdatePatient={handleUpdatePatient}
          onUpdateKnobs={handleUpdateKnobs}
          onResetKnobs={handleResetKnobs}
          onApplyPreset={handleApplyPreset}
          onSetRunning={setRunning}
          onSetSpeed={setSpeed}
        />

        {/* Center Column: 3D Heart Simulation Viewport (Col-5) */}
        <Heart3DViewport
          live={live}
          hr={knobs.hr}
          contractility={knobs.contractility}
          svr={knobs.svr}
          running={running}
          speed={speed}
          cyclePhase={cyclePhase}
        />

        {/* Right Column: Stacked Live Waveforms & Metrics (Col-3) */}
        <TelemetryWaveforms
          live={live}
          hr={knobs.hr}
          running={running}
          speed={speed}
          cyclePhase={cyclePhase}
        />
      </main>

      {/* Bottom Utility Bar */}
      <Footer
        onOpenFork={() => setIsForkOpen(true)}
        onOpenMl={() => setIsMlOpen(true)}
        onResetPatient={handleResetPatient}
      />

      {/* Sliding Drawer: Ask Why */}
      <AskWhyDrawer
        isOpen={isAskWhyOpen}
        onClose={() => setIsAskWhyOpen(false)}
        live={live}
        hr={knobs.hr}
      />

      {/* Modal: Fork Experiment */}
      <ForkModal
        isOpen={isForkOpen}
        onClose={() => setIsForkOpen(false)}
        onDeployBranchB={handleDeployBranchB}
      />

      {/* Modal: ML Parameter Inference */}
      <MlInferenceModal
        isOpen={isMlOpen}
        onClose={() => setIsMlOpen(false)}
        live={live}
        knobs={knobs}
      />
    </div>
  );
};
