import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LiveMetrics } from '../types/cardiac';

interface Heart3DViewportProps {
  live: LiveMetrics;
  hr: number;
  contractility: number;
  svr: number;
  running: boolean;
  speed: number;
  cyclePhase: number;
}

interface AnnotationDef {
  id: string;
  label: string;
  subtitle: string;
  jointName?: string;
  fallbackAnchor: THREE.Vector3;
  screenSide: 'left' | 'right';
  offset: { x: number; y: number };
  color: string;
  badge: string;
  getValue: (live: LiveMetrics) => string;
}

export const Heart3DViewport: React.FC<Heart3DViewportProps> = ({
  live,
  hr,
  contractility,
  svr,
  running,
  speed,
  cyclePhase
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(25);
  const [loadStatus, setLoadStatus] = useState('Loading anatomical 3D heart model...');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annotations, setAnnotations] = useState<Array<{
    def: AnnotationDef;
    screenX: number;
    screenY: number;
    cardX: number;
    cardY: number;
    attachX: number;
    attachY: number;
    visible: boolean;
    value: string;
  }>>([]);

  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 3.5, theta: -0.35, phi: 1.35 });
  const modelPivotRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animActionRef = useRef<THREE.AnimationAction | null>(null);
  const particleSystemRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);
  const jointsRef = useRef<Record<string, THREE.Object3D>>({});

  const liveRef = useRef(live);
  liveRef.current = live;
  const hrRef = useRef(hr);
  hrRef.current = hr;
  const contractilityRef = useRef(contractility);
  contractilityRef.current = contractility;
  const svrRef = useRef(svr);
  svrRef.current = svr;
  const runningRef = useRef(running);
  runningRef.current = running;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const cyclePhaseRef = useRef(cyclePhase);
  cyclePhaseRef.current = cyclePhase;

  // Anatomical anchor definitions adjusted to lowered, centered heart geometry
  const annotationsDefRef = useRef<AnnotationDef[]>([
    {
      id: "rightAtrium",
      label: "Right Atrium",
      subtitle: "Deoxygenated venous inflow",
      jointName: "right_atrium_jnt.6",
      fallbackAnchor: new THREE.Vector3(-0.28, 0.16, 0.12),
      screenSide: "left",
      offset: { x: -75, y: -25 },
      color: "#0284c7",
      badge: "RA",
      getValue: (l) => `${Math.round(l.chambers.right_atrium.volume_ml)}mL · ${Math.round(l.chambers.right_atrium.pressure_mmhg)}mmHg`
    },
    {
      id: "rightVentricle",
      label: "Right Ventricle",
      subtitle: "Pulmonary low-pressure pump",
      jointName: "right_tricuspid_valve_jnt.24",
      fallbackAnchor: new THREE.Vector3(-0.16, -0.45, 0.18),
      screenSide: "left",
      offset: { x: -80, y: 35 },
      color: "#0284c7",
      badge: "RV",
      getValue: (l) => `${Math.round(l.chambers.right_ventricle.volume_ml)}mL · ${Math.round(l.chambers.right_ventricle.pressure_mmhg)}mmHg`
    },
    {
      id: "leftAtrium",
      label: "Left Atrium",
      subtitle: "Oxygenated pulmonary inflow",
      jointName: "left_atrium_jnt.13",
      fallbackAnchor: new THREE.Vector3(0.20, 0.05, -0.05),
      screenSide: "right",
      offset: { x: 75, y: -30 },
      color: "#dc2626",
      badge: "LA",
      getValue: (l) => `${Math.round(l.chambers.left_atrium.volume_ml)}mL · ${Math.round(l.chambers.left_atrium.pressure_mmhg)}mmHg`
    },
    {
      id: "leftVentricle",
      label: "Left Ventricle",
      subtitle: "Systemic high-pressure chamber",
      jointName: "cardiac_muscle_jnt.7",
      fallbackAnchor: new THREE.Vector3(0.10, -0.50, 0.10),
      screenSide: "right",
      offset: { x: 80, y: 40 },
      color: "#dc2626",
      badge: "LV",
      getValue: (l) => `${Math.round(l.chambers.left_ventricle.volume_ml)}mL · ${Math.round(l.chambers.left_ventricle.pressure_mmhg)}mmHg`
    },
    {
      id: "mitralValve",
      label: "Mitral Valve",
      subtitle: "Bicuspid AV valve (LA → LV)",
      jointName: "left_mitral_valve_jnt.15",
      fallbackAnchor: new THREE.Vector3(0.18, -0.10, 0.05),
      screenSide: "right",
      offset: { x: 85, y: 5 },
      color: "#059669",
      badge: "MV",
      getValue: (l) => l.valves.mitral.is_open ? 'OPEN' : 'CLOSED'
    },
    {
      id: "aorticValve",
      label: "Aortic Valve",
      subtitle: "Semilunar outflow (LV → Ao)",
      jointName: "aortic_valve_02_jnt.17",
      fallbackAnchor: new THREE.Vector3(0.04, -0.05, 0.16),
      screenSide: "right",
      offset: { x: 70, y: -70 },
      color: "#059669",
      badge: "AV",
      getValue: (l) => l.valves.aortic.is_open ? 'OPEN' : 'CLOSED'
    },
    {
      id: "aorta",
      label: "Aorta",
      subtitle: "Systemic arterial root & arch",
      fallbackAnchor: new THREE.Vector3(-0.01, 0.52, 0.05),
      screenSide: "right",
      offset: { x: 65, y: -65 },
      color: "#b91c1c",
      badge: "AO",
      getValue: (l) => `${Math.round(l.sbp)}/${Math.round(l.dbp)} mmHg`
    },
    {
      id: "pulmonaryArtery",
      label: "Pulmonary Artery",
      subtitle: "Deoxygenated outflow to lungs",
      jointName: "right_pulmonary_valve_jnt.9",
      fallbackAnchor: new THREE.Vector3(-0.12, 0.32, 0.10),
      screenSide: "left",
      offset: { x: -75, y: -55 },
      color: "#0284c7",
      badge: "PA",
      getValue: (l) => `P: ${Math.round(l.dbp * 0.22)} mmHg`
    }
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);

    const modelPivot = new THREE.Group();
    scene.add(modelPivot);
    modelPivotRef.current = modelPivot;

    // 2. Camera setup - centered on lowered heart origin (0, -0.28, 0)
    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 700;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 100);
    cameraRef.current = camera;

    const target = new THREE.Vector3(0, -0.28, 0);

    const updateCamera = () => {
      const s = sphericalRef.current;
      const x = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
      const y = s.radius * Math.cos(s.phi);
      const z = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
      camera.position.set(target.x + x, target.y + y, target.z + z);
      camera.lookAt(target);
    };
    updateCamera();

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // 4. Balanced Natural Ambient & Directional Lighting for Organic Myocardium
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(2.5, 4.0, 3.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.7);
    fillLight.position.set(-3.5, 1.5, -2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(0, -2.5, -3.5);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // 5. Dense Blood Flow Particles Strictly Contained Inside Internal Chambers & Valves
    // Red oxygenated particles strictly circulate inside the Left Ventricle cavity and flow upward through Aortic Valve into Aorta
    // Lowest Y is -0.75 (inside ventricular apex), highest Y is 0.58 (inside aortic arch) -> NO particles in open air
    const oxWaypoints = [
      new THREE.Vector3( 0.22,  0.05, -0.10), // Left Atrium chamber
      new THREE.Vector3( 0.18, -0.10,  0.02), // Mitral Valve opening
      new THREE.Vector3( 0.15, -0.25,  0.05), // LV upper inlet
      new THREE.Vector3( 0.12, -0.50,  0.08), // LV mid cavity
      new THREE.Vector3( 0.08, -0.75,  0.06), // LV apical cavity (deep internal, well above outer apex -1.19)
      new THREE.Vector3( 0.06, -0.45,  0.12), // LVOT ascending
      new THREE.Vector3( 0.05, -0.20,  0.15), // Sub-aortic vestibule
      new THREE.Vector3( 0.04, -0.05,  0.16), // Aortic Valve opening
      new THREE.Vector3( 0.03,  0.18,  0.14), // Aortic Root / Sinus
      new THREE.Vector3( 0.02,  0.38,  0.10), // Ascending Aorta
      new THREE.Vector3(-0.01,  0.58,  0.04), // Aorta Arch peak
      new THREE.Vector3(-0.08,  0.48, -0.06), // Descending Aorta
      new THREE.Vector3( 0.14,  0.25, -0.10)  // Pulmonary vein return into LA
    ];

    // Blue deoxygenated particles strictly circulate inside Right Atrium/Ventricle and flow into Pulmonic Valve
    const deoxWaypoints = [
      new THREE.Vector3(-0.36,  0.48,  0.02), // Superior Vena Cava inflow
      new THREE.Vector3(-0.32,  0.32,  0.08), // Upper Right Atrium
      new THREE.Vector3(-0.28,  0.16,  0.12), // Mid Right Atrium
      new THREE.Vector3(-0.24, -0.02,  0.14), // Approaches Tricuspid
      new THREE.Vector3(-0.20, -0.15,  0.16), // Tricuspid Valve opening
      new THREE.Vector3(-0.18, -0.32,  0.18), // RV inlet
      new THREE.Vector3(-0.16, -0.55,  0.18), // RV cavity mid-body
      new THREE.Vector3(-0.14, -0.68,  0.16), // RV cavity floor (well inside anterior chamber)
      new THREE.Vector3(-0.12, -0.42,  0.18), // RV infundibulum
      new THREE.Vector3(-0.10, -0.20,  0.18), // RVOT upper
      new THREE.Vector3(-0.08, -0.02,  0.18), // Pulmonic Valve opening
      new THREE.Vector3(-0.09,  0.18,  0.15), // Pulmonary Trunk
      new THREE.Vector3(-0.12,  0.36,  0.10), // Main Pulmonary Artery
      new THREE.Vector3(-0.20,  0.44,  0.02), // Pulmonary Bifurcation
      new THREE.Vector3(-0.28,  0.40, -0.06)  // Pulmonary outflow loop
    ];

    const oxCurve = new THREE.CatmullRomCurve3(oxWaypoints, true, 'centripetal');
    const deoxCurve = new THREE.CatmullRomCurve3(deoxWaypoints, true, 'centripetal');

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.40)');
      grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 64, 64);
    }
    const particleTex = new THREE.CanvasTexture(pCanvas);

    const NUM_OX = 360;
    const NUM_DEOX = 360;
    const TOTAL = NUM_OX + NUM_DEOX;

    const positions = new Float32Array(TOTAL * 3);
    const colors = new Float32Array(TOTAL * 3);
    const sizes = new Float32Array(TOTAL);
    const particleData: any[] = [];

    for (let i = 0; i < TOTAL; i++) {
      const isOx = i < NUM_OX;
      const curve = isOx ? oxCurve : deoxCurve;
      const u = Math.random();
      const speedJitter = 0.85 + Math.random() * 0.30;
      // Controlled, tight lateral dispersion so particles never drift outside the cutaway walls
      const radiusJitter = 0.010 + Math.random() * 0.022;
      const angle = Math.random() * Math.PI * 2;
      const sizeBase = isOx ? 0.075 + Math.random() * 0.025 : 0.070 + Math.random() * 0.025;

      particleData.push({ isOx, curve, u, speedJitter, radiusJitter, angle, sizeBase });

      if (isOx) {
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = 0.10 + Math.random() * 0.04;
        colors[i * 3 + 2] = 0.10 + Math.random() * 0.04;
      } else {
        colors[i * 3 + 0] = 0.0;
        colors[i * 3 + 1] = 0.33 + Math.random() * 0.10;
        colors[i * 3 + 2] = 1.0;
      }
      sizes[i] = sizeBase;
    }

    const pGeometry = new THREE.BufferGeometry();
    pGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.11,
      sizeAttenuation: true,
      map: particleTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    const pointCloud = new THREE.Points(pGeometry, pMaterial);
    pointCloud.frustumCulled = false;
    modelPivot.add(pointCloud);

    particleSystemRef.current = {
      positions,
      colors,
      sizes,
      particles: particleData,
      geometry: pGeometry
    };

    // 6. Load External Pre-Defined Anatomical Half-Cutaway GLTF Model
    const loader = new GLTFLoader();
    const candidatePaths = [
      '/models/heart.glb',
      '/heart.glb',
      'models/heart.glb',
      'heart.glb'
    ];

    let candidateIdx = 0;
    const tryLoad = () => {
      if (candidateIdx >= candidatePaths.length) {
        setLoadError('Heart 3D model could not be loaded from candidate paths.');
        setIsLoading(false);
        return;
      }

      const url = candidatePaths[candidateIdx];
      setLoadStatus(`Loading ${url}...`);

      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Compute exact bounding box
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // Scale model so max dimension comfortably fits the viewport frustum
          const scaleFactor = 1.85 / (maxDim || 1.0);
          model.scale.setScalar(scaleFactor);

          // Center the 3D model in viewport and LOWER Y position so top Aorta arch is not cut off by top cards
          model.position.set(
            -center.x * scaleFactor,
            -center.y * scaleFactor - 0.28,
            -center.z * scaleFactor
          );

          // PRESERVE embedded model textures & vertex colors (pink/red muscular tissue, blue/red vessels, white valves)
          // Set mesh roughness to 0.4 and metalness to 0.0 with natural tissue appearance
          model.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.frustumCulled = false;

              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat: any) => {
                if (mat) {
                  if ('roughness' in mat) mat.roughness = 0.4;
                  if ('metalness' in mat) mat.metalness = 0.0;
                  mat.needsUpdate = true;
                }
              });
            }

            if (child.isBone || (child.name && child.name.includes('jnt'))) {
              jointsRef.current[child.name] = child;
            }
          });

          modelPivot.add(model);

          // Skeletal beating animation
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            const clip = gltf.animations[0];
            const action = mixer.clipAction(clip);
            action.play();
            action.timeScale = (hrRef.current / 60.0) * speedRef.current;
            mixerRef.current = mixer;
            animActionRef.current = action;
          }

          setIsLoading(false);
        },
        (progress) => {
          if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            setLoadingProgress(Math.min(95, Math.max(20, pct)));
          }
        },
        () => {
          candidateIdx++;
          tryLoad();
        }
      );
    };

    tryLoad();

    // 7. Auto resize
    const handleResize = () => {
      if (!canvas || !renderer || !camera) return;
      const w = canvas.clientWidth || 500;
      const h = canvas.clientHeight || 700;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // 8. Mouse Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      sphericalRef.current.theta -= dx * 0.008;
      sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI - 0.2, sphericalRef.current.phi - dy * 0.008));
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
      updateCamera();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(1.5, Math.min(6.5, sphericalRef.current.radius + e.deltaY * 0.003));
      updateCamera();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // 9. Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (timestamp: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.08, Math.max(0.001, (timestamp - lastTime) / 1000));
      lastTime = timestamp;

      const currentLive = liveRef.current;
      const currentHr = hrRef.current;
      const currentRunning = runningRef.current;
      const currentSpeed = speedRef.current;
      const cp = cyclePhaseRef.current;

      // Update skeletal animation mixer
      if (mixerRef.current && currentRunning) {
        if (animActionRef.current) {
          animActionRef.current.timeScale = (currentHr / 60.0) * currentSpeed;
        }
        mixerRef.current.update(dt);
      }

      // Update particle fluid system with instant valve gating
      if (particleSystemRef.current && currentRunning) {
        const { particles, positions: posArr, colors: colArr, sizes: sizeArr, geometry: geom } = particleSystemRef.current;
        const hrScale = Math.max(30, Math.min(200, currentHr)) / 74.0;
        const coScale = Math.max(1.5, Math.min(10.0, currentLive.co)) / 5.4;
        const baseVel = 0.26 * hrScale * coScale * currentSpeed;

        const isMitralOpen = currentLive.valves.mitral.is_open;
        const isAorticOpen = currentLive.valves.aortic.is_open;
        const isTricuspidOpen = currentLive.valves.tricuspid.is_open;
        const isPulmonicOpen = currentLive.valves.pulmonic.is_open;

        const pVec = new THREE.Vector3();
        const tanVec = new THREE.Vector3();
        const normVec = new THREE.Vector3();
        const binormVec = new THREE.Vector3();

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          let valveMult = 1.0;

          // VALVE GATING & HALTING LOGIC:
          // When a valve is CLOSED, halt particle stream across that specific valve instantly!
          if (p.isOx) {
            // RED OXYGENATED STREAM:
            if (p.u >= 0.08 && p.u <= 0.22) {
              // Mitral Valve opening zone (LA -> LV)
              if (!isMitralOpen) {
                valveMult = 0.0; // HALT STREAM INSTANTLY WHEN CLOSED
              } else {
                valveMult = 2.4; // Diastolic filling surge
              }
            } else if (p.u >= 0.55 && p.u <= 0.72) {
              // Aortic Valve opening zone (LV -> Aorta)
              if (!isAorticOpen) {
                valveMult = 0.0; // HALT STREAM INSTANTLY WHEN CLOSED
              } else {
                valveMult = 2.8; // Systolic ejection surge
              }
            }
          } else {
            // BLUE DEOXYGENATED STREAM:
            if (p.u >= 0.18 && p.u <= 0.32) {
              // Tricuspid Valve opening zone (RA -> RV)
              if (!isTricuspidOpen) {
                valveMult = 0.0; // HALT STREAM INSTANTLY WHEN CLOSED
              } else {
                valveMult = 2.4; // Diastolic filling surge
              }
            } else if (p.u >= 0.55 && p.u <= 0.70) {
              // Pulmonic Valve opening zone (RV -> PA)
              if (!isPulmonicOpen) {
                valveMult = 0.0; // HALT STREAM INSTANTLY WHEN CLOSED
              } else {
                valveMult = 2.8; // Systolic ejection surge
              }
            }
          }

          const systolicSurge = (cp < 0.35)
            ? 1.0 + Math.sin((cp / 0.35) * Math.PI) * 0.75
            : 0.88;

          // If valve is closed (valveMult = 0.0), particle halts immediately
          const pSpeed = baseVel * valveMult * systolicSurge * p.speedJitter;
          p.u = ((p.u + dt * pSpeed) % 1.0 + 1.0) % 1.0;

          const sampleU = Math.max(0.0001, Math.min(0.9999, isNaN(p.u) ? 0.0001 : p.u));
          p.curve.getPoint(sampleU, pVec);
          p.curve.getTangent(sampleU, tanVec);

          if (Math.abs(tanVec.y) < 0.9) {
            normVec.crossVectors(tanVec, new THREE.Vector3(0, 1, 0)).normalize();
          } else {
            normVec.crossVectors(tanVec, new THREE.Vector3(1, 0, 0)).normalize();
          }
          binormVec.crossVectors(tanVec, normVec).normalize();

          // Controlled internal chamber radius - strictly within lumen
          let sRadius = p.radiusJitter;
          if ((p.u >= 0.12 && p.u <= 0.22) || (p.u >= 0.58 && p.u <= 0.68)) {
            sRadius *= 0.50; // Constrict through valve rings
          } else if (p.u >= 0.25 && p.u <= 0.50) {
            sRadius *= 1.35; // Expand inside ventricle cavity pool
          }

          pVec.addScaledVector(normVec, Math.cos(p.angle) * sRadius);
          pVec.addScaledVector(binormVec, Math.sin(p.angle) * sRadius);

          posArr[i * 3 + 0] = pVec.x;
          posArr[i * 3 + 1] = pVec.y;
          posArr[i * 3 + 2] = pVec.z;

          const isSurging = valveMult > 1.5;
          if (p.isOx) {
            colArr[i * 3 + 0] = 1.0;
            colArr[i * 3 + 1] = isSurging ? 0.20 : 0.10;
            colArr[i * 3 + 2] = isSurging ? 0.20 : 0.10;
          } else {
            colArr[i * 3 + 0] = isSurging ? 0.08 : 0.0;
            colArr[i * 3 + 1] = isSurging ? 0.48 : 0.33;
            colArr[i * 3 + 2] = 1.0;
          }
          sizeArr[i] = p.sizeBase * (isSurging ? 1.25 : 1.0);
        }

        geom.attributes.position.needsUpdate = true;
        geom.attributes.color.needsUpdate = true;
        geom.attributes.size.needsUpdate = true;
      }

      // Alarm Rim Light
      if (rimLightRef.current) {
        if (currentLive.ef < 35) {
          const alarm = Math.sin(timestamp * 0.005) * 0.5 + 0.5;
          rimLightRef.current.color.setHex(0xdc2626);
          rimLightRef.current.intensity = 0.35 + alarm * 0.75;
        } else {
          rimLightRef.current.color.setHex(0x38bdf8);
          rimLightRef.current.intensity = 0.7;
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  // Update Projected 2D Annotations
  useEffect(() => {
    if (!showAnnotations || !cameraRef.current || !canvasRef.current) {
      setAnnotations([]);
      return;
    }

    const canvas = canvasRef.current;
    const w = canvas.clientWidth || 500;
    const h = canvas.clientHeight || 700;
    const cam = cameraRef.current;
    const tempVec = new THREE.Vector3();

    const minX = 12;
    const maxX = w - 12;
    const minY = 38;
    const maxY = h - 42;

    const updated = annotationsDefRef.current.map((def) => {
      if (def.jointName && jointsRef.current[def.jointName]) {
        jointsRef.current[def.jointName].getWorldPosition(tempVec);
      } else {
        tempVec.copy(def.fallbackAnchor);
        if (modelPivotRef.current) {
          tempVec.applyMatrix4(modelPivotRef.current.matrixWorld);
        }
      }

      tempVec.project(cam);

      const visible = tempVec.z <= 1.0;
      const screenX = (tempVec.x * 0.5 + 0.5) * w;
      const screenY = (-(tempVec.y * 0.5) + 0.5) * h;

      const cardW = 135;
      const cardH = 38;

      let cardX = def.screenSide === 'left' ? screenX + def.offset.x - cardW : screenX + def.offset.x;
      let cardY = screenY + def.offset.y;

      cardX = Math.max(minX, Math.min(maxX - cardW, cardX));
      cardY = Math.max(minY, Math.min(maxY - cardH, cardY));

      const attachX = def.screenSide === 'left' ? cardX + cardW : cardX;
      const attachY = cardY + cardH * 0.5;

      return {
        def,
        screenX,
        screenY,
        cardX,
        cardY,
        attachX,
        attachY,
        visible,
        value: def.getValue(live)
      };
    });

    setAnnotations(updated);
  }, [showAnnotations, live, cyclePhase]);

  // Status badge for EF
  let efBadgeText = 'NORMAL EF';
  let efBadgeStyle = 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
  if (live.ef < 45) {
    efBadgeText = 'LOW EF (FAIL)';
    efBadgeStyle = 'text-rose-400 bg-rose-950/60 border-rose-500/40';
  } else if (live.ef > 75) {
    efBadgeText = 'HYPERDYNAMIC';
    efBadgeStyle = 'text-sky-400 bg-sky-950/60 border-sky-500/40';
  }

  const contractPct = Math.min(100, Math.max(10, (contractility / 2.0) * 100));
  const cppPct = Math.min(100, Math.max(10, (live.cpp / 100) * 100));

  return (
    <section className="col-span-5 flex flex-col min-h-0 relative rounded-lg border border-slate-800 bg-[#070b14] overflow-hidden shadow-md" ref={containerRef}>
      {/* 3D Heart Simulation Canvas */}
      <div className="w-full h-full absolute inset-0 z-0 flex items-center justify-center">
        {/* Dark Clinical Vignette & Grid */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.85)_0%,rgba(3,7,18,0.98)_90%)]"></div>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

        <canvas
          ref={canvasRef}
          className="w-full h-full relative z-1 block cursor-grab active:cursor-grabbing"
          id="canvas-cardiac-3d"
        />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#070b14]/92 backdrop-blur-md pointer-events-auto">
          <div className="relative flex items-center justify-center w-16 h-16 mb-2.5">
            <div className="absolute inset-0 rounded-full border-2 border-slate-700/50"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 border-r-rose-500 animate-spin"></div>
            <span className="material-symbols-outlined text-[28px] text-rose-500 animate-pulse drop-shadow-[0_0_10px_rgba(244,63,94,0.7)]">
              cardiology
            </span>
          </div>
          <div className="font-mono text-[11px] font-bold text-slate-100 tracking-wider uppercase mb-1">
            Loading Anatomical Cutaway Model
          </div>
          <div className="font-mono text-[9px] text-slate-400 max-w-[220px] text-center truncate">
            {loadStatus}
          </div>
          <div className="w-40 h-1 bg-slate-800 rounded-full mt-2.5 overflow-hidden border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-sky-400 via-rose-500 to-emerald-400 transition-all duration-150 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 text-center pointer-events-auto bg-[#070b14]/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-rose-500/50 rounded-lg p-4 shadow-2xl font-mono max-w-xs text-center">
            <div className="flex items-center justify-center gap-1.5 text-rose-400 mb-1.5">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span className="text-xs font-bold uppercase tracking-wider">3D Model Warning</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-snug mb-3">{loadError}</p>
          </div>
        </div>
      )}

      {/* SVG Connecting Lines for 3D Annotations */}
      {showAnnotations && (
        <svg ref={svgRef} className="absolute inset-0 z-20 pointer-events-none w-full h-full">
          {annotations.filter(a => a.visible).map((a) => {
            const midX = (a.screenX + a.attachX) * 0.5;
            const pathData = `M ${a.screenX.toFixed(1)} ${a.screenY.toFixed(1)} Q ${midX.toFixed(1)} ${a.screenY.toFixed(1)}, ${a.attachX.toFixed(1)} ${a.attachY.toFixed(1)}`;
            return (
              <path
                key={`line-${a.def.id}`}
                d={pathData}
                fill="none"
                stroke={a.def.color}
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.8"
              />
            );
          })}
        </svg>
      )}

      {/* 2D Interactive Annotation Pins & Tags */}
      {showAnnotations && annotations.filter(a => a.visible).map((a) => (
        <React.Fragment key={`ann-${a.def.id}`}>
          {/* Pulsing Pin on Heart */}
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: `${Math.round(a.screenX)}px`, top: `${Math.round(a.screenY)}px` }}
          >
            <div className="w-4 h-4 rounded-full animate-ping opacity-60 absolute" style={{ backgroundColor: a.def.color }}></div>
            <div className="w-2 h-2 rounded-full border border-white shadow-sm relative z-10" style={{ backgroundColor: a.def.color }}></div>
          </div>

          {/* Floating Tag Card */}
          <div
            className="absolute z-20 pointer-events-auto cursor-pointer rounded border border-slate-700 bg-slate-900/95 backdrop-blur shadow-lg px-2 py-1 font-mono text-[9px] hover:scale-105 hover:border-sky-400 transition-transform"
            style={{ left: `${Math.round(a.cardX)}px`, top: `${Math.round(a.cardY)}px`, minWidth: '120px', maxWidth: '160px' }}
          >
            <div className="flex items-center justify-between gap-1 pb-0.5 border-b border-slate-700">
              <div className="flex items-center gap-1 font-bold text-slate-100">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.def.color }}></span>
                <span className="tracking-tight">{a.def.label}</span>
              </div>
              <span className="px-1 py-0.2 rounded text-[7px] font-bold text-white uppercase" style={{ backgroundColor: a.def.color }}>
                {a.def.badge}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5 text-[8px]">
              <span className="text-slate-400 truncate">{a.def.subtitle}</span>
              <span className="font-bold text-slate-200 ml-1">{a.value}</span>
            </div>
          </div>
        </React.Fragment>
      ))}

      {/* Anatomical Labels Toggle Button */}
      <button
        id="btn-toggle-annotations"
        type="button"
        className="absolute top-2 right-2 z-30 pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700 px-2 py-0.5 rounded font-mono text-[9px] font-semibold text-slate-200 hover:text-sky-400 hover:border-sky-400 flex items-center gap-1 shadow transition-all cursor-pointer"
        onClick={() => setShowAnnotations(!showAnnotations)}
      >
        <span className="material-symbols-outlined text-[13px] text-sky-400">label</span>
        <span>Labels: {showAnnotations ? 'ON' : 'OFF'}</span>
      </button>

      {/* FLOATING HUD — LEFT VERTICAL STACK */}
      <div className="absolute z-10 left-2 top-2 bottom-2 flex flex-col justify-between gap-2 pointer-events-none py-2">
        {/* Left-1: Chamber Mechanics */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded p-1.5 shadow-lg flex flex-col gap-1 w-44">
          <div className="flex items-center justify-between pb-0.5 border-b border-slate-700">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-clinical-cyan text-[13px]">cardiology</span>
              <span className="font-mono text-[9px] uppercase font-bold text-slate-100 tracking-wider">LV Chamber</span>
            </div>
            <span className={`font-mono text-[7px] px-1 py-0.2 rounded border font-bold ${efBadgeStyle}`} id="hud-ef-status">
              {efBadgeText}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center font-mono">
            <div className="bg-slate-800/80 p-1 rounded border border-slate-700/60">
              <span className="text-[7px] text-slate-400 block font-medium">EDV</span>
              <span className="text-[11px] font-bold text-slate-100" id="hud-edv">{live.edv}</span>
              <span className="text-[7px] text-slate-400 block">mL</span>
            </div>
            <div className="bg-slate-800/80 p-1 rounded border border-slate-700/60">
              <span className="text-[7px] text-slate-400 block font-medium">ESV</span>
              <span className="text-[11px] font-bold text-slate-100" id="hud-esv">{live.esv}</span>
              <span className="text-[7px] text-slate-400 block">mL</span>
            </div>
            <div className="bg-slate-800/80 p-1 rounded border border-slate-700/60">
              <span className="text-[7px] text-slate-400 block font-medium">EF %</span>
              <span className="text-[11px] font-bold text-emerald-400" id="hud-ef">{live.ef}</span>
              <span className="text-[7px] text-slate-400 block">%</span>
            </div>
          </div>
        </div>

        {/* Left-2: Contractility & SVR indicator */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded p-1 shadow-lg flex items-center gap-2">
          <div className="w-7 h-7 relative flex items-center justify-center">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-700"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="text-clinical-cyan transition-all duration-300"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                id="gauge-contractility-circle"
                stroke="currentColor"
                strokeDasharray={`${contractPct}, 100`}
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
            <span className="absolute font-mono text-[8px] text-clinical-cyan font-bold" id="hud-contract-val">
              {contractility.toFixed(1)}x
            </span>
          </div>
          <div className="flex flex-col font-mono leading-none pr-1">
            <span className="text-[7px] text-slate-400 uppercase font-semibold">SVR Load</span>
            <span className="text-[11px] font-bold text-slate-100" id="hud-svr-val">{Math.round(svr)}</span>
            <span className="text-[6px] text-slate-400">dyn·s/cm⁵</span>
          </div>
        </div>
      </div>

      {/* FLOATING HUD — RIGHT VERTICAL STACK */}
      <div className="absolute z-10 right-2 top-10 bottom-2 flex flex-col justify-between gap-2 pointer-events-none py-2">
        {/* Right-1: Valvular Cycle Enunciators */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded p-1.5 shadow-lg flex flex-col gap-1 w-40">
          <div className="flex items-center justify-between pb-0.5 border-b border-slate-700">
            <span className="font-mono text-[9px] uppercase font-bold text-slate-300 tracking-wider">Valvular State</span>
            <span className="font-mono text-[7px] text-clinical-teal font-semibold">CYCLE 60Hz</span>
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono text-[8px]">
            <div className="bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Mitral</span>
              <span className={`text-[7px] font-bold px-1 rounded border ${live.valves.mitral.is_open ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' : 'text-slate-400 border-transparent'}`}>
                {live.valves.mitral.is_open ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Aortic</span>
              <span className={`text-[7px] font-bold px-1 rounded border ${live.valves.aortic.is_open ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' : 'text-slate-400 border-transparent'}`}>
                {live.valves.aortic.is_open ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Tricuspid</span>
              <span className={`text-[7px] font-bold px-1 rounded border ${live.valves.tricuspid.is_open ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' : 'text-slate-400 border-transparent'}`}>
                {live.valves.tricuspid.is_open ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div className="bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Pulmonic</span>
              <span className={`text-[7px] font-bold px-1 rounded border ${live.valves.pulmonic.is_open ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' : 'text-slate-400 border-transparent'}`}>
                {live.valves.pulmonic.is_open ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>
        </div>

        {/* Right-2: Coronary Perfusion Pressure & Demand */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded p-1 shadow-lg flex items-center gap-1.5 font-mono">
          <div className="flex flex-col text-right leading-none">
            <span className="text-[7px] text-slate-400 uppercase font-semibold">Coronary CPP</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-[11px] font-bold text-clinical-cyan" id="hud-cpp">{live.cpp}</span>
              <span className="text-[7px] text-slate-400">mmHg</span>
            </div>
            <span className="text-[7px] text-slate-400 mt-0.5 font-medium">
              MVO₂: <strong className="text-emerald-400" id="hud-mvo2">{live.mvo2}</strong> mL
            </span>
          </div>
          <div className="w-1.5 h-6 bg-slate-800 rounded overflow-hidden flex flex-col justify-end border border-slate-700">
            <div className="w-full bg-clinical-cyan rounded-b transition-all duration-300" id="bar-cpp" style={{ height: `${cppPct}%` }}></div>
          </div>
        </div>
      </div>
    </section>
  );
};
