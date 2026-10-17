import React from 'react';

interface FooterProps {
  onOpenFork: () => void;
  onOpenMl: () => void;
  onResetPatient: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenFork,
  onOpenMl,
  onResetPatient,
}) => {
  return (
    <footer className="h-8 w-full bg-white border-t border-surface-border px-3 flex items-center justify-between gap-2 shrink-0 z-30 font-mono text-[10px] shadow-xs">
      <div className="flex items-center gap-2">
        {/* Button 1: Fork Experiment */}
        <button
          className="px-2.5 py-0.5 rounded bg-white hover:bg-slate-50 text-text-primary border border-surface-border flex items-center gap-1.5 transition-colors font-medium shadow-xs cursor-pointer"
          id="btn-open-fork"
          type="button"
          onClick={onOpenFork}
        >
          <span className="material-symbols-outlined text-[13px] text-emerald-600">alt_route</span>
          <span>Fork Experiment</span>
        </button>

        {/* Button 2: ML Inference Estimation */}
        <button
          className="px-2.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors font-semibold shadow-xs cursor-pointer"
          id="btn-open-ml"
          type="button"
          onClick={onOpenMl}
        >
          <span className="material-symbols-outlined text-[13px] text-emerald-700">psychology</span>
          <span>ML Parameter Inference</span>
        </button>

        {/* Button 3: Reset Patient */}
        <button
          className="px-2 py-0.5 rounded bg-white hover:bg-rose-50 hover:text-clinical-rose text-text-muted border border-surface-border flex items-center gap-1 transition-colors font-medium shadow-xs cursor-pointer"
          id="btn-reset-patient"
          type="button"
          onClick={onResetPatient}
        >
          <span className="material-symbols-outlined text-[13px]">device_reset</span>
          <span>Reset Patient</span>
        </button>
      </div>

      {/* Regulatory & Benchmark Disclaimer */}
      <div className="hidden md:flex items-center gap-2 text-text-dim text-[9px] font-medium">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px] text-clinical-teal">verified</span> Guyton-Coleman 0D/1D Solver
        </span>
        <span>•</span>
        <span>Educational &amp; Research Prototype — Not for diagnostic or clinical treatment use</span>
      </div>

      <div className="flex items-center gap-2 text-text-dim text-[9px] font-medium">
        <span>LATENCY: 14ms</span>
        <span>•</span>
        <span className="text-emerald-700 font-bold">STABLE</span>
      </div>
    </footer>
  );
};
