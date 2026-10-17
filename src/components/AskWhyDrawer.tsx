import React, { useState } from 'react';
import { LiveMetrics, RAGMessage } from '../types/cardiac';

interface AskWhyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  live: LiveMetrics;
  hr: number;
}

export const AskWhyDrawer: React.FC<AskWhyDrawerProps> = ({
  isOpen,
  onClose,
  live,
  hr,
}) => {
  const [aiOffline, setAiOffline] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<RAGMessage[]>([
    {
      id: '1',
      sender: 'user',
      timestamp: 'T+00:42:19',
      text: 'Why did cardiac output fall during acute hemorrhage despite compensatory tachycardia?'
    },
    {
      id: '2',
      sender: 'assistant',
      timestamp: 'T+00:42:20',
      text: 'During acute hypovolemic hemorrhage (-35% effective circulating volume), mean systemic filling pressure (MSFP) drops from 7.0 mmHg to ~3.8 mmHg. This diminishes the venous return pressure gradient.',
      mechanismBullets: [
        'Reduced Venous Return → LV EDV drops (128mL → 84mL)',
        'Starling mechanism decreases Stroke Volume from 73mL to 41mL (-44%)',
        'Baroreflex induces compensatory tachycardia (HR 74 → 112 bpm)',
        'Net CO = 112 bpm × 0.041 L = 4.59 L/min (-15% to -25%)'
      ],
      sources: ['Guyton & Hall §19.3', 'Cardiovascular Dynamics p. 142'],
      confidence: 0.942
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSend = () => {
    const q = inputValue.trim();
    if (!q) return;

    if (aiOffline) {
      alert("AI Explanation Core is currently in simulated fallback mode.");
      return;
    }

    const userMsg: RAGMessage = {
      id: Date.now().toString(),
      sender: 'user',
      timestamp: 'Just now',
      text: q
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsGenerating(true);

    setTimeout(() => {
      // Dynamic response grounded in current simulation state
      const isShock = live.sbp < 90 || live.ef < 45 || live.co < 4.0;
      const isHypertensive = live.sbp > 140 || live.dbp > 90;
      
      let answerText = '';
      let bullets: string[] = [];
      let ref = 'Guyton & Hall §20.1';

      if (q.toLowerCase().includes('pressure') || q.toLowerCase().includes('bp') || isHypertensive) {
        answerText = `Systemic arterial pressure is currently tracking at ${Math.round(live.sbp)}/${Math.round(live.dbp)} mmHg (MAP ${live.map} mmHg). The pressure profile reflects systemic vascular resistance and stroke volume ejection into the elastic aortic root.`;
        bullets = [
          `End-Systolic Elastance (Ees) slope: ${((live.sbp - 10) / Math.max(20, live.esv)).toFixed(2)} mmHg/mL`,
          `Effective Arterial Elastance (Ea): ${(live.sbp / Math.max(15, live.sv)).toFixed(2)} mmHg/mL`,
          `Ventriculo-Arterial Coupling ratio (Ea/Ees): ${((live.sbp / Math.max(15, live.sv)) / ((live.sbp - 10) / Math.max(20, live.esv))).toFixed(2)}`,
          `Coronary Perfusion Pressure (CPP): ${live.cpp} mmHg (${live.cpp >= 50 ? 'Adequate myocardial perfusion' : 'Compromised subendocardial perfusion'})`
        ];
        ref = 'Guyton & Hall §18.2 (Windkessel Dynamics)';
      } else if (q.toLowerCase().includes('valve') || q.toLowerCase().includes('mitral') || q.toLowerCase().includes('aortic')) {
        answerText = `Cardiac valvular transitions are strictly governed by transvalvular pressure differentials across the left and right ventricular chambers.`;
        bullets = [
          `Aortic Valve: ${live.valves.aortic.is_open ? 'OPEN (Systolic ejection phase, LV pressure exceeds aortic root pressure)' : 'CLOSED (Diastolic runoff, aortic valve seated by backward pressure)'}`,
          `Mitral Valve: ${live.valves.mitral.is_open ? 'OPEN (Diastolic chamber filling from left atrium)' : 'CLOSED (Isovolumetric contraction and ejection)'}`,
          `Stroke Volume: ${live.sv} mL per beat`,
          `Ejection Fraction: ${live.ef}%`
        ];
        ref = 'Katz Physiology of the Heart, Ch. 12';
      } else {
        answerText = `Under current operating telemetry (HR: ${Math.round(hr)} BPM, CO: ${live.co} L/min, EDV: ${live.edv} mL, ESV: ${live.esv} mL), the myocardial syncytium balances preload filling with afterload impedance according to the Frank-Starling mechanism.`;
        bullets = [
          `Left Ventricular Work: ${((live.sv * (live.map - 10) * 0.1333) / 100).toFixed(2)} Joules/beat`,
          `Myocardial Oxygen Consumption (MVO2): ${live.mvo2} mL/min/100g`,
          `End-Diastolic Preload reserve: ${live.edv > 120 ? 'Optimal chamber stretch' : 'Reduced preload gradient'}`,
          `Status: ${isShock ? 'Decompensated or High-Risk State' : 'Physiologically Compensated'}`
        ];
        ref = 'Guyton & Hall §9.4 (Muscle Mechanics)';
      }

      const botMsg: RAGMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        timestamp: 'Just now',
        text: answerText,
        mechanismBullets: bullets,
        sources: [ref, 'CARDIA Hemodynamic Engine v2.4'],
        confidence: 0.95
      };

      setMessages(prev => [...prev, botMsg]);
      setIsGenerating(false);
    }, 600);
  };

  return (
    <div
      className={`fixed bottom-8 right-0 top-11 w-full max-w-md bg-white/98 backdrop-blur-xl border-l border-surface-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      id="drawer-ask-why"
    >
      {/* Header */}
      <div className="p-3 bg-slate-50 border-b border-surface-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-sky-100 border border-sky-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-clinical-cyan text-[14px]">neurology</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-xs font-bold text-text-primary">Physiology Reasoning Core</span>
            <span className="font-mono text-[9px] text-text-dim">CARDIA In-Silico Copilot • v2.4</span>
          </div>
        </div>
        <button
          className="w-6 h-6 rounded hover:bg-slate-200/70 text-text-dim hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
          id="btn-close-ask-why"
          type="button"
          onClick={onClose}
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      {/* Status / Offline fallback banner toggle */}
      <div className="px-3 py-1.5 bg-slate-50/70 border-b border-surface-border flex items-center justify-between font-mono text-[9px] shrink-0">
        <span className="text-text-dim font-medium">
          Service: <span className={aiOffline ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>{aiOffline ? 'Simulated Fallback' : 'Connected'}</span>
        </span>
        <button
          className="text-text-muted hover:text-clinical-rose uppercase transition-colors font-medium cursor-pointer"
          id="btn-toggle-ai-err"
          type="button"
          onClick={() => setAiOffline(!aiOffline)}
        >
          {aiOffline ? 'RESTORE SERVICE' : 'SIMULATE FALLBACK'}
        </button>
      </div>

      {/* Content Chat */}
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 font-mono text-xs bg-[#f8fafc]" id="rag-chat-messages">
        {/* Offline Fallback Alert */}
        {aiOffline && (
          <div className="p-2 bg-rose-50 border border-rose-200 rounded flex items-start gap-2 shadow-xs" id="ai-error-banner">
            <span className="material-symbols-outlined text-clinical-rose text-[16px] shrink-0 mt-0.5">cloud_off</span>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-rose-700 text-[10px]">Explanation Core Offline</span>
              <p className="text-[9px] text-rose-600 leading-tight">
                Simulation running uninterrupted. Local differential equation solver active without real-time narrative rationale.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-1 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className={`text-[8px] font-medium ${m.sender === 'user' ? 'text-text-dim' : 'text-emerald-700 font-bold flex items-center gap-1'}`}>
              {m.sender === 'user' ? (
                `Investigator (${m.timestamp})`
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-clinical-emerald"></span> Grounded Hemodynamic Rationale
                </>
              )}
            </span>
            <div
              className={`rounded-lg p-3 text-[11px] leading-relaxed shadow-xs ${
                m.sender === 'user'
                  ? 'bg-white border border-surface-border max-w-[90%] text-text-primary'
                  : 'bg-white border border-surface-border max-w-[95%] text-text-primary flex flex-col gap-2 shadow-sm'
              }`}
            >
              <p className="text-slate-700 whitespace-pre-line">{m.text}</p>
              {m.mechanismBullets && m.mechanismBullets.length > 0 && (
                <div className="p-2 bg-sky-50/70 rounded border border-sky-200/70 text-[10px] text-sky-900 flex flex-col gap-1 font-medium">
                  {m.mechanismBullets.map((bullet, idx) => (
                    <span key={idx}>• {bullet}</span>
                  ))}
                </div>
              )}
              {m.sources && (
                <div className="pt-1.5 flex items-center justify-between text-[9px] text-text-dim border-t border-surface-border font-medium">
                  <span>Ref: {m.sources.join(', ')}</span>
                  {m.confidence && (
                    <span className="text-emerald-700 font-semibold">
                      Confidence: {(m.confidence * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-[8px] text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-clinical-emerald animate-ping"></span> Retrieving physiological evidence...
            </span>
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <div className="p-2 bg-white border-t border-surface-border flex items-center gap-1.5 shadow-inner shrink-0">
        <input
          id="rag-input-text"
          className="flex-1 bg-slate-50 border border-surface-border px-2.5 py-1.5 rounded text-[10px] font-mono text-text-primary placeholder:text-text-dim outline-none focus:border-clinical-cyan focus:bg-white transition-all"
          placeholder="Inquire about pressure drops, baroreflex, or valve gradients..."
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button
          id="btn-send-rag"
          className="w-7 h-7 rounded bg-clinical-cyan text-white flex items-center justify-center hover:bg-sky-700 transition-colors shrink-0 shadow-xs cursor-pointer"
          type="button"
          onClick={handleSend}
        >
          <span className="material-symbols-outlined text-[14px]">send</span>
        </button>
      </div>
    </div>
  );
};
