import React, { useEffect, useRef } from 'react';
import { LiveMetrics } from '../types/cardiac';
import { getEcgSample } from '../simulation/cardiacEngine';

interface TelemetryWaveformsProps {
  live: LiveMetrics;
  hr: number;
  running: boolean;
  speed: number;
  cyclePhase: number;
}

export const TelemetryWaveforms: React.FC<TelemetryWaveformsProps> = ({
  live,
  hr,
  running,
  speed,
  cyclePhase,
}) => {
  const canvasEcgRef = useRef<HTMLCanvasElement | null>(null);
  const canvasPvRef = useRef<HTMLCanvasElement | null>(null);
  const canvasFlowRef = useRef<HTMLCanvasElement | null>(null);
  const sweepLineRef = useRef<HTMLDivElement | null>(null);

  const ecgHistoryRef = useRef<Float32Array>(new Float32Array(300));
  const ecgIndexRef = useRef(0);

  // Animation and chart update loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const render = (timestamp: number) => {
      animId = requestAnimationFrame(render);
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      // 1. Lead II ECG Strip
      const canvasEcg = canvasEcgRef.current;
      if (canvasEcg) {
        const rect = canvasEcg.getBoundingClientRect();
        if (canvasEcg.width !== Math.floor(rect.width) || canvasEcg.height !== Math.floor(rect.height)) {
          canvasEcg.width = Math.floor(rect.width);
          canvasEcg.height = Math.floor(rect.height);
        }

        const ctx = canvasEcg.getContext('2d');
        if (ctx && running) {
          const sample = getEcgSample(cyclePhase);
          const steps = Math.max(1, Math.round(dt * 120 * speed));
          for (let s = 0; s < steps; s++) {
            ecgHistoryRef.current[ecgIndexRef.current] = sample;
            ecgIndexRef.current = (ecgIndexRef.current + 1) % ecgHistoryRef.current.length;
          }

          if (sweepLineRef.current) {
            sweepLineRef.current.style.left = `${(ecgIndexRef.current / ecgHistoryRef.current.length) * 100}%`;
          }

          ctx.clearRect(0, 0, canvasEcg.width, canvasEcg.height);
          ctx.lineWidth = 1.75;
          ctx.strokeStyle = '#0284c7';
          ctx.beginPath();
          const midY = canvasEcg.height * 0.65;
          const scaleX = canvasEcg.width / ecgHistoryRef.current.length;
          for (let i = 0; i < ecgHistoryRef.current.length; i++) {
            const y = midY - (ecgHistoryRef.current[i] * (canvasEcg.height * 0.42));
            if (i === 0) ctx.moveTo(i * scaleX, y);
            else ctx.lineTo(i * scaleX, y);
          }
          ctx.stroke();
        }
      }

      // 2. LV PV Loop Canvas
      const canvasPv = canvasPvRef.current;
      if (canvasPv) {
        const rect = canvasPv.getBoundingClientRect();
        if (canvasPv.width !== Math.floor(rect.width) || canvasPv.height !== Math.floor(rect.height)) {
          canvasPv.width = Math.floor(rect.width);
          canvasPv.height = Math.floor(rect.height);
        }

        const ctx = canvasPv.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasPv.width, canvasPv.height);
          const w = canvasPv.width;
          const ch = canvasPv.height;

          const sx = (vol: number) => (vol / 180) * (w - 24) + 12;
          const sy = (press: number) => ch - 10 - (press / 160) * (ch - 20);

          const edvX = sx(live.edv);
          const esvX = sx(live.esv);
          const sbpY = sy(live.sbp);
          const dbpY = sy(live.dbp);
          const edpY = sy(10);

          // End-systolic elastance dashed line
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
          ctx.beginPath();
          ctx.moveTo(sx(15), sy(0));
          ctx.lineTo(esvX + 20, sbpY - 10);
          ctx.stroke();
          ctx.setLineDash([]);

          // Filled PV Area (Cardiac Work)
          ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
          ctx.beginPath();
          ctx.moveTo(esvX, edpY);
          ctx.lineTo(edvX, edpY);
          ctx.lineTo(edvX, dbpY);
          ctx.bezierCurveTo((edvX + esvX) / 2, sbpY - 8, esvX, sbpY, esvX, sbpY);
          ctx.lineTo(esvX, edpY);
          ctx.fill();

          // Stroke Loop Outline
          ctx.lineWidth = 1.75;
          ctx.strokeStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(esvX, edpY);
          ctx.lineTo(edvX, edpY);
          ctx.lineTo(edvX, dbpY);
          ctx.bezierCurveTo((edvX + esvX) / 2, sbpY - 8, esvX, sbpY, esvX, sbpY);
          ctx.lineTo(esvX, edpY);
          ctx.stroke();

          // Traveling Dynamic Marker
          let mx = edvX;
          let my = edpY;
          const cp = cyclePhase;
          if (cp < 0.15) {
            const t = cp / 0.15;
            mx = edvX;
            my = edpY + (dbpY - edpY) * t;
          } else if (cp < 0.40) {
            const t = (cp - 0.15) / 0.25;
            mx = edvX - (edvX - esvX) * t;
            my = dbpY + (sbpY - dbpY) * Math.sin(t * Math.PI);
          } else if (cp < 0.50) {
            const t = (cp - 0.40) / 0.10;
            mx = esvX;
            my = sbpY + (edpY - sbpY) * t;
          } else {
            const t = (cp - 0.50) / 0.50;
            mx = esvX + (edvX - esvX) * t;
            my = edpY;
          }

          ctx.fillStyle = '#059669';
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 3. Pressure & Flow Canvas
      const canvasFlow = canvasFlowRef.current;
      if (canvasFlow) {
        const rect = canvasFlow.getBoundingClientRect();
        if (canvasFlow.width !== Math.floor(rect.width) || canvasFlow.height !== Math.floor(rect.height)) {
          canvasFlow.width = Math.floor(rect.width);
          canvasFlow.height = Math.floor(rect.height);
        }

        const ctx = canvasFlow.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasFlow.width, canvasFlow.height);
          const w = canvasFlow.width;
          const ch = canvasFlow.height;

          // Aortic Pressure Waveform
          ctx.lineWidth = 1.75;
          ctx.strokeStyle = '#1e293b';
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const frac = ((x / (w * 0.6)) + cyclePhase) % 1.0;
            let p = 0;
            if (frac < 0.25) p = Math.sin((frac / 0.25) * Math.PI * 0.5);
            else if (frac < 0.35) p = 0.9 - 0.15 * Math.sin(((frac - 0.25) / 0.10) * Math.PI);
            else p = 0.75 * Math.exp(-(frac - 0.35) * 3.5);

            const y = (ch * 0.78) - (p * (ch * 0.55) * (live.sbp / 130));
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Flow Velocity Waveform
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#059669';
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const frac = ((x / (w * 0.6)) + cyclePhase) % 1.0;
            let f = 0;
            if (frac < 0.28) f = Math.sin((frac / 0.28) * Math.PI);
            const y = (ch * 0.92) - (f * (ch * 0.58) * (live.co / 5.4));
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [live, running, speed, cyclePhase]);

  return (
    <aside className="col-span-3 flex flex-col gap-1.5 min-h-0 bg-white border border-surface-border rounded-lg p-2 overflow-hidden shadow-sm">
      {/* Top Telemetry Header */}
      <div className="flex items-center justify-between pb-1 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-clinical-cyan text-[16px]">show_chart</span>
          <span className="font-mono text-xs font-semibold tracking-wider text-text-primary uppercase">
            Telemetry Waveforms
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[8px] text-emerald-700 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-clinical-emerald animate-ping"></span>
          <span>60Hz SYNC</span>
        </div>
      </div>

      {/* Compact Top Live Vitals Bar */}
      <div className="grid grid-cols-3 gap-1 font-mono text-center bg-slate-50/90 p-1 rounded border border-surface-border shrink-0">
        <div className="bg-white p-0.5 rounded border border-surface-border/60">
          <span className="text-[7px] text-text-dim uppercase block">HR Live</span>
          <span className="text-[11px] font-bold text-clinical-cyan" id="disp-live-hr">
            {Math.round(hr)}
          </span>
        </div>
        <div className="bg-white p-0.5 rounded border border-surface-border/60">
          <span className="text-[7px] text-text-dim uppercase block">BP Live</span>
          <span className="text-[11px] font-bold text-text-primary" id="disp-live-bp">
            {Math.round(live.sbp)}/{Math.round(live.dbp)}
          </span>
        </div>
        <div className="bg-white p-0.5 rounded border border-surface-border/60">
          <span className="text-[7px] text-text-dim uppercase block">CO (L/m)</span>
          <span className="text-[11px] font-bold text-clinical-emerald" id="disp-live-co">
            {live.co.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 3 Streamlined Waveform Strips */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden">
        {/* WAVEFORM 1: Lead II ECG Strip */}
        <div className="flex-1 flex flex-col bg-slate-50/70 border border-surface-border rounded p-1 min-h-0">
          <div className="flex items-center justify-between pb-0.5 font-mono text-[9px] shrink-0">
            <span className="text-clinical-cyan font-bold tracking-wide">ECG // LEAD II</span>
            <div className="flex items-center gap-1 text-[8px] text-text-dim font-medium">
              <span>ST:</span>
              <span className="text-emerald-700 font-bold" id="stat-st-elev">
                +0.02mV
              </span>
            </div>
          </div>
          <div className="flex-1 w-full bg-[#f8fafc] rounded relative overflow-hidden border border-surface-border min-h-0 shadow-inner">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(226,232,240,0.8)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.8)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none"></div>
            <canvas ref={canvasEcgRef} className="w-full h-full relative z-10 block" id="canvas-ecg" />
            <div
              ref={sweepLineRef}
              className="absolute top-0 bottom-0 w-0.5 bg-clinical-cyan shadow-[0_0_4px_#0284c7] z-20 pointer-events-none left-0"
              id="ecg-sweep-line"
            ></div>
          </div>
        </div>

        {/* WAVEFORM 2: Pressure-Volume Loop */}
        <div className="flex-1 flex flex-col bg-slate-50/70 border border-surface-border rounded p-1 min-h-0">
          <div className="flex items-center justify-between pb-0.5 font-mono text-[9px] shrink-0">
            <span className="text-clinical-cyan font-bold tracking-wide">LV PV LOOP</span>
            <span className="text-[8px] text-text-dim font-medium">
              Work: {((live.sv * (live.map - 10) * 0.1333) / 100).toFixed(2)}J
            </span>
          </div>
          <div className="flex-1 w-full bg-[#f8fafc] rounded relative overflow-hidden border border-surface-border min-h-0 shadow-inner">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(226,232,240,0.8)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.8)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none"></div>
            <canvas ref={canvasPvRef} className="w-full h-full relative z-10 block" id="canvas-pv" />
            <span className="absolute bottom-0.5 right-1 font-mono text-[7px] text-text-dim font-semibold pointer-events-none">
              VOL (mL) →
            </span>
            <span className="absolute top-0.5 left-1 font-mono text-[7px] text-text-dim font-semibold pointer-events-none">
              ↑ P (mmHg)
            </span>
          </div>
        </div>

        {/* WAVEFORM 3: Aortic Pressure & Flow Velocity */}
        <div className="flex-1 flex flex-col bg-slate-50/70 border border-surface-border rounded p-1 min-h-0">
          <div className="flex items-center justify-between pb-0.5 font-mono text-[9px] shrink-0">
            <span className="text-clinical-cyan font-bold tracking-wide">AORTIC FLOW &amp; P</span>
            <div className="flex items-center gap-1.5 font-mono text-[8px]">
              <span className="text-slate-800 font-bold flex items-center gap-0.5">
                <span className="w-1.5 h-0.5 bg-slate-800"></span> P_ao
              </span>
              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                <span className="w-1.5 h-0.5 bg-emerald-600"></span> V_ao
              </span>
            </div>
          </div>
          <div className="flex-1 w-full bg-[#f8fafc] rounded relative overflow-hidden border border-surface-border min-h-0 shadow-inner">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(226,232,240,0.8)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,0.8)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none"></div>
            <canvas ref={canvasFlowRef} className="w-full h-full relative z-10 block" id="canvas-pressure-flow" />
          </div>
        </div>
      </div>
    </aside>
  );
};
