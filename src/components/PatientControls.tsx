import React, { useState } from 'react';
import { PatientProfile, HemodynamicKnobs } from '../types/cardiac';

interface PatientControlsProps {
  patient: PatientProfile;
  knobs: HemodynamicKnobs;
  running: boolean;
  speed: number;
  onUpdatePatient: (patient: Partial<PatientProfile>) => void;
  onUpdateKnobs: (knobs: Partial<HemodynamicKnobs>) => void;
  onResetKnobs: () => void;
  onApplyPreset: (preset: 'hemorrhage' | 'hypertension' | 'tachycardia' | 'ischemia') => void;
  onSetRunning: (running: boolean) => void;
  onSetSpeed: (speed: number) => void;
}

export const PatientControls: React.FC<PatientControlsProps> = ({
  patient,
  knobs,
  running,
  speed,
  onUpdatePatient,
  onUpdateKnobs,
  onResetKnobs,
  onApplyPreset,
  onSetRunning,
  onSetSpeed,
}) => {
  const [syncedText, setSyncedText] = useState('SYNCED');

  const flashSync = () => {
    setSyncedText('SAVED');
    setTimeout(() => {
      setSyncedText('SYNCED');
    }, 700);
  };

  const handleSexChange = (sex: 'MALE' | 'FEMALE') => {
    onUpdatePatient({ sex });
    flashSync();
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const age = parseInt(e.target.value, 10) || 1;
    onUpdatePatient({ age });
    flashSync();
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const weight = parseFloat(e.target.value) || 25;
    const bsa = parseFloat(Math.sqrt((patient.height * weight) / 3600).toFixed(2));
    onUpdatePatient({ weight, bsa });
    flashSync();
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const height = parseFloat(e.target.value) || 100;
    const bsa = parseFloat(Math.sqrt((height * patient.weight) / 3600).toFixed(2));
    onUpdatePatient({ height, bsa });
    flashSync();
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as PatientProfile['state'];
    onUpdatePatient({ state: val });
    if (val === 'Hypervolemic') {
      onUpdateKnobs({ bloodVolume: 5.8 });
    } else if (val === 'Hypovolemic') {
      onUpdateKnobs({ bloodVolume: 3.8 });
    } else if (val === 'Vasodilated') {
      onUpdateKnobs({ svr: 820 });
    } else {
      onUpdateKnobs({ bloodVolume: 5.0, svr: 1120 });
    }
    flashSync();
  };

  return (
    <aside className="col-span-4 flex flex-col gap-1.5 min-h-0 bg-white border border-surface-border rounded-lg p-2 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-clinical-cyan text-[16px]">patient_list</span>
          <span className="font-mono text-xs font-semibold tracking-wider text-text-primary uppercase">
            Patient &amp; Controls
          </span>
        </div>
      </div>

      {/* Main Scrollable View */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-y-auto pr-0.5" id="view-patient-profile">
        {/* 1. EDITABLE PATIENT PROFILE CARD */}
        <div className="bg-slate-50/90 border border-surface-border rounded p-2 flex flex-col gap-1.5 shrink-0 shadow-xs">
          <div className="flex items-center justify-between pb-1 border-b border-surface-border/70 font-mono text-[9px]">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-clinical-teal text-[13px]">person_edit</span>
              <span className="text-clinical-teal uppercase font-bold tracking-wider">Patient Demographics</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className={`text-[8px] font-semibold ${syncedText === 'SAVED' ? 'text-clinical-cyan' : 'text-emerald-700'}`} id="sync-indicator">
                {syncedText}
              </span>
              <span className="text-[8px] text-text-dim bg-white px-1.5 py-0.2 rounded border border-surface-border">
                PID: TWIN-8402
              </span>
            </div>
          </div>

          {/* Biological Sex Segmented Control */}
          <div className="flex items-center justify-between font-mono text-[9px]">
            <span className="text-text-muted font-medium">Biological Sex</span>
            <div className="flex bg-white rounded border border-surface-border p-0.5 text-[9px]" id="sex-toggle-group">
              <button
                className={`px-2 py-0.5 rounded font-bold transition-all sex-btn cursor-pointer ${
                  patient.sex === 'MALE' ? 'bg-clinical-cyan text-white' : 'text-text-dim hover:text-text-primary'
                }`}
                type="button"
                onClick={() => handleSexChange('MALE')}
              >
                MALE
              </button>
              <button
                className={`px-2 py-0.5 rounded font-bold transition-all sex-btn cursor-pointer ${
                  patient.sex === 'FEMALE' ? 'bg-clinical-cyan text-white' : 'text-text-dim hover:text-text-primary'
                }`}
                type="button"
                onClick={() => handleSexChange('FEMALE')}
              >
                FEMALE
              </button>
            </div>
          </div>

          {/* Age, Weight, Height Grid with inline interactive steppers */}
          <div className="grid grid-cols-3 gap-1.5 font-mono">
            {/* Age Input */}
            <div className="bg-white p-1 rounded border border-surface-border flex flex-col">
              <span className="text-[8px] text-text-dim font-medium">Age</span>
              <div className="flex items-center justify-between mt-0.5">
                <input
                  className="w-10 text-[11px] font-bold text-text-primary bg-transparent outline-none p-0 border-none focus:ring-0"
                  id="input-patient-age"
                  max="99"
                  min="1"
                  type="number"
                  value={patient.age}
                  onChange={handleAgeChange}
                />
                <span className="text-[8px] text-text-dim">yrs</span>
              </div>
            </div>

            {/* Weight Input */}
            <div className="bg-white p-1 rounded border border-surface-border flex flex-col">
              <span className="text-[8px] text-text-dim font-medium">Weight</span>
              <div className="flex items-center justify-between mt-0.5">
                <input
                  className="w-10 text-[11px] font-bold text-text-primary bg-transparent outline-none p-0 border-none focus:ring-0"
                  id="input-patient-weight"
                  max="200"
                  min="25"
                  type="number"
                  value={patient.weight}
                  onChange={handleWeightChange}
                />
                <span className="text-[8px] text-text-dim">kg</span>
              </div>
            </div>

            {/* Height Input */}
            <div className="bg-white p-1 rounded border border-surface-border flex flex-col">
              <span className="text-[8px] text-text-dim font-medium">Height</span>
              <div className="flex items-center justify-between mt-0.5">
                <input
                  className="w-10 text-[11px] font-bold text-text-primary bg-transparent outline-none p-0 border-none focus:ring-0"
                  id="input-patient-height"
                  max="230"
                  min="100"
                  type="number"
                  value={patient.height}
                  onChange={handleHeightChange}
                />
                <span className="text-[8px] text-text-dim">cm</span>
              </div>
            </div>
          </div>

          {/* Computed BSA & Baseline Condition Selector Row */}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
            <div className="bg-white px-2 py-1 rounded border border-surface-border flex items-center justify-between">
              <span className="text-text-dim text-[8px]">Body Surf. Area (BSA)</span>
              <span className="text-[10px] font-bold text-clinical-cyan" id="disp-patient-bsa">
                {patient.bsa} m²
              </span>
            </div>
            <div className="bg-white px-1.5 py-0.5 rounded border border-surface-border flex items-center justify-between">
              <span className="text-text-dim text-[8px] shrink-0">State:</span>
              <select
                className="bg-transparent border-none text-[9px] font-bold text-clinical-emerald p-0 outline-none cursor-pointer focus:ring-0 text-right w-full"
                id="select-patient-state"
                value={patient.state}
                onChange={handleStateChange}
              >
                <option value="Euvolemic">Euvolemic</option>
                <option value="Hypervolemic">Hypervolemic</option>
                <option value="Hypovolemic">Hypovolemic</option>
                <option value="Vasodilated">Vasodilated</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. EDITABLE REAL-TIME TARGET VITALS & TELEMETRY INPUTS */}
        <div className="flex flex-col gap-1.5 bg-slate-50/90 border border-surface-border p-2 rounded shrink-0">
          <div className="flex items-center justify-between pb-0.5 border-b border-surface-border/60">
            <span className="font-mono text-[9px] uppercase tracking-wider text-clinical-teal font-semibold">
              A // Hemodynamic Knobs
            </span>
            <button
              className="font-mono text-[8px] text-text-dim hover:text-clinical-cyan flex items-center gap-0.5 cursor-pointer"
              id="btn-reset-sliders"
              type="button"
              onClick={onResetKnobs}
            >
              <span className="material-symbols-outlined text-[10px]">restart_alt</span> Reset
            </button>
          </div>

          {/* Heart Rate */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center font-mono text-[9px]">
              <span className="text-text-muted font-medium">Heart Rate</span>
              <span className="text-clinical-cyan font-bold">
                <span id="val-hr">{Math.round(knobs.hr)}</span> <span className="text-text-dim text-[8px]">BPM</span>
              </span>
            </div>
            <input
              className="w-full cursor-pointer"
              id="slider-hr"
              max="180"
              min="40"
              type="range"
              value={knobs.hr}
              onChange={(e) => onUpdateKnobs({ hr: parseInt(e.target.value, 10) })}
            />
            <div className="flex justify-between font-mono text-[8px] text-text-dim font-medium">
              <span>40 Brady</span>
              <span>Nominal 74</span>
              <span>180 Tachy</span>
            </div>
          </div>

          {/* Cardiac Output */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center font-mono text-[9px]">
              <span className="text-text-muted font-medium">Cardiac Output (CO)</span>
              <span className="text-clinical-cyan font-bold">
                <span id="val-co">{knobs.co.toFixed(2)}</span> <span className="text-text-dim text-[8px]">L/min</span>
              </span>
            </div>
            <input
              className="w-full cursor-pointer"
              id="slider-co"
              max="10.0"
              min="2.0"
              step="0.1"
              type="range"
              value={knobs.co}
              onChange={(e) => onUpdateKnobs({ co: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between font-mono text-[8px] text-text-dim font-medium">
              <span>2.0L Hypo</span>
              <span>Nominal 5.4L</span>
              <span>10.0L Hyper</span>
            </div>
          </div>

          {/* Total Circulating Volume */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center font-mono text-[9px]">
              <span className="text-text-muted font-medium">Total Circulating Vol</span>
              <span className="text-clinical-cyan font-bold">
                <span id="val-vol">{knobs.bloodVolume.toFixed(1)}</span> <span className="text-text-dim text-[8px]">L</span>
              </span>
            </div>
            <input
              className="w-full cursor-pointer"
              id="slider-vol"
              max="7.0"
              min="3.0"
              step="0.1"
              type="range"
              value={knobs.bloodVolume}
              onChange={(e) => onUpdateKnobs({ bloodVolume: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between font-mono text-[8px] text-text-dim font-medium">
              <span>3.0L (-40%)</span>
              <span>5.0L Baseline</span>
              <span>7.0L (+40%)</span>
            </div>
          </div>

          {/* LV Contractility */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center font-mono text-[9px]">
              <span className="text-text-muted font-medium">LV Contractility (Inotropy)</span>
              <span className="text-clinical-cyan font-bold">
                <span id="val-contract">{knobs.contractility.toFixed(2)}</span> <span className="text-text-dim text-[8px]">x</span>
              </span>
            </div>
            <input
              className="w-full cursor-pointer"
              id="slider-contract"
              max="2.0"
              min="0.4"
              step="0.05"
              type="range"
              value={knobs.contractility}
              onChange={(e) => onUpdateKnobs({ contractility: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between font-mono text-[8px] text-text-dim font-medium">
              <span>0.4x Infarct</span>
              <span>1.0x Norm</span>
              <span>2.0x Hyper</span>
            </div>
          </div>

          {/* Systemic Vascular Resistance */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center font-mono text-[9px]">
              <span className="text-text-muted font-medium">Systemic Vas. Res. (SVR)</span>
              <span className="text-clinical-cyan font-bold">
                <span id="val-svr">{Math.round(knobs.svr)}</span> <span className="text-text-dim text-[8px]">dyn·s</span>
              </span>
            </div>
            <input
              className="w-full cursor-pointer"
              id="slider-svr"
              max="2200"
              min="600"
              step="20"
              type="range"
              value={knobs.svr}
              onChange={(e) => onUpdateKnobs({ svr: parseInt(e.target.value, 10) })}
            />
            <div className="flex justify-between font-mono text-[8px] text-text-dim font-medium">
              <span>600 (VasoD)</span>
              <span>1120</span>
              <span>2200 (VasoC)</span>
            </div>
          </div>
        </div>

        {/* 3. PATHOPHYSIOLOGY PRESETS */}
        <div className="flex flex-col gap-1 bg-slate-50/90 border border-surface-border p-2 rounded shrink-0">
          <div className="flex items-center justify-between pb-0.5 border-b border-surface-border/60">
            <span className="font-mono text-[9px] uppercase tracking-wider text-clinical-teal font-semibold">
              B // Pathophysiology Presets
            </span>
            <span className="font-mono text-[8px] text-text-dim font-medium">QUICK INJECT</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {/* Hemorrhage */}
            <div className="flex flex-col gap-0.5">
              <button
                className="preset-btn w-full p-1.5 rounded bg-rose-50/70 hover:bg-rose-100 border border-rose-200 text-left transition-all group cursor-pointer"
                data-preset="hemorrhage"
                type="button"
                onClick={() => onApplyPreset('hemorrhage')}
              >
                <div className="font-mono text-[9px] font-bold text-rose-700 flex items-center justify-between">
                  <span>Hemorrhage</span>
                  <span className="text-[7px] opacity-80 px-1 rounded bg-rose-200/50">Shock</span>
                </div>
                <span className="font-mono text-[8px] text-rose-600 block leading-tight font-medium">
                  -35% Vol / Tachy
                </span>
              </button>
            </div>

            {/* Hypertension */}
            <div className="flex flex-col gap-0.5">
              <button
                className="preset-btn w-full p-1.5 rounded bg-sky-50/70 hover:bg-sky-100 border border-sky-200 text-left transition-all group cursor-pointer"
                data-preset="hypertension"
                type="button"
                onClick={() => onApplyPreset('hypertension')}
              >
                <div className="font-mono text-[9px] font-bold text-sky-800 flex items-center justify-between">
                  <span>Hypertension</span>
                  <span className="text-[7px] opacity-80 px-1 rounded bg-sky-200/50">Afterload</span>
                </div>
                <span className="font-mono text-[8px] text-sky-700 block leading-tight font-medium">
                  +65% SVR crisis
                </span>
              </button>
            </div>

            {/* Tachycardia */}
            <div className="flex flex-col gap-0.5">
              <button
                className="preset-btn w-full p-1.5 rounded bg-amber-50/70 hover:bg-amber-100 border border-amber-200 text-left transition-all group cursor-pointer"
                data-preset="tachycardia"
                type="button"
                onClick={() => onApplyPreset('tachycardia')}
              >
                <div className="font-mono text-[9px] font-bold text-amber-800 flex items-center justify-between">
                  <span>Tachycardia</span>
                  <span className="text-[7px] opacity-80 px-1 rounded bg-amber-200/50">SVT</span>
                </div>
                <span className="font-mono text-[8px] text-amber-700 block leading-tight font-medium">
                  145 BPM Supravent.
                </span>
              </button>
            </div>

            {/* Ischemia */}
            <div className="flex flex-col gap-0.5">
              <button
                className="preset-btn w-full p-1.5 rounded bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200 text-left transition-all group cursor-pointer"
                data-preset="ischemia"
                type="button"
                onClick={() => onApplyPreset('ischemia')}
              >
                <div className="font-mono text-[9px] font-bold text-emerald-800 flex items-center justify-between">
                  <span>Ischemia</span>
                  <span className="text-[7px] opacity-80 px-1 rounded bg-emerald-200/50">Pump</span>
                </div>
                <span className="font-mono text-[8px] text-emerald-700 block leading-tight font-medium">
                  0.55x Contract
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RUNTIME TRANSPORT CONTROLS PINNED AT BOTTOM */}
      <div className="mt-auto bg-slate-50/90 border border-surface-border p-1.5 rounded flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between font-mono text-[9px] text-text-dim font-medium">
          <span>RUNTIME TRANSPORT</span>
          <div className="flex items-center gap-1">
            <button
              className={`speed-btn px-1.5 py-0.5 rounded text-[8px] font-mono cursor-pointer transition-colors ${
                speed === 0.5 ? 'bg-clinical-teal text-white font-bold' : 'bg-white border border-surface-border text-text-muted hover:text-text-primary'
              }`}
              type="button"
              onClick={() => onSetSpeed(0.5)}
            >
              0.5x
            </button>
            <button
              className={`speed-btn px-1.5 py-0.5 rounded text-[8px] font-mono cursor-pointer transition-colors ${
                speed === 1.0 ? 'bg-clinical-teal text-white font-bold' : 'bg-white border border-surface-border text-text-muted hover:text-text-primary'
              }`}
              type="button"
              onClick={() => onSetSpeed(1.0)}
            >
              1.0x
            </button>
            <button
              className={`speed-btn px-1.5 py-0.5 rounded text-[8px] font-mono cursor-pointer transition-colors ${
                speed === 2.0 ? 'bg-clinical-teal text-white font-bold' : 'bg-white border border-surface-border text-text-muted hover:text-text-primary'
              }`}
              type="button"
              onClick={() => onSetSpeed(2.0)}
            >
              2.0x
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className={`py-1 rounded font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer ${
              running
                ? 'bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white border border-surface-border hover:bg-slate-50 text-text-muted hover:text-text-primary'
            }`}
            id="btn-run"
            type="button"
            onClick={() => onSetRunning(true)}
          >
            <span className="material-symbols-outlined text-[13px]">play_arrow</span> Run
          </button>
          <button
            className={`py-1 rounded font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer ${
              !running
                ? 'bg-rose-600 border border-rose-600 text-white font-bold'
                : 'bg-white border border-surface-border hover:bg-slate-50 text-text-muted hover:text-text-primary'
            }`}
            id="btn-pause"
            type="button"
            onClick={() => onSetRunning(false)}
          >
            <span className="material-symbols-outlined text-[13px]">pause</span> Hold
          </button>
        </div>
      </div>
    </aside>
  );
};
