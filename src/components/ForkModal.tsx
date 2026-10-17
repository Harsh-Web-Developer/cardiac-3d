import React from 'react';

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployBranchB: () => void;
}

export const ForkModal: React.FC<ForkModalProps> = ({
  isOpen,
  onClose,
  onDeployBranchB,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3" id="modal-fork">
      <div className="w-full max-w-2xl bg-white border border-surface-border rounded-lg shadow-2xl p-4 flex flex-col gap-3 font-mono">
        <div className="flex items-center justify-between pb-2 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-clinical-emerald text-[18px]">alt_route</span>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-bold text-text-primary">Forked Experiment Branch Comparison</span>
              <span className="text-[9px] text-text-dim">Differential In-Silico Trajectory</span>
            </div>
          </div>
          <button
            className="w-6 h-6 rounded hover:bg-slate-100 text-text-dim hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
            id="btn-close-fork"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Branch A vs Branch B */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Branch A */}
          <div className="bg-slate-50 p-2.5 rounded border border-surface-border flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-surface-border">
              <span className="text-text-primary font-bold text-[10px]">Branch A: Baseline</span>
              <span className="text-[8px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-bold">
                NOMINAL
              </span>
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between text-text-muted">
                <span>Heart Rate:</span>
                <span className="text-clinical-cyan font-semibold" id="fork-base-hr">74 bpm</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Blood Pressure:</span>
                <span className="text-text-primary font-semibold" id="fork-base-bp">118 / 78 mmHg</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>MAP:</span>
                <span className="text-clinical-cyan font-semibold" id="fork-base-map">91.3 mmHg</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Cardiac Output:</span>
                <span className="text-emerald-700 font-semibold" id="fork-base-co">5.40 L/min</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Stroke Volume:</span>
                <span className="text-text-primary font-semibold" id="fork-base-sv">72 mL</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Shock Index:</span>
                <span className="text-text-primary font-semibold" id="fork-base-si">0.63 (Normal)</span>
              </div>
            </div>
          </div>

          {/* Branch B */}
          <div className="bg-rose-50/50 p-2.5 rounded border border-rose-200 flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-rose-200">
              <span className="text-rose-800 font-bold text-[10px]" id="fork-branch-title">
                Branch B: Shock State
              </span>
              <span className="text-[8px] text-rose-700 bg-rose-100/80 border border-rose-300 px-1 py-0.2 rounded font-bold" id="fork-branch-badge">
                PERTURBED
              </span>
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between text-rose-900">
                <span>Heart Rate:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-hr">128 bpm (+73%)</span>
              </div>
              <div className="flex justify-between text-rose-900">
                <span>Blood Pressure:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-bp">84 / 52 mmHg</span>
              </div>
              <div className="flex justify-between text-rose-900">
                <span>MAP:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-map">62.6 mmHg (-28.7)</span>
              </div>
              <div className="flex justify-between text-rose-900">
                <span>Cardiac Output:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-co">3.35 L/min (-38%)</span>
              </div>
              <div className="flex justify-between text-rose-900">
                <span>Stroke Volume:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-sv">26 mL (-64%)</span>
              </div>
              <div className="flex justify-between text-rose-900">
                <span>Shock Index:</span>
                <span className="text-rose-700 font-bold" id="fork-interv-si">1.52 (High Risk)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status / Scenario summary */}
        <div className="px-2 py-1 bg-slate-50 border border-surface-border rounded text-[9px] text-text-dim flex items-center justify-between">
          <span id="fork-scenario-note">Scenario: Hemorrhagic Shock (-35% Volume)</span>
          <span className="text-emerald-700 font-bold" id="fork-stability-score">Stability: 0.94</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-surface-border">
          <button
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-text-muted text-[10px] transition-colors font-medium cursor-pointer"
            id="btn-cancel-fork"
            type="button"
            onClick={onClose}
          >
            Dismiss
          </button>
          <button
            className="px-3 py-1 rounded bg-clinical-cyan hover:bg-sky-700 text-white text-[10px] font-bold transition-colors shadow-xs cursor-pointer"
            id="btn-commit-fork"
            type="button"
            onClick={() => {
              onDeployBranchB();
              onClose();
            }}
          >
            Deploy Branch B to Cockpit
          </button>
        </div>
      </div>
    </div>
  );
};
