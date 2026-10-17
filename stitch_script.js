<script>
(function() {
  window.__CARDIA_STATE = {
    // Patient Profile
    patient: {
      sex: "MALE",
      age: 48,
      weight: 74,
      height: 178,
      bsa: 1.91,
      state: "Euvolemic"
    },
    // Hemodynamics
    hr: 74,
    bloodVolume: 5.0,
    contractility: 1.0,
    svr: 1120,
    targetSbp: 118,
    targetDbp: 78,
    running: true,
    speed: 1.0,
    isOffline: false,
    aiOffline: false,
    cyclePhase: 0,
    lastFrameTime: performance.now(),
    // 3D Cardiac view controls
    viewRotX: 0.2,
    viewRotY: -0.4,
    viewZoom: 1.0
  };

  const state = window.__CARDIA_STATE;

  // DOM Handles - Tabs
  const tabBtnPatient = document.getElementById('tab-btn-patient');
  const tabBtnKnobs = document.getElementById('tab-btn-knobs');
  const viewPatientProfile = document.getElementById('view-patient-profile');
  const viewPerturbations = document.getElementById('view-perturbations');

  if (tabBtnPatient && tabBtnKnobs) {
    tabBtnPatient.addEventListener('click', () => {
      tabBtnPatient.className = "px-2 py-0.5 rounded font-bold transition-all bg-white text-clinical-cyan shadow-xs";
      tabBtnKnobs.className = "px-2 py-0.5 rounded text-text-dim hover:text-text-primary transition-all";
      viewPatientProfile.classList.remove('hidden');
      viewPerturbations.classList.add('hidden');
    });
    tabBtnKnobs.addEventListener('click', () => {
      tabBtnKnobs.className = "px-2 py-0.5 rounded font-bold transition-all bg-white text-clinical-cyan shadow-xs";
      tabBtnPatient.className = "px-2 py-0.5 rounded text-text-dim hover:text-text-primary transition-all";
      viewPerturbations.classList.remove('hidden');
      viewPatientProfile.classList.add('hidden');
    });
  }

  // Patient Profile interactive fields
  const sexBtns = document.querySelectorAll('.sex-btn');
  sexBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sexBtns.forEach(b => {
        b.className = "px-2 py-0.5 rounded text-text-dim hover:text-text-primary transition-all sex-btn";
      });
      btn.className = "px-2 py-0.5 rounded bg-clinical-cyan text-white font-bold transition-all sex-btn";
      state.patient.sex = btn.getAttribute('data-sex');
      flashSync();
    });
  });

  const inAge = document.getElementById('input-patient-age');
  const inWeight = document.getElementById('input-patient-weight');
  const inHeight = document.getElementById('input-patient-height');
  const dispBsa = document.getElementById('disp-patient-bsa');
  const selectState = document.getElementById('select-patient-state');
  const syncIndicator = document.getElementById('sync-indicator');

  function flashSync() {
    if (syncIndicator) {
      syncIndicator.textContent = "SAVED";
      syncIndicator.className = "text-[8px] text-clinical-cyan font-semibold";
      setTimeout(() => {
        syncIndicator.textContent = "SYNCED";
        syncIndicator.className = "text-[8px] text-emerald-700 font-semibold";
      }, 700);
    }
  }

  function recalcPatientBSA() {
    const w = parseFloat(inWeight.value) || 74;
    const h = parseFloat(inHeight.value) || 178;
    // Mosteller formula: BSA = sqrt( (h * w) / 3600 )
    const bsa = Math.sqrt((h * w) / 3600).toFixed(2);
    state.patient.weight = w;
    state.patient.height = h;
    state.patient.bsa = bsa;
    if (dispBsa) dispBsa.textContent = `${bsa} m²`;
    flashSync();
  }

  if (inAge) inAge.addEventListener('change', () => { state.patient.age = inAge.value; flashSync(); });
  if (inWeight) inWeight.addEventListener('input', recalcPatientBSA);
  if (inHeight) inHeight.addEventListener('input', recalcPatientBSA);

  if (selectState) {
    selectState.addEventListener('change', (e) => {
      state.patient.state = e.target.value;
      if (e.target.value === "Hypervolemic") {
        state.bloodVolume = 5.8;
      } else if (e.target.value === "Hypovolemic") {
        state.bloodVolume = 3.8;
      } else if (e.target.value === "Vasodilated") {
        state.svr = 820;
      } else {
        state.bloodVolume = 5.0;
        state.svr = 1120;
      }
      updateInputsFromState();
      updateTelemetryUI();
      flashSync();
    });
  }

  // Target Editable Vitals Controls
  const editHr = document.getElementById('edit-target-hr');
  const editSbp = document.getElementById('edit-target-sbp');
  const editDbp = document.getElementById('edit-target-dbp');
  const editVol = document.getElementById('edit-target-vol');
  const btnApplyVitals = document.getElementById('btn-apply-vitals');

  const hrInc = document.getElementById('hr-inc');
  const hrDec = document.getElementById('hr-dec');
  const volInc = document.getElementById('vol-inc');
  const volDec = document.getElementById('vol-dec');

  if (editHr) editHr.addEventListener('input', () => {
    state.hr = parseInt(editHr.value, 10) || 74;
    updateTelemetryUI();
  });
  if (hrInc) hrInc.addEventListener('click', () => {
    state.hr = Math.min(180, state.hr + 5);
    editHr.value = state.hr;
    updateTelemetryUI();
  });
  if (hrDec) hrDec.addEventListener('click', () => {
    state.hr = Math.max(40, state.hr - 5);
    editHr.value = state.hr;
    updateTelemetryUI();
  });

  if (editVol) editVol.addEventListener('input', () => {
    state.bloodVolume = parseFloat(editVol.value) || 5.0;
    updateTelemetryUI();
  });
  if (volInc) volInc.addEventListener('click', () => {
    state.bloodVolume = Math.min(7.0, +(state.bloodVolume + 0.2).toFixed(1));
    editVol.value = state.bloodVolume;
    updateTelemetryUI();
  });
  if (volDec) volDec.addEventListener('click', () => {
    state.bloodVolume = Math.max(3.0, +(state.bloodVolume - 0.2).toFixed(1));
    editVol.value = state.bloodVolume;
    updateTelemetryUI();
  });

  if (editSbp) editSbp.addEventListener('input', () => {
    state.targetSbp = parseInt(editSbp.value, 10) || 120;
    updateTelemetryUI();
  });
  if (editDbp) editDbp.addEventListener('input', () => {
    state.targetDbp = parseInt(editDbp.value, 10) || 80;
    updateTelemetryUI();
  });

  if (btnApplyVitals) {
    btnApplyVitals.addEventListener('click', () => {
      flashSync();
      updateTelemetryUI();
    });
  }

  // Perturbation Sliders
  const sliderHr = document.getElementById('slider-hr');
  const sliderVol = document.getElementById('slider-vol');
  const sliderContract = document.getElementById('slider-contract');
  const sliderSvr = document.getElementById('slider-svr');

  const valHr = document.getElementById('val-hr');
  const valVol = document.getElementById('val-vol');
  const valContract = document.getElementById('val-contract');
  const valSvr = document.getElementById('val-svr');

  const statMap = document.getElementById('stat-map');
  const statCo = document.getElementById('stat-co');
  const statSv = document.getElementById('stat-sv');

  const dispLiveHr = document.getElementById('disp-live-hr');
  const dispLiveBp = document.getElementById('disp-live-bp');
  const dispLiveCo = document.getElementById('disp-live-co');

  const hudEdv = document.getElementById('hud-edv');
  const hudEsv = document.getElementById('hud-esv');
  const hudEf = document.getElementById('hud-ef');
  const hudEfStatus = document.getElementById('hud-ef-status');
  const hudContractVal = document.getElementById('hud-contract-val');
  const hudSvrVal = document.getElementById('hud-svr-val');
  const hudCpp = document.getElementById('hud-cpp');
  const hudMvo2 = document.getElementById('hud-mvo2');
  const barCpp = document.getElementById('bar-cpp');

  const valveMitral = document.getElementById('valve-mitral');
  const valveAortic = document.getElementById('valve-aortic');
  const valveTricuspid = document.getElementById('valve-tricuspid');
  const valvePulmonic = document.getElementById('valve-pulmonic');
  const gaugeContractilityCircle = document.getElementById('gauge-contractility-circle');

  // Canvases
  const canvasEcg = document.getElementById('canvas-ecg');
  const sweepLine = document.getElementById('ecg-sweep-line');
  const canvasPv = document.getElementById('canvas-pv');
  const canvasFlow = document.getElementById('canvas-pressure-flow');
  const canvas3d = document.getElementById('canvas-cardiac-3d');

  function resizeCanvas(c) {
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (c.width !== Math.floor(rect.width) || c.height !== Math.floor(rect.height)) {
      c.width = Math.floor(rect.width);
      c.height = Math.floor(rect.height);
    }
  }

  function calculateHemodynamics() {
    const hr = state.hr;
    const volRatio = state.bloodVolume / 5.0;
    const contract = state.contractility;
    const svr = state.svr;

    const edv = Math.round(128 * volRatio * (1 - (hr - 74) * 0.002));
    const esv = Math.round(Math.max(20, (55 / contract) * (svr / 1120) * 0.8));
    const sv = Math.max(15, edv - esv);
    const ef = Math.min(95, Math.max(15, ((sv / edv) * 100)));
    const co = (hr * sv) / 1000;

    const map = Math.round((co * (svr / 80)) * 0.133);
    const pulsePressure = Math.round((sv / 1.1) * (svr / 1120) * 0.7);
    const sbp = Math.round(map + (pulsePressure * 0.6));
    const dbp = Math.round(map - (pulsePressure * 0.4));

    const cpp = Math.max(10, dbp - 10);
    const mvo2 = (co * (sbp / 100) * 1.5).toFixed(1);

    return { edv, esv, sv, ef, co, sbp, dbp, map, cpp, mvo2 };
  }

  function updateInputsFromState() {
    if (sliderHr) sliderHr.value = state.hr;
    if (sliderVol) sliderVol.value = state.bloodVolume;
    if (sliderContract) sliderContract.value = state.contractility;
    if (sliderSvr) sliderSvr.value = state.svr;

    if (editHr) editHr.value = state.hr;
    if (editVol) editVol.value = state.bloodVolume.toFixed(1);
  }

  function updateTelemetryUI() {
    const h = calculateHemodynamics();

    // Update Editable inputs & displays
    if (statMap) statMap.textContent = h.map.toFixed(1);
    if (statCo) statCo.textContent = h.co.toFixed(2);
    if (statSv) statSv.textContent = h.sv.toFixed(1);

    if (editSbp) editSbp.value = h.sbp;
    if (editDbp) editDbp.value = h.dbp;
    if (editHr && document.activeElement !== editHr) editHr.value = state.hr;
    if (editVol && document.activeElement !== editVol) editVol.value = state.bloodVolume.toFixed(1);

    // Right Column Live Top Bar
    if (dispLiveHr) dispLiveHr.textContent = state.hr;
    if (dispLiveBp) dispLiveBp.textContent = `${h.sbp}/${h.dbp}`;
    if (dispLiveCo) dispLiveCo.textContent = h.co.toFixed(2);

    // Left Slider Numeric Displays
    if (valHr) valHr.textContent = state.hr;
    if (valVol) valVol.textContent = Number(state.bloodVolume).toFixed(1);
    if (valContract) valContract.textContent = Number(state.contractility).toFixed(2);
    if (valSvr) valSvr.textContent = state.svr;

    // Center HUD Displays
    if (hudEdv) hudEdv.textContent = h.edv;
    if (hudEsv) hudEsv.textContent = h.esv;
    if (hudEf) hudEf.textContent = h.ef.toFixed(1);

    if (hudEfStatus) {
      if (h.ef < 40) {
        hudEfStatus.textContent = "LOW EF (FAIL)";
        hudEfStatus.className = "font-mono text-[7px] text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 font-bold";
      } else if (h.ef > 75) {
        hudEfStatus.textContent = "HYPERDYNAMIC";
        hudEfStatus.className = "font-mono text-[7px] text-clinical-cyan bg-sky-50 px-1 py-0.2 rounded border border-sky-200 font-bold";
      } else {
        hudEfStatus.textContent = "NORMAL EF";
        hudEfStatus.className = "font-mono text-[7px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-bold";
      }
    }

    if (hudContractVal) hudContractVal.textContent = Number(state.contractility).toFixed(1) + 'x';
    if (hudSvrVal) hudSvrVal.textContent = state.svr;
    if (hudCpp) hudCpp.textContent = h.cpp;
    if (hudMvo2) hudMvo2.textContent = h.mvo2;

    if (gaugeContractilityCircle) {
      const pct = Math.min(100, Math.max(10, (state.contractility / 2.0) * 100));
      gaugeContractilityCircle.setAttribute('stroke-dasharray', `${pct}, 100`);
    }

    if (barCpp) {
      const cppPct = Math.min(100, Math.max(10, (h.cpp / 100) * 100));
      barCpp.style.height = `${cppPct}%`;
    }
  }

  // Slider bindings
  if (sliderHr) sliderHr.addEventListener('input', e => { state.hr = parseInt(e.target.value, 10); updateTelemetryUI(); });
  if (sliderVol) sliderVol.addEventListener('input', e => { state.bloodVolume = parseFloat(e.target.value); updateTelemetryUI(); });
  if (sliderContract) sliderContract.addEventListener('input', e => { state.contractility = parseFloat(e.target.value); updateTelemetryUI(); });
  if (sliderSvr) sliderSvr.addEventListener('input', e => { state.svr = parseInt(e.target.value, 10); updateTelemetryUI(); });

  const btnResetSliders = document.getElementById('btn-reset-sliders');
  if (btnResetSliders) {
    btnResetSliders.addEventListener('click', () => {
      state.hr = 74;
      state.bloodVolume = 5.0;
      state.contractility = 1.0;
      state.svr = 1120;
      updateInputsFromState();
      updateTelemetryUI();
    });
  }

  // Presets
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-preset');
      if (p === 'hemorrhage') {
        state.bloodVolume = 3.25;
        state.hr = 120;
        state.svr = 1680;
        state.contractility = 1.25;
      } else if (p === 'hypertension') {
        state.svr = 1950;
        state.contractility = 1.1;
        state.bloodVolume = 5.3;
      } else if (p === 'tachycardia') {
        state.hr = 145;
        state.contractility = 1.15;
      } else if (p === 'ischemia') {
        state.contractility = 0.55;
        state.svr = 1400;
        state.hr = 95;
      }
      updateInputsFromState();
      updateTelemetryUI();
      flashSync();
    });
  });

  // Playback transport
  const btnRun = document.getElementById('btn-run');
  const btnPause = document.getElementById('btn-pause');
  if (btnRun) {
    btnRun.addEventListener('click', () => {
      state.running = true;
      btnRun.className = "py-1 rounded bg-emerald-600 border border-emerald-600 text-white font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-colors shadow-xs";
      btnPause.className = "py-1 rounded bg-white border border-surface-border hover:bg-slate-50 text-text-muted font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-colors shadow-xs";
    });
  }
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      state.running = false;
      btnPause.className = "py-1 rounded bg-rose-600 border border-rose-600 text-white font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-colors shadow-xs";
      btnRun.className = "py-1 rounded bg-white border border-surface-border hover:bg-slate-50 text-text-muted font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-colors shadow-xs";
    });
  }

  // Simulation Speeds
  const speedBtns = document.querySelectorAll('.speed-btn');
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => {
        b.className = "speed-btn px-1.5 py-0.5 rounded text-[8px] font-mono bg-white border border-surface-border text-text-muted hover:text-text-primary";
      });
      btn.className = "speed-btn px-1.5 py-0.5 rounded text-[8px] font-mono bg-clinical-teal text-white font-bold";
      state.speed = parseFloat(btn.getAttribute('data-speed'));
    });
  });

  // Reset Patient
  const btnResetPatient = document.getElementById('btn-reset-patient');
  if (btnResetPatient) {
    btnResetPatient.addEventListener('click', () => {
      state.hr = 74;
      state.bloodVolume = 5.0;
      state.contractility = 1.0;
      state.svr = 1120;
      state.speed = 1.0;
      state.running = true;
      state.patient = { sex: "MALE", age: 48, weight: 74, height: 178, bsa: 1.91, state: "Euvolemic" };
      if (inAge) inAge.value = 48;
      if (inWeight) inWeight.value = 74;
      if (inHeight) inHeight.value = 178;
      if (dispBsa) dispBsa.textContent = "1.91 m²";
      if (selectState) selectState.value = "Euvolemic";
      sexBtns.forEach(b => {
        if (b.getAttribute('data-sex') === "MALE") {
          b.className = "px-2 py-0.5 rounded bg-clinical-cyan text-white font-bold transition-all sex-btn";
        } else {
          b.className = "px-2 py-0.5 rounded text-text-dim hover:text-text-primary transition-all sex-btn";
        }
      });
      updateInputsFromState();
      updateTelemetryUI();
      flashSync();
    });
  }

  // Drawers & Modals
  const drawerAskWhy = document.getElementById('drawer-ask-why');
  const btnOpenAskWhy = document.getElementById('btn-open-ask-why');
  const btnCloseAskWhy = document.getElementById('btn-close-ask-why');
  const btnToggleAiErr = document.getElementById('btn-toggle-ai-err');
  const aiErrorBanner = document.getElementById('ai-error-banner');

  if (btnOpenAskWhy) btnOpenAskWhy.addEventListener('click', () => drawerAskWhy.classList.remove('translate-x-full'));
  if (btnCloseAskWhy) btnCloseAskWhy.addEventListener('click', () => drawerAskWhy.classList.add('translate-x-full'));
  if (btnToggleAiErr) {
    btnToggleAiErr.addEventListener('click', () => {
      state.aiOffline = !state.aiOffline;
      if (state.aiOffline) {
        aiErrorBanner.classList.remove('hidden');
        btnToggleAiErr.textContent = 'RESTORE SERVICE';
      } else {
        aiErrorBanner.classList.add('hidden');
        btnToggleAiErr.textContent = 'SIMULATE FALLBACK';
      }
    });
  }

  const modalFork = document.getElementById('modal-fork');
  const btnOpenFork = document.getElementById('btn-open-fork');
  const btnCloseFork = document.getElementById('btn-close-fork');
  const btnCancelFork = document.getElementById('btn-cancel-fork');
  const btnCommitFork = document.getElementById('btn-commit-fork');

  function hideFork() {
    modalFork.classList.add('hidden');
    modalFork.classList.remove('flex');
  }
  if (btnOpenFork) btnOpenFork.addEventListener('click', () => {
    modalFork.classList.remove('hidden');
    modalFork.classList.add('flex');
  });
  if (btnCloseFork) btnCloseFork.addEventListener('click', hideFork);
  if (btnCancelFork) btnCancelFork.addEventListener('click', hideFork);
  if (btnCommitFork) {
    btnCommitFork.addEventListener('click', () => {
      state.bloodVolume = 3.25;
      state.hr = 128;
      state.contractility = 1.3;
      state.svr = 1750;
      updateInputsFromState();
      updateTelemetryUI();
      hideFork();
    });
  }

  // =========================================================================
  // 3D CARDIAC TWIN CANVAS ENGINE (RENDERED WIREFRAME + MYOCARDIUM BEAT)
  // =========================================================================
  let isDragging3D = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  if (canvas3d) {
    canvas3d.addEventListener('mousedown', (e) => {
      isDragging3D = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { isDragging3D = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging3D) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      state.viewRotY += dx * 0.01;
      state.viewRotX = Math.max(-1.2, Math.min(1.2, state.viewRotX + dy * 0.01));
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });
    canvas3d.addEventListener('wheel', (e) => {
      state.viewZoom = Math.max(0.6, Math.min(2.0, state.viewZoom - e.deltaY * 0.001));
      e.preventDefault();
    }, { passive: false });
  }

  // 3D Canvas is handled by CardiaHeart3D (Three.js GLTF & particle physics).
  // Procedural geometry and wireframe meshes removed completely.


  // ==========================================
  // REAL-TIME CANVAS CHARTS (ECG, PV, FLOW)
  // ==========================================
  function getEcgSample(t) {
    if (t < 0.15) return 0;
    if (t < 0.22) {
      const p = (t - 0.15) / 0.07;
      return Math.sin(p * Math.PI) * 0.18;
    }
    if (t < 0.28) return 0;
    if (t < 0.30) return -0.16;
    if (t < 0.35) {
      const r = (t - 0.30) / 0.05;
      return Math.sin(r * Math.PI) * 1.0;
    }
    if (t < 0.38) return -0.28;
    if (t < 0.45) return 0;
    if (t < 0.65) {
      const tw = (t - 0.45) / 0.20;
      return Math.sin(tw * Math.PI) * 0.32;
    }
    return 0;
  }

  const ecgHistory = new Float32Array(300);
  let ecgIndex = 0;

  function renderWaveforms(timestamp) {
    if (!state.running) {
      requestAnimationFrame(renderWaveforms);
      return;
    }

    const dt = (timestamp - state.lastFrameTime) / 1000;
    state.lastFrameTime = timestamp;

    const beatDuration = 60 / (state.hr * state.speed);
    state.cyclePhase = (state.cyclePhase + (dt / beatDuration)) % 1.0;

    // Cardiac pulsation amplitude for 3D view
    let pulseScale = 1.0;
    if (state.cyclePhase < 0.35) {
      pulseScale = 1.0 - 0.12 * Math.sin((state.cyclePhase / 0.35) * Math.PI);
    } else {
      pulseScale = 0.88 + 0.12 * Math.sin(((state.cyclePhase - 0.35) / 0.65) * Math.PI * 0.5);
    }

    // 3D Canvas — Owned by CardiaHeart3D (Three.js WebGLRenderer)


    // Valvular indicators
    if (state.cyclePhase < 0.35) {
      valveMitral.textContent = "CLOSED";
      valveMitral.className = "text-[7px] font-bold text-text-dim";
      valveAortic.textContent = "OPEN";
      valveAortic.className = "text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200";
      valveTricuspid.textContent = "CLOSED";
      valveTricuspid.className = "text-[7px] font-bold text-text-dim";
      valvePulmonic.textContent = "OPEN";
      valvePulmonic.className = "text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200";
    } else {
      valveMitral.textContent = "OPEN";
      valveMitral.className = "text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200";
      valveAortic.textContent = "CLOSED";
      valveAortic.className = "text-[7px] font-bold text-text-dim";
      valveTricuspid.textContent = "OPEN";
      valveTricuspid.className = "text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200";
      valvePulmonic.textContent = "CLOSED";
      valvePulmonic.className = "text-[7px] font-bold text-text-dim";
    }

    // 1. ECG Canvas
    if (canvasEcg) {
      resizeCanvas(canvasEcg);
      const ctx = canvasEcg.getContext('2d');
      if (ctx) {
        const sample = getEcgSample(state.cyclePhase);
        const steps = Math.max(1, Math.round(dt * 120 * state.speed));
        for (let s = 0; s < steps; s++) {
          ecgHistory[ecgIndex] = sample;
          ecgIndex = (ecgIndex + 1) % ecgHistory.length;
        }

        if (sweepLine) {
          sweepLine.style.left = `${(ecgIndex / ecgHistory.length) * 100}%`;
        }

        ctx.clearRect(0, 0, canvasEcg.width, canvasEcg.height);
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = '#0284c7';
        ctx.beginPath();
        const midY = canvasEcg.height * 0.65;
        const scaleX = canvasEcg.width / ecgHistory.length;
        for (let i = 0; i < ecgHistory.length; i++) {
          const y = midY - (ecgHistory[i] * (canvasEcg.height * 0.42));
          if (i === 0) ctx.moveTo(i * scaleX, y);
          else ctx.lineTo(i * scaleX, y);
        }
        ctx.stroke();
      }
    }

    // 2. PV Loop Canvas
    if (canvasPv) {
      resizeCanvas(canvasPv);
      const ctx = canvasPv.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasPv.width, canvasPv.height);
        const h = calculateHemodynamics();
        const w = canvasPv.width;
        const ch = canvasPv.height;

        const sx = vol => (vol / 180) * (w - 24) + 12;
        const sy = press => ch - 10 - (press / 160) * (ch - 20);

        const edvX = sx(h.edv);
        const esvX = sx(h.esv);
        const sbpY = sy(h.sbp);
        const dbpY = sy(h.dbp);
        const edpY = sy(10);

        // Elastance line
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
        ctx.beginPath();
        ctx.moveTo(sx(15), sy(0));
        ctx.lineTo(esvX + 20, sbpY - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Filled PV Area
        ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
        ctx.beginPath();
        ctx.moveTo(esvX, edpY);
        ctx.lineTo(edvX, edpY);
        ctx.lineTo(edvX, dbpY);
        ctx.bezierCurveTo((edvX + esvX)/2, sbpY - 8, esvX, sbpY, esvX, sbpY);
        ctx.lineTo(esvX, edpY);
        ctx.fill();

        // Stroke Loop
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = '#0284c7';
        ctx.beginPath();
        ctx.moveTo(esvX, edpY);
        ctx.lineTo(edvX, edpY);
        ctx.lineTo(edvX, dbpY);
        ctx.bezierCurveTo((edvX + esvX)/2, sbpY - 8, esvX, sbpY, esvX, sbpY);
        ctx.lineTo(esvX, edpY);
        ctx.stroke();

        // Animated traveling marker
        let mx = edvX;
        let my = edpY;
        const cp = state.cyclePhase;
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
    if (canvasFlow) {
      resizeCanvas(canvasFlow);
      const ctx = canvasFlow.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasFlow.width, canvasFlow.height);
        const h = calculateHemodynamics();
        const w = canvasFlow.width;
        const ch = canvasFlow.height;

        // Aortic Pressure
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const frac = ((x / (w * 0.6)) + state.cyclePhase) % 1.0;
          let p = 0;
          if (frac < 0.25) p = Math.sin((frac / 0.25) * Math.PI * 0.5);
          else if (frac < 0.35) p = 0.9 - 0.15 * Math.sin(((frac - 0.25) / 0.10) * Math.PI);
          else p = 0.75 * Math.exp(-(frac - 0.35) * 3.5);

          const y = (ch * 0.78) - (p * (ch * 0.55) * (h.sbp / 130));
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Flow Velocity
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#059669';
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const frac = ((x / (w * 0.6)) + state.cyclePhase) % 1.0;
          let f = 0;
          if (frac < 0.28) f = Math.sin((frac / 0.28) * Math.PI);
          const y = (ch * 0.92) - (f * (ch * 0.58) * (h.co / 5.4));
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    requestAnimationFrame(renderWaveforms);
  }

  updateTelemetryUI();
  requestAnimationFrame(renderWaveforms);
})();
</script>