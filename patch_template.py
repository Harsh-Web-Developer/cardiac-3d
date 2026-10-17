import sys

with open('frontend/stitch_reference.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add ML button to footer
old_footer_btns = '''<!-- Button 3: Reset Patient -->
<button class="px-2 py-0.5 rounded bg-white hover:bg-rose-50 hover:text-clinical-rose text-text-muted border border-surface-border flex items-center gap-1 transition-colors font-medium shadow-xs" id="btn-reset-patient" type="button">
<span class="material-symbols-outlined text-[13px]">device_reset</span>
<span class="">Reset Patient</span>
</button>'''

new_footer_btns = '''<!-- Button 3: ML Inference Estimation -->
<button class="px-2.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors font-semibold shadow-xs" id="btn-open-ml" type="button">
<span class="material-symbols-outlined text-[13px] text-emerald-700">psychology</span>
<span>ML Parameter Inference</span>
</button>
<!-- Button 4: Reset Patient -->
<button class="px-2 py-0.5 rounded bg-white hover:bg-rose-50 hover:text-clinical-rose text-text-muted border border-surface-border flex items-center gap-1 transition-colors font-medium shadow-xs" id="btn-reset-patient" type="button">
<span class="material-symbols-outlined text-[13px]">device_reset</span>
<span>Reset Patient</span>
</button>'''

if old_footer_btns in html:
    html = html.replace(old_footer_btns, new_footer_btns)
else:
    print("Warning: old_footer_btns not found directly, checking variations...")

# 2. Add IDs to RAG drawer input & button & chat list
old_rag_chat = '''<!-- Content Chat -->
<div class="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 font-mono text-xs bg-[#f8fafc]">'''
new_rag_chat = '''<!-- Content Chat -->
<div class="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5 font-mono text-xs bg-[#f8fafc]" id="rag-chat-messages">'''
if old_rag_chat in html:
    html = html.replace(old_rag_chat, new_rag_chat)

old_rag_input = '''<!-- Prompt Input -->
<div class="p-2 bg-white border-t border-surface-border flex items-center gap-1.5 shadow-inner">
<input class="flex-1 bg-slate-50 border border-surface-border px-2.5 py-1.5 rounded text-[10px] font-mono text-text-primary placeholder:text-text-dim outline-none focus:border-clinical-cyan focus:bg-white transition-all" placeholder="Inquire about pressure drops, baroreflex, or valve gradients..." type="text">
<button class="w-7 h-7 rounded bg-clinical-cyan text-white flex items-center justify-center hover:bg-sky-700 transition-colors shrink-0 shadow-xs" type="button">
<span class="material-symbols-outlined text-[14px]">send</span>
</button>
</div>'''

new_rag_input = '''<!-- Prompt Input -->
<div class="p-2 bg-white border-t border-surface-border flex items-center gap-1.5 shadow-inner">
<input id="rag-input-text" class="flex-1 bg-slate-50 border border-surface-border px-2.5 py-1.5 rounded text-[10px] font-mono text-text-primary placeholder:text-text-dim outline-none focus:border-clinical-cyan focus:bg-white transition-all" placeholder="Inquire about pressure drops, baroreflex, or valve gradients..." type="text">
<button id="btn-send-rag" class="w-7 h-7 rounded bg-clinical-cyan text-white flex items-center justify-center hover:bg-sky-700 transition-colors shrink-0 shadow-xs" type="button">
<span class="material-symbols-outlined text-[14px]">send</span>
</button>
</div>'''
if old_rag_input in html:
    html = html.replace(old_rag_input, new_rag_input)

# 3. Add ML modal HTML before modal-fork
ml_modal_html = '''<!-- ========================================================================= -->
<!-- MODAL: ML PARAMETER INFERENCE (PHYSICAL RECONSTRUCTION)                 -->
<!-- ========================================================================= -->
<div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs hidden items-center justify-center p-3" id="modal-ml">
  <div class="w-full max-w-xl bg-white border border-surface-border rounded-lg shadow-2xl p-4 flex flex-col gap-3 font-mono">
    <div class="flex items-center justify-between pb-2 border-b border-surface-border">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-emerald-600 text-[20px]">psychology</span>
        <div class="flex flex-col leading-none">
          <span class="text-xs font-bold text-text-primary">Cardia ML Inverse Parameter Inference</span>
          <span class="text-[9px] text-text-dim">Real-time observable-to-state latent predictor</span>
        </div>
      </div>
      <button class="w-6 h-6 rounded hover:bg-slate-100 text-text-dim hover:text-text-primary flex items-center justify-center transition-colors" id="btn-close-ml" type="button">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
    
    <div class="bg-slate-50 p-2.5 rounded border border-surface-border flex flex-col gap-1.5 text-xs">
      <div class="text-[10px] font-bold text-text-dim uppercase tracking-wider">Observables fed into ML model:</div>
      <div class="grid grid-cols-5 gap-2 text-[10px]">
        <div class="bg-white p-1.5 rounded border border-surface-border text-center">
          <div class="text-text-dim text-[8px]">HR</div>
          <div class="font-bold text-clinical-cyan" id="ml-obs-hr">--</div>
        </div>
        <div class="bg-white p-1.5 rounded border border-surface-border text-center">
          <div class="text-text-dim text-[8px]">SBP</div>
          <div class="font-bold text-text-primary" id="ml-obs-sbp">--</div>
        </div>
        <div class="bg-white p-1.5 rounded border border-surface-border text-center">
          <div class="text-text-dim text-[8px]">DBP</div>
          <div class="font-bold text-text-primary" id="ml-obs-dbp">--</div>
        </div>
        <div class="bg-white p-1.5 rounded border border-surface-border text-center">
          <div class="text-text-dim text-[8px]">EDV</div>
          <div class="font-bold text-clinical-teal" id="ml-obs-edv">--</div>
        </div>
        <div class="bg-white p-1.5 rounded border border-surface-border text-center">
          <div class="text-text-dim text-[8px]">ESV</div>
          <div class="font-bold text-clinical-teal" id="ml-obs-esv">--</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2.5 text-xs">
      <div class="bg-emerald-50/70 border border-emerald-200 rounded p-2.5 flex flex-col gap-1">
        <span class="text-[9px] text-emerald-800 font-bold uppercase">Inferred Blood Volume</span>
        <div class="text-lg font-bold text-emerald-700" id="ml-inf-vol">-- <span class="text-xs font-normal">L</span></div>
        <span class="text-[8px] text-emerald-900/80" id="ml-sim-vol">Sim true: -- L</span>
      </div>
      <div class="bg-emerald-50/70 border border-emerald-200 rounded p-2.5 flex flex-col gap-1">
        <span class="text-[9px] text-emerald-800 font-bold uppercase">Inferred Contractility</span>
        <div class="text-lg font-bold text-emerald-700" id="ml-inf-contract">-- <span class="text-xs font-normal">x</span></div>
        <span class="text-[8px] text-emerald-900/80" id="ml-sim-contract">Sim true: -- x</span>
      </div>
      <div class="bg-emerald-50/70 border border-emerald-200 rounded p-2.5 flex flex-col gap-1">
        <span class="text-[9px] text-emerald-800 font-bold uppercase">Inferred SVR</span>
        <div class="text-lg font-bold text-emerald-700" id="ml-inf-svr">-- <span class="text-xs font-normal">dyn·s</span></div>
        <span class="text-[8px] text-emerald-900/80" id="ml-sim-svr">Sim true: --</span>
      </div>
    </div>

    <div class="flex items-center justify-between pt-2 border-t border-surface-border text-[10px]">
      <span class="text-text-dim" id="ml-status-text">Ready to infer parameters.</span>
      <div class="flex gap-2">
        <button class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-text-muted transition-colors font-medium" id="btn-dismiss-ml" type="button">Dismiss</button>
        <button class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs" id="btn-run-ml" type="button">Run ML Inference</button>
      </div>
    </div>
  </div>
</div>
'''

target_fork = '<div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs hidden items-center justify-center p-3" id="modal-fork">'
if target_fork in html:
    html = html.replace(target_fork, ml_modal_html + '\n' + target_fork)

# Write template
with open('frontend/stitched_template.html', 'w', encoding='utf-8') as out:
    out.write(html)

print("Wrote frontend/stitched_template.html successfully!")
