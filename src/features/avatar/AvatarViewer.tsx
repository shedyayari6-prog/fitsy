import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { buildAvatar, disposeGroup } from './build';
import type { AvatarConfig, GarmentSpec } from './types';

type ViewName = 'front' | 'side' | 'back';
const VIEWS: { id: ViewName; label: string; theta: number }[] = [
  { id: 'front', label: 'Front', theta: 0 },
  { id: 'side', label: 'Side', theta: Math.PI / 2 },
  { id: 'back', label: 'Back', theta: Math.PI },
];

interface Props {
  config: AvatarConfig;
  garments: GarmentSpec[];
  /** Spoken description for screen readers, e.g. "Avatar wearing White tee, Blue jeans". */
  label: string;
  /** Small caption in the corner, e.g. the fit-preview disclaimer. */
  badge?: string;
  /** Shows a quiet "preparing" chip while garment photos load. */
  busy?: boolean;
  /** Compact mode (compare view) keeps only the Front / Side / Back switch. */
  compact?: boolean;
}

interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  shadow: THREE.Mesh;
  group: THREE.Group | null;
  H: number;
  dirty: boolean;
  raf: number;
  tween: number;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  if (x) {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(31,49,40,.34)');
    g.addColorStop(1, 'rgba(31,49,40,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

export default function AvatarViewer({ config, garments, label, badge, busy, compact }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewName | null>('front');

  const render = useCallback(() => {
    const r = rig.current;
    if (!r || r.raf) return;
    r.raf = requestAnimationFrame(function tick() {
      r.raf = 0;
      const moved = r.controls.update();
      if (r.dirty || moved) { r.dirty = false; r.renderer.render(r.scene, r.camera); }
      if (moved) r.raf = requestAnimationFrame(tick);
    });
  }, []);

  /** Smoothly moves the camera to a spherical position around the target. */
  const flyTo = useCallback((target: { theta?: number; radius?: number }) => {
    const r = rig.current;
    if (!r) return;
    cancelAnimationFrame(r.tween);
    const off = r.camera.position.clone().sub(r.controls.target);
    const from = new THREE.Spherical().setFromVector3(off);
    const to = from.clone();
    if (target.theta !== undefined) {
      let d = target.theta - from.theta;
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      to.theta = from.theta + d;
      to.phi = Math.PI / 2 - 0.08;
    }
    if (target.radius !== undefined) to.radius = Math.min(r.controls.maxDistance, Math.max(r.controls.minDistance, target.radius));
    const start = performance.now(), dur = reduceMotion() ? 0 : 420;
    const step = (now: number) => {
      const k = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
      const e = k * k * (3 - 2 * k);
      const s = new THREE.Spherical(from.radius + (to.radius - from.radius) * e, from.phi + (to.phi - from.phi) * e, from.theta + (to.theta - from.theta) * e);
      r.camera.position.copy(r.controls.target).add(new THREE.Vector3().setFromSpherical(s));
      r.camera.lookAt(r.controls.target);
      r.dirty = true;
      render();
      if (k < 1) r.tween = requestAnimationFrame(step);
    };
    r.tween = requestAnimationFrame(step);
  }, [render]);

  // Create the renderer once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed('Your browser could not start the 3D view. Try updating it or turning on hardware acceleration.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6c0, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 3.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff4e6, 0.55);
    fill.position.set(-3, 1.5, -2);
    scene.add(fill);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxPolarAngle = Math.PI * 0.62;

    const r: Rig = { renderer, scene, camera, controls, shadow, group: null, H: 0, dirty: true, raf: 0, tween: 0 };
    rig.current = r;
    controls.addEventListener('change', render);
    controls.addEventListener('start', () => setView(null));

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      r.dirty = true;
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const onLost = (e: Event) => { e.preventDefault(); setFailed('The 3D view was interrupted by your device. Reload the page to restore it.'); };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(r.raf);
      cancelAnimationFrame(r.tween);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      if (r.group) { scene.remove(r.group); disposeGroup(r.group); }
      (shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      (shadow.material as THREE.Material).dispose();
      shadow.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rig.current = null;
    };
  }, [render]);

  // Rebuild the avatar whenever the body, appearance or outfit changes. This is what makes
  // slider changes appear immediately.
  useEffect(() => {
    const r = rig.current;
    if (!r) return;
    const { group, body } = buildAvatar(config, garments);
    if (r.group) { r.scene.remove(r.group); disposeGroup(r.group); }
    r.group = group;
    r.scene.add(group);

    const size = body.H * 0.5;
    r.shadow.scale.set(size, size, 1);
    r.shadow.position.y = 0.001;

    if (r.H !== body.H) {
      const first = r.H === 0;
      const ratio = first ? 1 : body.H / r.H;
      r.H = body.H;
      r.controls.target.set(0, body.H * 0.5, 0);
      r.controls.minDistance = body.H * 0.9;
      r.controls.maxDistance = body.H * 4.2;
      if (first) r.camera.position.set(0, body.H * 0.5 + body.H * 0.12, body.H * 2.45);
      else r.camera.position.sub(r.controls.target).multiplyScalar(ratio).add(r.controls.target);
      r.camera.lookAt(r.controls.target);
      r.controls.update();
    }
    r.dirty = true;
    render();
    setReady(true);
  }, [config, garments, render]);

  const go = (v: ViewName) => { setView(v); flyTo({ theta: VIEWS.find((x) => x.id === v)?.theta, radius: (rig.current?.H ?? 1.7) * 2.45 }); };
  const rotate = (deg: number) => {
    const r = rig.current;
    if (!r) return;
    setView(null);
    flyTo({ theta: r.controls.getAzimuthalAngle() + (deg * Math.PI) / 180 });
  };
  const zoom = (f: number) => {
    const r = rig.current;
    if (r) flyTo({ radius: r.camera.position.distanceTo(r.controls.target) * f });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); rotate(-20); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); rotate(20); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(0.8); }
    else if (e.key === '-') { e.preventDefault(); zoom(1.25); }
    else if (e.key === '0') { e.preventDefault(); go('front'); }
  };

  return (
    <div className="avx__viewer" role="group" aria-label="3D avatar viewer" tabIndex={0} onKeyDown={onKey}
      aria-describedby="avx-viewer-help" ref={host}>
      <p className="sr-only" aria-live="polite">{label}</p>
      <p id="avx-viewer-help" className="sr-only">
        Drag to rotate, scroll or pinch to zoom. With the keyboard: left and right arrows rotate, plus and minus zoom, zero returns to the front view.
      </p>

      {!ready && !failed && <div className="avx__state"><span className="mv__loader">Loading 3D view…</span></div>}
      {failed && <div className="avx__state avx__state--error" role="alert"><p>{failed}</p></div>}

      {badge && !failed && <span className="avx__tag">{badge}</span>}
      {busy && !failed && <span className="avx__tag avx__tag--busy" role="status">Preparing garments…</span>}

      {!failed && (
        <div className="avx__toolbar">
          <div className="avx__seg" role="group" aria-label="Camera view">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => go(v.id)}>{v.label}</button>
            ))}
          </div>
          {!compact && (
            <div className="avx__seg" role="group" aria-label="Rotate and zoom">
              <button type="button" className="avx__ico" aria-label="Rotate left" onClick={() => rotate(-30)}><RotateCcw size={18} aria-hidden /></button>
              <button type="button" className="avx__ico" aria-label="Rotate right" onClick={() => rotate(30)}><RotateCw size={18} aria-hidden /></button>
              <button type="button" className="avx__ico" aria-label="Zoom out" onClick={() => zoom(1.25)}><ZoomOut size={18} aria-hidden /></button>
              <button type="button" className="avx__ico" aria-label="Zoom in" onClick={() => zoom(0.8)}><ZoomIn size={18} aria-hidden /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
