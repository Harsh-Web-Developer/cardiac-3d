import React, { useState, useEffect } from 'react';

interface HeaderProps {
  onOpenAskWhy: () => void;
  running: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAskWhy, running }) => {
  const [seconds, setSeconds] = useState(2539.4); // starts around T+00:42:19.4

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds(prev => prev + 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, [running]);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = (totalSec % 60).toFixed(1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const padSec = parseFloat(secs) < 10 ? `0${secs}` : secs;
    return `T+${pad(hrs)}:${pad(mins)}:${padSec}`;
  };

  return (
    <header className="h-11 w-full bg-white border-b border-surface-border px-3 flex items-center justify-between gap-2 shrink-0 z-30 shadow-sm">
      {/* Brand & System Status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-clinical-cyan/10 border border-clinical-cyan/25 flex items-center justify-center">
            <span className="material-symbols-outlined text-clinical-cyan text-[15px]">vital_signs</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono font-bold text-xs tracking-wider text-clinical-cyan">CARDIA</span>
            <span className="font-mono text-[9px] text-text-dim tracking-wider uppercase font-semibold">CLINICAL TWIN</span>
          </div>
        </div>
        <div className="h-4 w-px bg-surface-border"></div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
          <span className={`w-1.5 h-1.5 rounded-full bg-clinical-emerald ${running ? 'animate-pulse' : ''}`}></span>
          <span className="font-mono text-[10px] text-clinical-emerald font-semibold tracking-wide">
            {running ? 'ONLINE / ACTIVE SIMULATION' : 'SIMULATION PAUSED'}
          </span>
        </div>
      </div>

      {/* Session Utilities */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 font-mono text-[10px] text-text-dim bg-slate-50 px-2 py-0.5 rounded border border-surface-border font-medium">
          <span className="material-symbols-outlined text-[13px] text-clinical-teal">timer</span>
          <span className="text-text-muted">{formatTime(seconds)}</span>
        </div>
        <div className="w-px h-4 bg-surface-border mx-0.5"></div>
        <button
          className="px-2.5 py-1 rounded bg-sky-50 hover:bg-sky-100 text-clinical-cyan border border-sky-200 flex items-center gap-1.5 transition-colors font-semibold font-mono text-[10px] shadow-xs cursor-pointer"
          id="btn-open-ask-why"
          type="button"
          onClick={onOpenAskWhy}
        >
          <span className="material-symbols-outlined text-[13px]">neurology</span>
          <span>Ask Why (AI Reasoning)</span>
        </button>
      </div>
    </header>
  );
};
