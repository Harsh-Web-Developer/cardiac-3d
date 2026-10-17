/**
 * CARDIA Heart3D — Anatomical 3D Viewport & Dense Blood Flow Dynamics
 * ==============================================================================
 * 1. Pre-defined external GLTF 3D anatomical heart model loading with fallback chain:
 *    `/models/heart.glb` -> `/heart.glb` -> `/static/models/heart.glb` -> etc.
 * 2. MeshPhysicalMaterial with MATTE MUSCLE TISSUE properties:
 *    - roughness: 0.55 (natural matte muscle, not shiny plastic)
 *    - metalness: 0.0  (fully organic, no metallic sheen)
 *    - No bloom, no intense point lights causing over-exposure
 * 3. Dual-color dense blood flow particle system (720+ particles):
 *    - Bright Red (#FF1A1A) for oxygenated blood (Left Heart: LA -> Mitral -> LV -> Aortic -> Aorta)
 *    - Deep Royal Blue (#0055FF) for deoxygenated blood (Right Heart: RA -> Tricuspid -> RV -> Pulmonic -> PA)
 *    - Anatomically correct pathways through chambers and valves
 *    - Velocity & flow rate synchronized with Heart Rate (BPM) & Cardiac Output sliders
 * 4. OrbitControls for smooth 360-degree rotation, panning, and zooming with inertia damping.
 * 5. Dynamic responsive camera auto-fit preventing clipping and UI card overlap.
 * 6. Clean dark-themed loading spinner and diagnostic error handling.
 * 7. Live 3D anatomical annotations anchored to skeletal joints with live telemetry.
 */

class CardiaHeart3D {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // Model & Animation
    this.model = null;
    this.modelPivot = null;
    this.mixer = null;
    this.animAction = null;
    this.joints = {};

    // Blood flow particle fluid system
    this.particleSystem = null;

    // Lighting
    this.keyLight = null;
    this.fillLight = null;
    this.rimLight = null;
    this.ambientLight = null;
    // NOTE: No intense point lights (valveAccentLight removed to prevent over-exposure)

    // State & Telemetry
    this.isLoaded = false;
    this.lastHR = 74;
    this.lastCO = 5.4;
    this.disposed = false;

    // Fallback orbit tracking if OrbitControls is not loaded
    this._isDragging = false;
    this._prevX = 0;
    this._prevY = 0;
    this._spherical = { radius: 3.2, theta: -0.35, phi: 1.35 };
    this._target = new THREE.Vector3(0, 0, 0);

    // Annotations
    this.showAnnotations = false;
    this.annotationElements = [];
    this.annotationsContainer = null;
    this.annotationsSvg = null;
    this.annotationsDef = [];
    this.activeHoverId = null;
    this._tempVec = new THREE.Vector3();

    // DOM UI
    this.loadingOverlay = null;
  }

  /**
   * Initialize Three.js scene, lighting, controls, particle system, and load GLB model.
   */
  async init() {
    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas) {
      console.error('[CardiaHeart3D] Canvas element not found:', this.canvasId);
      return;
    }

    // 1. Show dark-themed loading spinner overlay inside viewport canvas
    this._createLoadingIndicator();

    // 2. Initialize Three.js Scene
    this.scene = new THREE.Scene();
    // Dark clinical viewport background
    this.scene.background = new THREE.Color(0x070b14);

    this.modelPivot = new THREE.Group();
    this.scene.add(this.modelPivot);

    // 3. Initialize Camera
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(300, rect.width || this.canvas.clientWidth || 500);
    const height = Math.max(300, rect.height || this.canvas.clientHeight || 700);
    const aspect = width / height;

    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.05, 100);
    this.camera.position.set(0, 0.15, 3.2);
    this.camera.lookAt(this._target);

    // 4. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    if (this.renderer.outputColorSpace !== undefined) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    // Reduced tone mapping exposure (1.0 instead of 1.3) to prevent over-bright/blown-out highlights
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // 5. Setup Lighting — matte muscle tissue, NO over-exposure bloom
    this._setupLighting();

    // 6. Enable OrbitControls for smooth 360-degree rotation, panning, and zooming
    this._setupControls();

    // 7. Auto-fit camera responsive to viewport aspect
    this._fitCameraAndAspect();

    // 8. Bind resize & input events
    window.addEventListener('resize', () => this._handleResize());

    // 9. Load Pre-defined GLTF Model with Fallback Chain
    try {
      await this._loadHeartGLTF();
      this._updateLoadingProgress('Initializing blood flow particle dynamics...', 90);

      // 10. Initialize High-Density Blood Flow Particle Fluid System
      this._setupBloodFlowParticles();

      // 11. Setup Anatomical Anchors
      this._setupAnatomicalAnchors();

      // Complete loading
      this._updateLoadingProgress('Ready', 100);
      setTimeout(() => this._removeLoadingIndicator(), 250);

      this.isLoaded = true;
      console.log('[CardiaHeart3D] 3D Heart viewport and blood flow physics initialized successfully.');
    } catch (err) {
      console.error('[CardiaHeart3D] Initialization failed:', err);
      this._showLoadError('3D Heart Unavailable', 'Unable to load GLTF heart model. Ensure heart.glb is served at /models/heart.glb.');
    }

    // 12. Kick off animation loop
    this._animate();
  }

  /**
   * Setup clinical lighting for MATTE MUSCLE TISSUE — no over-exposure, no bloom.
   * Key changes vs previous version:
   *   - Key light intensity reduced from 2.4 → 1.4 (prevents blown-out highlights)
   *   - Fill light reduced from 0.9 → 0.6
   *   - Rim light intensity reduced from 1.3 → 0.9
   *   - REMOVED: valveAccentLight PointLight (was causing interior over-exposure)
   */
  _setupLighting() {
    // Ambient light — cool deep tone, slightly brighter to compensate for dimmer key
    this.ambientLight = new THREE.AmbientLight(0x1e293b, 1.0);
    this.scene.add(this.ambientLight);

    // Key Light — primary directional, reduced intensity for matte tissue (not plastic)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight);

    // Fill Light — soft slate blue fill for anatomical depth
    this.fillLight = new THREE.DirectionalLight(0x64748b, 0.6);
    this.fillLight.position.set(-4, 2, -2);
    this.scene.add(this.fillLight);

    // Rim Light — subtle electric backlight highlighting muscle tissue silhouette
    // Reduced intensity to avoid blinding reflections on model surface
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    this.rimLight.position.set(0, -3, -4);
    this.scene.add(this.rimLight);

    // NOTE: Intentionally NO PointLight inside the model.
    // The previous valveAccentLight was a PointLight(0xffffff, 1.8) positioned at (0.1, 0.2, 0.3)
    // which caused over-bright, over-shining interior gloss. It has been removed.
  }

  /**
   * Setup OrbitControls with damping for smooth 360-degree rotation, zooming, and panning.
   */
  _setupControls() {
    const OrbitControlsClass = THREE.OrbitControls || (window.THREE && window.THREE.OrbitControls);
    if (typeof OrbitControlsClass === 'function') {
      this.controls = new OrbitControlsClass(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.screenSpacePanning = true;
      this.controls.rotateSpeed = 0.8;
      this.controls.zoomSpeed = 1.0;
      this.controls.panSpeed = 0.8;
      this.controls.minDistance = 1.2;
      this.controls.maxDistance = 6.5;
      this.controls.target.set(0, 0.05, 0);
      this.controls.update();
      console.log('[CardiaHeart3D] OrbitControls enabled successfully.');
    } else {
      console.warn('[CardiaHeart3D] THREE.OrbitControls not found on window, falling back to internal spherical orbit.');
      this._bindFallbackInputs();
    }
  }

  /**
   * Clean dark-themed loading indicator inside 3D viewport canvas.
   */
  _createLoadingIndicator() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    let loader = document.getElementById('cardia-3d-loading-overlay');
    if (loader) loader.remove();

    loader = document.createElement('div');
    loader.id = 'cardia-3d-loading-overlay';
    loader.className = 'absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#070b14]/92 backdrop-blur-md transition-opacity duration-300 pointer-events-auto';
    loader.innerHTML = `
      <div class="relative flex items-center justify-center w-16 h-16 mb-2.5">
        <div class="absolute inset-0 rounded-full border-2 border-slate-700/50"></div>
        <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 border-r-rose-500 animate-spin"></div>
        <span class="material-symbols-outlined text-[28px] text-rose-500 animate-pulse drop-shadow-[0_0_10px_rgba(244,63,94,0.7)]">cardiology</span>
      </div>
      <div class="font-mono text-[11px] font-bold text-slate-100 tracking-wider uppercase mb-1">
        Loading 3D Heart Twin
      </div>
      <div id="cardia-3d-load-status" class="font-mono text-[9px] text-slate-400 max-w-[200px] text-center truncate">
        Fetching /models/heart.glb...
      </div>
      <div class="w-40 h-1 bg-slate-800 rounded-full mt-2.5 overflow-hidden border border-slate-700/50">
        <div id="cardia-3d-load-bar" class="h-full bg-gradient-to-r from-sky-400 via-rose-500 to-emerald-400 transition-all duration-150 rounded-full" style="width: 20%"></div>
      </div>
    `;
    parent.appendChild(loader);
    this.loadingOverlay = loader;
  }

  _updateLoadingProgress(statusText, percent) {
    const statusEl = document.getElementById('cardia-3d-load-status');
    const barEl = document.getElementById('cardia-3d-load-bar');
    if (statusEl) statusEl.textContent = statusText;
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(5, percent))}%`;
  }

  _removeLoadingIndicator() {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        if (this.loadingOverlay && this.loadingOverlay.parentElement) {
          this.loadingOverlay.parentElement.removeChild(this.loadingOverlay);
          this.loadingOverlay = null;
        }
      }, 350);
    }
  }

  /**
   * Display dark-themed error banner if model asset fails to load.
   */
  _showLoadError(title, subtitle) {
    this._removeLoadingIndicator();
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    let errEl = document.getElementById('cardia-3d-load-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'cardia-3d-load-error';
      errEl.className = 'absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center pointer-events-auto bg-[#070b14]/90 backdrop-blur-md';
      errEl.innerHTML = `
        <div class="bg-slate-900 border border-rose-500/50 rounded-lg p-4 shadow-2xl font-mono max-w-xs text-center">
          <div class="flex items-center justify-center gap-1.5 text-rose-400 mb-1.5">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span class="text-xs font-bold uppercase tracking-wider">${title}</span>
          </div>
          <p class="text-[10px] text-slate-300 leading-snug mb-3">${subtitle}</p>
          <button id="cardia-3d-retry-btn" class="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono text-[9px] font-bold uppercase tracking-wider transition-colors shadow">
            Retry Loading
          </button>
        </div>
      `;
      parent.appendChild(errEl);

      const retryBtn = document.getElementById('cardia-3d-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          errEl.remove();
          this.init();
        });
      }
    }
  }

  /**
   * Load the 3D GLTF/GLB model from /models/heart.glb with fallback chain.
   * Logs clear console messages if asset path is not found.
   */
  _loadHeartGLTF() {
    return new Promise((resolve, reject) => {
      const LoaderClass = THREE.GLTFLoader || (THREE.Loaders && THREE.Loaders.GLTFLoader);
      if (!LoaderClass) {
        const err = new Error('THREE.GLTFLoader is not available on window. Ensure GLTFLoader.js is loaded before heart3d.js.');
        console.error('[CardiaHeart3D]', err.message);
        reject(err);
        return;
      }
      const loader = new LoaderClass();

      // Candidate paths — primary first, then fallbacks
      const candidatePaths = [
        '/models/heart.glb',
        '/heart.glb',
        '/static/models/heart.glb',
        '/static/assets/heart.glb',
        'models/heart.glb',
        'heart.glb',
        'assets/heart.glb'
      ];

      let candidateIndex = 0;

      const tryLoadCandidate = () => {
        if (candidateIndex >= candidatePaths.length) {
          const finalErr = new Error('Heart 3D model asset could not be loaded from any candidate path.');
          console.error('[CardiaHeart3D] ❌ All asset paths exhausted. Failed to load heart.glb. Paths tried:', candidatePaths);
          reject(finalErr);
          return;
        }

        const url = candidatePaths[candidateIndex];
        console.log(`[CardiaHeart3D] 🔍 Attempting to load heart model from: "${url}" (candidate ${candidateIndex + 1}/${candidatePaths.length})...`);
        this._updateLoadingProgress(`Fetching ${url}...`, 25 + candidateIndex * 10);

        loader.load(
          url,
          (gltf) => {
            console.log(`[CardiaHeart3D] ✅ Successfully loaded heart model from: "${url}"`);
            this._processLoadedGLTF(gltf);
            resolve();
          },
          (progress) => {
            if (progress.total > 0) {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              this._updateLoadingProgress(`Loading model... ${pct}%`, Math.min(85, 30 + Math.round(pct * 0.5)));
            }
          },
          (error) => {
            console.warn(`[CardiaHeart3D] ⚠️ Asset not found at "${url}". Trying next fallback path...`, error.message || error);
            candidateIndex++;
            tryLoadCandidate();
          }
        );
      };

      tryLoadCandidate();
    });
  }

  /**
   * Process loaded GLTF scene:
   * - Center bounding box automatically & scale to fit viewport comfortably
   * - Apply MeshPhysicalMaterial with MATTE MUSCLE TISSUE properties:
   *     roughness: 0.55 — natural muscle tissue, NOT shiny plastic/glass
   *     metalness: 0.0  — fully organic, no metallic reflections
   * - Setup skeletal joints and animation mixer
   */
  _processLoadedGLTF(gltf) {
    this.model = gltf.scene;

    // 1. Calculate bounding box & auto-center
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Scale model so max dimension comfortably fits the viewport frustum (~2.1 units)
    const scaleFactor = 2.1 / (maxDim || 1.0);
    this.model.scale.setScalar(scaleFactor);

    // Center model at origin
    this.model.position.set(
      -center.x * scaleFactor,
      -center.y * scaleFactor + 0.08,
      -center.z * scaleFactor
    );

    // 2. Traverse model: Apply MeshPhysicalMaterial MATTE MUSCLE properties & capture joints
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;

        /**
         * MATTE MUSCLE TISSUE MATERIAL
         * ─────────────────────────────
         * roughness: 0.55  → matte natural muscle (was 0.25 which caused plastic/glass look)
         * metalness: 0.0   → fully organic (was 0.04 which added metallic sheen)
         * clearcoat: 0.10  → very subtle surface moisture without heavy glass gloss (was 0.85)
         * clearcoatRoughness: 0.65 → diffuse clearcoat, not mirror-like (was 0.12)
         * reflectivity: 0.35 → low specular reflectance (was 0.90 causing blinding highlight)
         * ior: 1.36        → water/tissue biological IOR (was 1.42)
         * sheen: 0.25      → subtle fabric-like grazing sheen (was 0.50)
         * NO transmission  → opaque muscle tissue
         */
        const physicalMat = new THREE.MeshPhysicalMaterial({
          map: oldMat.map || null,
          normalMap: oldMat.normalMap || null,
          normalScale: oldMat.normalScale || new THREE.Vector2(1.0, 1.0),
          roughnessMap: oldMat.roughnessMap || null,
          metalnessMap: oldMat.metalnessMap || null,
          aoMap: oldMat.aoMap || null,
          aoMapIntensity: 1.0,
          // ── CORE MATTE TISSUE SETTINGS ──
          roughness: 0.55,          // Natural matte muscle tissue
          metalness: 0.0,           // Fully organic — zero metallic sheen
          clearcoat: 0.10,          // Very subtle wet surface layer (not glassy)
          clearcoatRoughness: 0.65, // Diffuse clearcoat — no mirror reflections
          reflectivity: 0.35,       // Moderate specular reflectance (non-blinding)
          ior: 1.36,                // Biological tissue refractive index
          sheen: 0.25,              // Subtle velvet-like grazing sheen
          sheenColor: new THREE.Color(0xcc3333), // Soft red subsurface edge scatter
          thickness: 1.2,
          attenuationColor: new THREE.Color(0x8a0808),
          attenuationDistance: 2.0,
          transmission: 0.0         // Fully opaque (no SSS transparency)
        });

        // Ensure skinned meshes continue animating properly
        if (child.isSkinnedMesh) {
          physicalMat.skinning = true;
        }
        if (oldMat.morphTargets) {
          physicalMat.morphTargets = true;
        }

        child.material = physicalMat;
        child.frustumCulled = false;
      }

      // Collect joint nodes for skeletal tracking
      if (child.isBone || (child.name && child.name.includes('jnt'))) {
        this.joints[child.name] = child;
      }
    });

    // Add model to pivot group
    this.modelPivot.add(this.model);

    // 3. Setup skeletal beating animation mixer
    if (gltf.animations && gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.model);
      const clip = gltf.animations[0];
      this.animAction = this.mixer.clipAction(clip);
      this.animAction.play();
      this._syncAnimationToHR(74);
    }
  }

  /**
   * Dense & Visible Blood Flow Particle Dynamics (720+ glowing particles)
   * ═══════════════════════════════════════════════════════════════════════
   *
   * DUAL-COLOR BLOOD PARTICLE STREAMS:
   * ────────────────────────────────────
   * Route 1 — OXYGENATED (Left Heart, Bright Red #FF1A1A):
   *   Left Atrium → Mitral Valve → Left Ventricle → Aortic Valve → Ascending Aorta
   *
   * Route 2 — DEOXYGENATED (Right Heart, Royal Blue #0055FF):
   *   Right Atrium → Tricuspid Valve → Right Ventricle → Pulmonic Valve → Pulmonary Artery
   *
   * Waypoints are anatomically placed so particles:
   *   - Do NOT clip through internal walls
   *   - Do NOT flow outside the valve orifices
   *   - Constrict tightly through valve rings, expand in chamber pools
   */
  _setupBloodFlowParticles() {
    // Generate circular glowing sprite texture — bright core with soft saturated halo
    const glowTexture = this._createParticleTexture();

    // ═══════════════════════════════════════════════════
    // ROUTE 1: OXYGENATED — Left Heart (RED #FF1A1A)
    // Anatomical sequence: LA → Mitral Valve → LV → Aortic Valve → Aorta
    // ═══════════════════════════════════════════════════
    const oxWaypoints = [
      new THREE.Vector3( 0.35,  0.68, -0.02),  // Pulmonary vein inflow (into Left Atrium)
      new THREE.Vector3( 0.30,  0.52,  0.12),  // Left Atrium (LA) upper body
      new THREE.Vector3( 0.22,  0.36,  0.16),  // Left Atrium (LA) lower — approaching Mitral
      new THREE.Vector3( 0.18,  0.20,  0.18),  // Mitral Valve orifice (LA → LV junction)
      new THREE.Vector3( 0.14,  0.04,  0.20),  // Left Ventricle (LV) inlet, sub-mitral
      new THREE.Vector3( 0.12, -0.18,  0.20),  // Left Ventricle (LV) mid-body
      new THREE.Vector3( 0.10, -0.34,  0.18),  // Left Ventricle (LV) apex
      new THREE.Vector3( 0.11, -0.16,  0.22),  // LV outflow tract (LVOT) — ascending
      new THREE.Vector3( 0.09,  0.04,  0.23),  // LV outflow tract (LVOT) — upper
      new THREE.Vector3( 0.07,  0.22,  0.22),  // Aortic Valve orifice (LV → Aorta junction)
      new THREE.Vector3( 0.06,  0.42,  0.18),  // Aortic root / sinus of Valsalva
      new THREE.Vector3( 0.04,  0.65,  0.14),  // Ascending Aorta
      new THREE.Vector3( 0.00,  0.86,  0.06),  // Aortic Arch peak
      new THREE.Vector3(-0.14,  0.68, -0.14)   // Descending Aorta outflow
    ];

    // ═══════════════════════════════════════════════════
    // ROUTE 2: DEOXYGENATED — Right Heart (BLUE #0055FF)
    // Anatomical sequence: RA → Tricuspid Valve → RV → Pulmonic Valve → Pulmonary Artery
    // ═══════════════════════════════════════════════════
    const deoxWaypoints = [
      new THREE.Vector3(-0.50,  0.78, -0.02),  // Superior Vena Cava (inflow into RA)
      new THREE.Vector3(-0.44,  0.58,  0.10),  // Right Atrium (RA) upper
      new THREE.Vector3(-0.38,  0.40,  0.16),  // Right Atrium (RA) mid-body
      new THREE.Vector3(-0.30,  0.24,  0.18),  // Right Atrium (RA) lower — approaching Tricuspid
      new THREE.Vector3(-0.25,  0.10,  0.20),  // Tricuspid Valve orifice (RA → RV junction)
      new THREE.Vector3(-0.22, -0.06,  0.22),  // Right Ventricle (RV) inlet, sub-tricuspid
      new THREE.Vector3(-0.20, -0.22,  0.22),  // Right Ventricle (RV) mid-body
      new THREE.Vector3(-0.18, -0.10,  0.24),  // RV outflow tract (infundibulum) — ascending
      new THREE.Vector3(-0.15,  0.10,  0.24),  // RV outflow tract — upper portion
      new THREE.Vector3(-0.12,  0.30,  0.22),  // Pulmonic Valve orifice (RV → PA junction)
      new THREE.Vector3(-0.11,  0.50,  0.18),  // Pulmonary trunk
      new THREE.Vector3(-0.14,  0.68,  0.12),  // Main pulmonary artery
      new THREE.Vector3(-0.28,  0.74,  0.02),  // Left & right pulmonary artery bifurcation
      new THREE.Vector3(-0.40,  0.70, -0.08)   // Pulmonary artery outflow to lungs
    ];

    // Build 3D smooth CatmullRom spline curves
    const oxCurve   = new THREE.CatmullRomCurve3(oxWaypoints);
    const deoxCurve = new THREE.CatmullRomCurve3(deoxWaypoints);

    // 720+ total particles: 360 oxygenated (red) + 360 deoxygenated (blue)
    const NUM_OX   = 360;
    const NUM_DEOX = 360;
    const TOTAL    = NUM_OX + NUM_DEOX;

    const positions = new Float32Array(TOTAL * 3);
    const colors    = new Float32Array(TOTAL * 3);
    const sizes     = new Float32Array(TOTAL);
    const particleData = [];

    // ── Color constants ──
    // Bright Red  #FF1A1A → RGB (1.0, 0.102, 0.102)
    // Royal Blue  #0055FF → RGB (0.0,  0.333, 1.0)
    for (let i = 0; i < TOTAL; i++) {
      const isOx        = i < NUM_OX;
      const curve       = isOx ? oxCurve : deoxCurve;
      const u           = Math.random();                       // Position along spline [0..1]
      const speedJitter = 0.80 + Math.random() * 0.40;        // Per-particle speed variation
      const radiusJitter = Math.random() * 0.048;             // Lateral dispersion radius
      const angle       = Math.random() * Math.PI * 2;        // Angular offset for tube cross-section

      // Balanced particle sizes — visible but not blinding
      // Red particles: 0.075–0.110, Blue particles: 0.070–0.105
      const sizeBase = isOx
        ? 0.075 + Math.random() * 0.035
        : 0.070 + Math.random() * 0.035;

      particleData.push({ isOx, curve, u, speedJitter, radiusJitter, angle, sizeBase });

      // Initialize colors
      if (isOx) {
        // Bright Red #FF1A1A with subtle variation
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = 0.10 + Math.random() * 0.04;   // slight variation: 0.10–0.14
        colors[i * 3 + 2] = 0.10 + Math.random() * 0.04;   // slight variation: 0.10–0.14
      } else {
        // Deep Royal Blue #0055FF with subtle variation
        colors[i * 3 + 0] = 0.00 + Math.random() * 0.04;   // slight variation: 0.00–0.04
        colors[i * 3 + 1] = 0.33 + Math.random() * 0.10;   // slight variation: 0.33–0.43
        colors[i * 3 + 2] = 1.0;
      }
      sizes[i] = sizeBase;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    // Additive blending for glowing effect — particles brighten overlapping regions
    // Opacity 0.92 for soft glow without blinding overexposure
    const material = new THREE.PointsMaterial({
      size: 0.12,
      sizeAttenuation: true,
      map: glowTexture,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    const pointCloud = new THREE.Points(geometry, material);
    pointCloud.frustumCulled = false;
    this.modelPivot.add(pointCloud);

    this.particleSystem = {
      mesh: pointCloud,
      geometry,
      positions,
      colors,
      sizes,
      particles: particleData,
      oxCurve,
      deoxCurve,
      totalCount: TOTAL
    };
  }

  /**
   * Procedural circular glowing particle texture.
   * Bright white core → soft colored halo falloff.
   * Balanced glow — visible but NOT blinding.
   */
  _createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');   // Luminous white core
    grad.addColorStop(0.20, 'rgba(255, 255, 255, 0.80)');  // Bright inner zone
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.40)');  // Soft mid-glow
    grad.addColorStop(0.70, 'rgba(255, 255, 255, 0.12)');  // Very soft outer ring
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 0.00)');  // Transparent edge

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Update particle fluid dynamics every frame.
   *
   * Synchronizes stream velocity, pulsing effect, and flow rate directly with:
   *   - Heart Rate (BPM) slider → particle advection speed
   *   - Cardiac Output (CO)    → base flow rate scale
   *   - Valve state            → energetic acceleration through open valves,
   *                              near-zero velocity when valves are closed
   *
   * Anatomical valve position markers along spline [0..1]:
   *   Oxygenated (Red):   Mitral Valve  ≈ u[0.18–0.32]
   *                       Aortic Valve  ≈ u[0.58–0.72]
   *   Deoxygenated (Blue): Tricuspid    ≈ u[0.20–0.33]
   *                        Pulmonic     ≈ u[0.58–0.70]
   */
  _updateBloodParticles(delta) {
    if (!this.particleSystem) return;

    const state      = window.__CARDIA_STATE;
    const hr         = (state && state.hr)                        || this.lastHR || 74;
    const co         = (state && state.live && state.live.co)     || this.lastCO || 5.4;
    const cyclePhase = (state && state.cyclePhase)                || 0;
    const isRunning  = state ? state.running : true;

    if (!isRunning) return;

    // ── Velocity scaled by HR & CO ──
    const hrScale   = Math.max(30, Math.min(200, hr)) / 74.0;
    const coScale   = Math.max(1.5, Math.min(10.0, co)) / 5.4;
    const baseVelocity = 0.26 * hrScale * coScale;

    // ── Valve states ──
    // Systole  (cyclePhase < 0.35): Aortic & Pulmonic OPEN → blood ejected
    // Diastole (cyclePhase ≥ 0.35): Mitral & Tricuspid OPEN → chambers fill
    const valves         = (state && state.live && state.live.valves) || {};
    const isMitralOpen   = valves.mitral     ? valves.mitral.is_open     : (cyclePhase >= 0.35);
    const isAorticOpen   = valves.aortic     ? valves.aortic.is_open     : (cyclePhase <  0.35);
    const isTricuspidOpen= valves.tricuspid  ? valves.tricuspid.is_open  : (cyclePhase >= 0.35);
    const isPulmonicOpen = valves.pulmonic   ? valves.pulmonic.is_open   : (cyclePhase <  0.35);

    const { particles, positions, colors, sizes, geometry } = this.particleSystem;
    const posVec      = new THREE.Vector3();
    const tangentVec  = new THREE.Vector3();
    const normalVec   = new THREE.Vector3();
    const binormalVec = new THREE.Vector3();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // ── Valve-synchronized flow rate multiplier ──
      // Particles surge through OPEN valves, stagnate through CLOSED valves
      let valveMultiplier = 1.0;

      if (p.isOx) {
        // Left heart — RED particles
        if (p.u >= 0.18 && p.u <= 0.32) {
          // Mitral Valve orifice (LA → LV) — diastolic filling
          valveMultiplier = isMitralOpen ? 2.2 : 0.28;
        } else if (p.u >= 0.58 && p.u <= 0.72) {
          // Aortic Valve orifice (LV → Aorta) — systolic ejection
          valveMultiplier = isAorticOpen ? 2.6 : 0.25;
        }
      } else {
        // Right heart — BLUE particles
        if (p.u >= 0.20 && p.u <= 0.33) {
          // Tricuspid Valve orifice (RA → RV) — diastolic filling
          valveMultiplier = isTricuspidOpen ? 2.2 : 0.28;
        } else if (p.u >= 0.58 && p.u <= 0.70) {
          // Pulmonic Valve orifice (RV → PA) — systolic ejection
          valveMultiplier = isPulmonicOpen ? 2.6 : 0.25;
        }
      }

      // ── Systolic ejection surge pulse ──
      const systolicSurge = (cyclePhase < 0.35)
        ? 1.0 + Math.sin((cyclePhase / 0.35) * Math.PI) * 0.75
        : 0.88;

      const particleSpeed = baseVelocity * valveMultiplier * systolicSurge * p.speedJitter;

      // Advance particle along spline; wrap around [0..1]
      p.u = (p.u + delta * particleSpeed) % 1.0;

      // ── Sample 3D spline position & tangent ──
      p.curve.getPoint(p.u, posVec);
      p.curve.getTangent(p.u, tangentVec);

      // ── Build perpendicular radial dispersion axes (Frenet frame) ──
      if (Math.abs(tangentVec.y) < 0.9) {
        normalVec.crossVectors(tangentVec, new THREE.Vector3(0, 1, 0)).normalize();
      } else {
        normalVec.crossVectors(tangentVec, new THREE.Vector3(1, 0, 0)).normalize();
      }
      binormalVec.crossVectors(tangentVec, normalVec).normalize();

      // ── Stream tube geometry ──
      // Constrict tightly through valve rings → expand in chamber pools
      let streamRadius = p.radiusJitter;
      const inValveZone = (p.u >= 0.20 && p.u <= 0.30) || (p.u >= 0.60 && p.u <= 0.70);
      const inChamber   = (p.u >= 0.33 && p.u <= 0.55);

      if (inValveZone) {
        streamRadius *= 0.40;  // Tight energetic jet through valve orifice
      } else if (inChamber) {
        streamRadius *= 1.35;  // Wider volumetric pool inside ventricle
      }

      const cosA = Math.cos(p.angle);
      const sinA = Math.sin(p.angle);
      posVec.addScaledVector(normalVec,   cosA * streamRadius);
      posVec.addScaledVector(binormalVec, sinA * streamRadius);

      positions[i * 3 + 0] = posVec.x;
      positions[i * 3 + 1] = posVec.y;
      positions[i * 3 + 2] = posVec.z;

      // ── Dynamic color brightness — pulsing glow through open valves ──
      // Subtle pulse: +20% brightness when surging through open valve
      const isSurging = valveMultiplier > 1.5;
      if (p.isOx) {
        // Bright Red #FF1A1A — oxygenated blood
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = isSurging ? 0.18 : 0.10;
        colors[i * 3 + 2] = isSurging ? 0.18 : 0.10;
      } else {
        // Deep Royal Blue #0055FF — deoxygenated blood
        colors[i * 3 + 0] = isSurging ? 0.05 : 0.00;
        colors[i * 3 + 1] = isSurging ? 0.45 : 0.33;
        colors[i * 3 + 2] = 1.0;
      }

      // Balanced particle size — slightly larger when surging through valve
      sizes[i] = p.sizeBase * (isSurging ? 1.20 : 1.0);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate    = true;
    geometry.attributes.size.needsUpdate     = true;
  }

  /**
   * Responsive Camera Auto-fit & Dynamic FOV.
   * Keeps the heart model perfectly centered without overlapping side UI telemetry cards or clipping.
   */
  _fitCameraAndAspect() {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.floor(rect.width  || this.canvas.clientWidth  || 500);
    const h = Math.floor(rect.height || this.canvas.clientHeight || 700);
    if (w <= 0 || h <= 0) return;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      const aspect = w / h;
      this.camera.aspect = aspect;

      // Adjust camera vertical FOV dynamically for narrow laptop/mobile screens.
      // When aspect < 1.0 (tall or narrow viewport), expand vertical FOV so the
      // horizontal clearance around the heart stays wide enough to clear left/right HUD cards.
      const baseFov = 40;
      if (aspect < 1.0) {
        const vFovRad = 2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / Math.max(0.48, aspect));
        this.camera.fov = Math.min(64, Math.max(baseFov, (vFovRad * 180) / Math.PI));
      } else {
        this.camera.fov = baseFov;
      }
      this.camera.updateProjectionMatrix();

      if (this.controls) {
        this.controls.update();
      }
    }
  }

  _handleResize() {
    this._fitCameraAndAspect();
  }

  /**
   * Fallback Orbit Controls using spherical coordinates if OrbitControls is not loaded.
   */
  _bindFallbackInputs() {
    if (!this.canvas) return;

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._prevX = e.clientX;
      this._prevY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      this._isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._prevX;
      const dy = e.clientY - this._prevY;
      this._spherical.theta -= dx * 0.008;
      this._spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, this._spherical.phi - dy * 0.008));
      this._prevX = e.clientX;
      this._prevY = e.clientY;
      this._updateCameraFromSpherical();
    });

    this.canvas.addEventListener('wheel', (e) => {
      this._spherical.radius = Math.max(1.5, Math.min(7.0, this._spherical.radius + e.deltaY * 0.003));
      this._updateCameraFromSpherical();
      e.preventDefault();
    }, { passive: false });

    // Touch support
    let touchDist = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._prevX = e.touches[0].clientX;
        this._prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this._isDragging) {
        const dx = e.touches[0].clientX - this._prevX;
        const dy = e.touches[0].clientY - this._prevY;
        this._spherical.theta -= dx * 0.008;
        this._spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, this._spherical.phi - dy * 0.008));
        this._prevX = e.touches[0].clientX;
        this._prevY = e.touches[0].clientY;
        this._updateCameraFromSpherical();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = touchDist - dist;
        this._spherical.radius = Math.max(1.5, Math.min(7.0, this._spherical.radius + delta * 0.005));
        touchDist = dist;
        this._updateCameraFromSpherical();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this._isDragging = false;
    }, { passive: true });

    this._updateCameraFromSpherical();
  }

  _updateCameraFromSpherical() {
    if (!this.camera || !this._target) return;
    const x = this._spherical.radius * Math.sin(this._spherical.phi) * Math.cos(this._spherical.theta);
    const y = this._spherical.radius * Math.cos(this._spherical.phi);
    const z = this._spherical.radius * Math.sin(this._spherical.phi) * Math.sin(this._spherical.theta);
    this.camera.position.set(
      this._target.x + x,
      this._target.y + y,
      this._target.z + z
    );
    this.camera.lookAt(this._target);
  }

  /**
   * Sync skeletal beating animation speed directly with Heart Rate (BPM).
   */
  _syncAnimationToHR(hr) {
    if (!this.animAction) return;
    const clampedHR = Math.max(20, Math.min(220, hr));
    this.animAction.timeScale = clampedHR / 60.0;
    this.lastHR = clampedHR;
  }

  /**
   * Apply live telemetry updates to visuals and lighting.
   */
  _applyTelemetry() {
    const state = window.__CARDIA_STATE;
    if (!state) return;

    // 1. Sync skeletal animation speed to live heart rate
    if (Math.abs(state.hr - this.lastHR) > 0.5) {
      this._syncAnimationToHR(state.hr);
    }

    // 2. Pause/resume animation with simulation state
    if (this.animAction) {
      if (!state.running && this.animAction.isRunning()) {
        this.animAction.paused = true;
      } else if (state.running && this.animAction.paused) {
        this.animAction.paused = false;
      }
    }

    // 3. EF Alarm Rim Light — subtle alarm pulse when EF critically low
    // Note: rim light intensity kept low (max 1.1) to avoid over-exposure
    if (state.live && state.live.ef < 35) {
      const alarm = Math.sin(performance.now() * 0.005) * 0.5 + 0.5;
      this.rimLight.color.setHex(0xdc2626);
      this.rimLight.intensity = 0.35 + alarm * 0.75;
    } else {
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 0.9;
    }
  }

  /**
   * Defines the 8 anatomical structures with their 3D anchor points.
   */
  _setupAnatomicalAnchors() {
    this.annotationsDef = [
      {
        id: "rightAtrium",
        label: "Right Atrium",
        subtitle: "Deoxygenated venous inflow",
        jointName: "right_atrium_jnt.6",
        fallbackAnchor: new THREE.Vector3(-0.42, 0.48, 0.22),
        screenSide: "left",
        offset: { x: -75, y: -25 },
        color: "#0284c7",
        badge: "RA",
        liveKey: "right_atrium"
      },
      {
        id: "rightVentricle",
        label: "Right Ventricle",
        subtitle: "Pulmonary low-pressure pump",
        jointName: "right_tricuspid_valve_jnt.24",
        fallbackAnchor: new THREE.Vector3(-0.22, -0.12, 0.22),
        screenSide: "left",
        offset: { x: -80, y: 35 },
        color: "#0284c7",
        badge: "RV",
        liveKey: "right_ventricle"
      },
      {
        id: "leftAtrium",
        label: "Left Atrium",
        subtitle: "Oxygenated pulmonary inflow",
        jointName: "left_atrium_jnt.13",
        fallbackAnchor: new THREE.Vector3(0.30, 0.55, 0.20),
        screenSide: "right",
        offset: { x: 75, y: -30 },
        color: "#dc2626",
        badge: "LA",
        liveKey: "left_atrium"
      },
      {
        id: "leftVentricle",
        label: "Left Ventricle",
        subtitle: "Systemic high-pressure chamber",
        jointName: "cardiac_muscle_jnt.7",
        fallbackAnchor: new THREE.Vector3(0.12, -0.22, 0.20),
        screenSide: "right",
        offset: { x: 80, y: 40 },
        color: "#dc2626",
        badge: "LV",
        liveKey: "left_ventricle"
      },
      {
        id: "mitralValve",
        label: "Mitral Valve",
        subtitle: "Bicuspid AV valve (LA → LV)",
        jointName: "left_mitral_valve_jnt.15",
        fallbackAnchor: new THREE.Vector3(0.20, 0.20, 0.20),
        screenSide: "right",
        offset: { x: 85, y: 5 },
        color: "#059669",
        badge: "MV",
        liveValve: "mitral"
      },
      {
        id: "aorticValve",
        label: "Aortic Valve",
        subtitle: "Semilunar outflow (LV → Ao)",
        jointName: "aortic_valve_02_jnt.17",
        fallbackAnchor: new THREE.Vector3(0.07, 0.22, 0.22),
        screenSide: "right",
        offset: { x: 70, y: -70 },
        color: "#059669",
        badge: "AV",
        liveValve: "aortic"
      },
      {
        id: "aorta",
        label: "Aorta",
        subtitle: "Systemic arterial root & arch",
        jointName: null,
        fallbackAnchor: new THREE.Vector3(0.02, 0.80, 0.10),
        screenSide: "right",
        offset: { x: 65, y: -65 },
        color: "#b91c1c",
        badge: "AO",
        liveCirc: "aortic_pressure_mmhg"
      },
      {
        id: "pulmonaryArtery",
        label: "Pulmonary Artery",
        subtitle: "Deoxygenated outflow to lungs",
        jointName: "right_pulmonary_valve_jnt.9",
        fallbackAnchor: new THREE.Vector3(-0.16, 0.62, 0.20),
        screenSide: "left",
        offset: { x: -75, y: -55 },
        color: "#2563eb",
        badge: "PA",
        liveCirc: "pulmonary_artery_pressure_mmhg"
      }
    ];

    this._createAnnotationDOMElements();
  }

  _createAnnotationDOMElements() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    if (!this.annotationsContainer) {
      const container = document.createElement('div');
      container.id = 'cardia-annotations-container';
      container.className = 'absolute inset-0 pointer-events-none z-20 overflow-hidden';
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.25s ease-in-out';
      parent.appendChild(container);
      this.annotationsContainer = container;
    }

    if (!this.annotationsSvg) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'cardia-annotations-svg';
      svg.setAttribute('class', 'absolute inset-0 w-full h-full pointer-events-none z-15');
      svg.style.overflow = 'visible';
      svg.style.opacity = '0';
      parent.appendChild(svg);
      this.annotationsSvg = svg;
    }

    this.annotationsContainer.innerHTML = '';
    this.annotationsSvg.innerHTML = '';
    this.annotationElements = [];

    this.annotationsDef.forEach((def) => {
      // Pin Dot
      const pin = document.createElement('div');
      pin.className = 'absolute pointer-events-none transition-transform duration-75';
      pin.style.width = '10px';
      pin.style.height = '10px';
      pin.style.marginLeft = '-5px';
      pin.style.marginTop = '-5px';
      pin.innerHTML = `
        <div class="relative w-full h-full flex items-center justify-center">
          <div class="absolute inset-0 rounded-full animate-ping opacity-60" style="background-color: ${def.color};"></div>
          <div class="w-2 h-2 rounded-full border border-white shadow-sm" style="background-color: ${def.color};"></div>
        </div>
      `;
      this.annotationsContainer.appendChild(pin);

      // SVG Line
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', def.color);
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('stroke-dasharray', '2 2');
      path.setAttribute('opacity', '0.75');
      this.annotationsSvg.appendChild(path);

      // Floating Tag Card
      const card = document.createElement('div');
      card.className = 'absolute pointer-events-auto cursor-pointer rounded border border-slate-700 bg-slate-900/95 backdrop-blur shadow-lg px-2 py-1 font-mono text-[9px] hover:scale-105 hover:border-sky-400';
      card.style.minWidth = '110px';
      card.style.maxWidth = '160px';
      card.style.userSelect = 'none';

      card.innerHTML = `
        <div class="flex items-center justify-between gap-1 pb-0.5 border-b border-slate-700">
          <div class="flex items-center gap-1 font-bold text-slate-100">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${def.color};"></span>
            <span class="tracking-tight">${def.label}</span>
          </div>
          <span class="px-1 py-0.2 rounded text-[7px] font-bold text-white uppercase" style="background-color: ${def.color};">${def.badge}</span>
        </div>
        <div class="flex items-center justify-between pt-0.5 text-[8px]">
          <span class="text-slate-400 truncate">${def.subtitle}</span>
          <span class="font-bold text-slate-200 ml-1" id="ann-val-${def.id}">--</span>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        this.activeHoverId = def.id;
        path.setAttribute('stroke-width', '2.0');
        path.setAttribute('stroke-dasharray', 'none');
        path.setAttribute('opacity', '1.0');
        pin.style.transform = 'scale(1.4)';
      });

      card.addEventListener('mouseleave', () => {
        this.activeHoverId = null;
        path.setAttribute('stroke-width', '1.2');
        path.setAttribute('stroke-dasharray', '2 2');
        path.setAttribute('opacity', '0.75');
        pin.style.transform = 'scale(1.0)';
      });

      this.annotationsContainer.appendChild(card);

      this.annotationElements.push({
        def,
        pin,
        path,
        card,
        valEl: card.querySelector(`#ann-val-${def.id}`)
      });
    });

    this._injectToggleButton();
  }

  _injectToggleButton() {
    if (document.getElementById('btn-toggle-annotations')) return;
    const section = this.canvas.closest('section');
    if (!section) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'btn-toggle-annotations';
    toggleBtn.type = 'button';
    toggleBtn.className = 'absolute top-2 right-44 z-30 pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700 px-2 py-0.5 rounded font-mono text-[9px] font-semibold text-slate-200 hover:text-sky-400 hover:border-sky-400 flex items-center gap-1 shadow transition-all';
    toggleBtn.innerHTML = `
      <span class="material-symbols-outlined text-[13px] text-sky-400">label</span>
      <span id="txt-toggle-annotations">Labels: OFF</span>
    `;

    toggleBtn.addEventListener('click', () => this.toggleAnnotations());
    section.appendChild(toggleBtn);
  }

  toggleAnnotations(forceState) {
    this.showAnnotations = (typeof forceState === 'boolean') ? forceState : !this.showAnnotations;
    if (this.annotationsContainer) {
      this.annotationsContainer.style.opacity = this.showAnnotations ? '1' : '0';
      this.annotationsContainer.style.pointerEvents = this.showAnnotations ? 'auto' : 'none';
    }
    if (this.annotationsSvg) {
      this.annotationsSvg.style.opacity = this.showAnnotations ? '1' : '0';
    }
    const txt = document.getElementById('txt-toggle-annotations');
    if (txt) {
      txt.textContent = `Labels: ${this.showAnnotations ? 'ON' : 'OFF'}`;
    }
  }

  _getAnchorWorldPos(def, outVec) {
    if (def.jointName && this.joints[def.jointName]) {
      this.joints[def.jointName].getWorldPosition(outVec);
      return outVec;
    }
    if (this.modelPivot) {
      outVec.copy(def.fallbackAnchor);
      outVec.applyMatrix4(this.modelPivot.matrixWorld);
      return outVec;
    }
    outVec.copy(def.fallbackAnchor);
    return outVec;
  }

  _updateAnnotations() {
    if (!this.showAnnotations || !this.camera || !this.canvas || this.annotationElements.length === 0) {
      return;
    }

    const rect   = this.canvas.getBoundingClientRect();
    const width  = rect.width  || this.canvas.clientWidth;
    const height = rect.height || this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const minX = 12;
    const maxX = width - 12;
    const minY = 38;
    const maxY = height - 42;

    const state = window.__CARDIA_STATE;

    this.annotationElements.forEach((item) => {
      const { def, pin, path, card, valEl } = item;

      this._getAnchorWorldPos(def, this._tempVec);
      this._tempVec.project(this.camera);

      if (this._tempVec.z > 1.0) {
        pin.style.display  = 'none';
        card.style.display = 'none';
        path.setAttribute('d', '');
        return;
      }

      pin.style.display  = 'block';
      card.style.display = 'block';

      const screenX = (this._tempVec.x * 0.5 + 0.5) * width;
      const screenY = (-(this._tempVec.y * 0.5) + 0.5) * height;

      pin.style.left = `${Math.round(screenX)}px`;
      pin.style.top  = `${Math.round(screenY)}px`;

      const cardW = card.offsetWidth  || 130;
      const cardH = card.offsetHeight || 38;

      let cardX = def.screenSide === 'left' ? screenX + def.offset.x - cardW : screenX + def.offset.x;
      let cardY = screenY + def.offset.y;

      cardX = Math.max(minX, Math.min(maxX - cardW, cardX));
      cardY = Math.max(minY, Math.min(maxY - cardH, cardY));

      card.style.left = `${Math.round(cardX)}px`;
      card.style.top  = `${Math.round(cardY)}px`;

      const attachX = def.screenSide === 'left' ? cardX + cardW : cardX;
      const attachY = cardY + cardH * 0.5;
      const midX    = (screenX + attachX) * 0.5;

      path.setAttribute('d', `M ${screenX.toFixed(1)} ${screenY.toFixed(1)} Q ${midX.toFixed(1)} ${screenY.toFixed(1)}, ${attachX.toFixed(1)} ${attachY.toFixed(1)}`);

      if (valEl && state && state.live) {
        if (def.liveKey && state.live.chambers && state.live.chambers[def.liveKey]) {
          const ch = state.live.chambers[def.liveKey];
          valEl.textContent = `${Math.round(ch.volume_ml)}mL · ${Math.round(ch.pressure_mmhg)}mmHg`;
        } else if (def.liveValve && state.live.valves && state.live.valves[def.liveValve]) {
          const v = state.live.valves[def.liveValve];
          valEl.textContent  = v.is_open ? 'OPEN' : 'CLOSED';
          valEl.style.color  = v.is_open ? '#10b981' : '#94a3b8';
        } else if (def.liveCirc) {
          if (def.id === 'aorta') {
            valEl.textContent = `${Math.round(state.live.sbp || 120)}/${Math.round(state.live.dbp || 80)} mmHg`;
          } else if (def.id === 'pulmonaryArtery') {
            valEl.textContent = `P: ${Math.round((state.live.dbp || 80) * 0.2)} mmHg`;
          }
        }
      }
    });
  }

  /**
   * Main animation loop
   */
  _animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();

    // 1. Update skeletal animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // 2. Update OrbitControls inertia
    if (this.controls) {
      this.controls.update();
    }

    // 3. Update blood flow particle physics
    if (this.particleSystem) {
      this._updateBloodParticles(delta);
    }

    // 4. Update live telemetry and annotations
    if (this.isLoaded) {
      this._applyTelemetry();
      this._updateAnnotations();
    }

    // 5. Render Three.js scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Clean up all GPU resources and DOM listeners.
   */
  dispose() {
    this.disposed = true;
    if (this.mixer)   this.mixer.stopAllAction();
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    if (this.annotationsContainer && this.annotationsContainer.parentElement) {
      this.annotationsContainer.parentElement.removeChild(this.annotationsContainer);
    }
    if (this.annotationsSvg && this.annotationsSvg.parentElement) {
      this.annotationsSvg.parentElement.removeChild(this.annotationsSvg);
    }
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    console.log('[CardiaHeart3D] Disposed.');
  }
}

// Expose globally for integration
window.CardiaHeart3D = CardiaHeart3D;
