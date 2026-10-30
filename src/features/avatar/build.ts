/**
 * Builds the avatar and its garments as plain three.js geometry from the parametric Body.
 *
 * There are no downloaded meshes and no morph targets. Every slider change just calls
 * buildAvatar again, which takes a few milliseconds, so the model updates as you drag.
 *
 * Garments are NOT flat images pasted over the avatar. Each one is a shell generated from the
 * avatar's own cross-sections (torso rings, arm and leg tubes), offset outwards by a small margin,
 * so it follows the current proportions. The wardrobe photo is then projected onto that shell as a
 * texture. This is a visual preview, not a cloth or fit simulation.
 */
import * as THREE from 'three';
import { deriveBody, type Body } from './body';
import type { AvatarConfig, GarmentSpec } from './types';

const RADIAL = 40;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Ring { y: number; a: number; b: number }

// ── primitives ─────────────────────────────────────────────────────────────

function bustOffset(body: Body, x: number, y: number, z: number, depth: number): number {
  if (body.bust <= 0 || z <= 0) return 0;
  const dy = (y - body.bustY) / (0.05 * body.H);
  let g = 0;
  for (const s of [-1, 1]) {
    const dx = (x - s * 0.5 * body.chestA) / (0.45 * body.chestA);
    g = Math.max(g, Math.exp(-(dx * dx + dy * dy)));
  }
  return body.bust * g * Math.min(1, z / depth);
}

/** Lofts elliptical rings into a smooth open surface. Index wraps, so there is no shading seam. */
function loft(body: Body, rings: Ring[], margin: number): THREE.BufferGeometry {
  const M = rings.length;
  const pos = new Float32Array(M * RADIAL * 3);
  for (let i = 0; i < M; i++) {
    const { y, a, b } = rings[i];
    for (let j = 0; j < RADIAL; j++) {
      const t = (j / RADIAL) * Math.PI * 2;
      const x = Math.sin(t) * (a + margin);
      let z = Math.cos(t) * (b + margin);
      z += bustOffset(body, x, y, z, b + margin);
      pos.set([x, y, z], (i * RADIAL + j) * 3);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < M - 1; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * RADIAL + j, b = i * RADIAL + ((j + 1) % RADIAL);
      const c = (i + 1) * RADIAL + j, d = (i + 1) * RADIAL + ((j + 1) % RADIAL);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ringsBetween(body: Body, y0: number, y1: number, n: number): Ring[] {
  return Array.from({ length: n }, (_, i) => {
    const y = lerp(y0, y1, i / (n - 1));
    const r = body.ringAt(y);
    return { y, a: r.a, b: r.b };
  });
}

/** Open tapered tube from p0 (radius r0) to p1 (radius r1), baked into world space. */
function tube(p0: THREE.Vector3, p1: THREE.Vector3, r0: number, r1: number, seg = 24): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5), q, V(1, 1, 1)));
  return g;
}

function ellipsoid(c: THREE.Vector3, rx: number, ry: number, rz: number, w = 24, h = 16): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(c.x, c.y, c.z);
  return g;
}

const ball = (c: THREE.Vector3, r: number) => ellipsoid(c, r, r, r, 20, 14);

// ── body landmarks ─────────────────────────────────────────────────────────

function armPoints(b: Body, s: 1 | -1) {
  const sh = V(s * b.shoulderJointX, b.shoulderJointY, 0);
  const d1 = V(s * Math.sin(b.arm.theta), -Math.cos(b.arm.theta), 0);
  const el = sh.clone().addScaledVector(d1, b.arm.upperLen);
  const th2 = b.arm.theta + 0.05;
  const d2 = V(s * Math.sin(th2), -Math.cos(th2), 0.05).normalize();
  const wr = el.clone().addScaledVector(d2, b.arm.foreLen);
  return { sh, el, wr, d2 };
}

function legPoints(b: Body, s: 1 | -1) {
  return {
    hip: V(s * b.leg.x, b.crotchY + 0.05 * b.H, 0),
    knee: V(s * b.leg.x, b.leg.kneeY, 0.004 * b.H),
    ankle: V(s * b.leg.x, b.leg.ankleY, 0),
  };
}

// ── skin ───────────────────────────────────────────────────────────────────

function skinParts(b: Body): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  out.push(loft(b, ringsBetween(b, b.crotchY, b.neckBaseY, 36), 0));
  out.push(tube(V(0, b.neck.y0, 0), V(0, b.neck.y1, 0.004 * b.H), b.neck.r, b.neck.r * 0.94));
  out.push(ellipsoid(V(0, b.head.y, b.head.z), b.head.rx, b.head.ry, b.head.rz, 56, 40));

  for (const s of [1, -1] as const) {
    const { sh, el, wr, d2 } = armPoints(b, s);
    const a = b.arm;
    out.push(ball(sh, a.upperR * 1.2));
    out.push(tube(sh, el, a.upperR, a.foreR * 1.12));
    out.push(ball(el, a.foreR * 1.12));
    out.push(tube(el, wr, a.foreR * 1.12, a.wristR));
    out.push(ball(wr, a.wristR * 1.05));
    // Round mitten hand with a small thumb, like the character.
    const hand = wr.clone().addScaledVector(d2, a.handR * 0.8);
    out.push(ball(hand, a.handR));
    out.push(ball(hand.clone().add(V(-s * a.handR * 0.2, a.handR * 0.35, a.handR * 0.85)), a.handR * 0.42));

    const { hip, knee, ankle } = legPoints(b, s);
    const l = b.leg;
    out.push(ball(hip, l.thighR));
    out.push(tube(hip, knee, l.thighR, l.kneeR));
    out.push(ball(knee, l.kneeR));
    out.push(tube(knee, ankle, l.kneeR * 1.04, l.ankleR));
    out.push(ellipsoid(knee.clone().lerp(ankle, 0.3), l.calfR, (knee.y - ankle.y) * 0.24, l.calfR * 0.95));
    out.push(ball(ankle, l.ankleR));
    out.push(ellipsoid(V(s * l.x, b.foot.h / 2, b.foot.len * 0.28), b.foot.w / 2, b.foot.h / 2, b.foot.len / 2));
  }
  return out;
}

// ── hair ───────────────────────────────────────────────────────────────────

function addHair(group: THREE.Group, b: Body, hair: AvatarConfig['hair'], color: string) {
  if (hair === 'none') return;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const { rx, ry, rz } = b.head;
  const c = V(0, b.head.y, b.head.z);

  const cap = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
  cap.scale(rx * 1.07, ry * 1.06, rz * 1.08);
  cap.rotateX(-0.28);
  cap.translate(c.x, c.y, c.z);
  group.add(new THREE.Mesh(cap, mat));

  if (hair === 'long') {
    group.add(new THREE.Mesh(ellipsoid(V(0, c.y - ry * 0.7, c.z - rz * 0.5), rx * 1.02, ry * 0.85, rz * 0.34), mat));
  } else if (hair === 'bun') {
    group.add(new THREE.Mesh(ball(V(0, c.y + ry * 1.02, c.z - rz * 0.35), rx * 0.26), mat));
  } else if (hair === 'curly') {
    const count = 70, r = rx * 0.13;
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const polar = Math.acos(1 - t * (1 - Math.cos(Math.PI * 0.6)));
      const az = i * 2.399963;
      const d = V(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
      const p = V(c.x + d.x * rx * 1.06, c.y + d.y * ry * 1.05, c.z + d.z * rz * 1.06 - 0.01 * b.H);
      m.compose(p, new THREE.Quaternion(), V(r, r, r));
      inst.setMatrixAt(i, m);
    }
    group.add(inst);
  }
}

/**
 * The character's face: two tall dark-green eyes with a white highlight, small arched brows and a
 * small smile. Everything is placed on the head ellipsoid so it follows the head's shape.
 */
function addFace(group: THREE.Group, b: Body) {
  const { rx, ry, rz, y: hy, z: hz } = b.head;
  const dark = new THREE.MeshStandardMaterial({ color: '#2B3F33', roughness: 0.45 });
  const white = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 });
  const surf = (u: number, v: number, out = 0) => {
    const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    const n = V(u / rx, v / ry, w / rz).normalize();
    const p = V(u * rx, hy + v * ry, hz + w * rz).addScaledVector(n, out);
    return { p, n };
  };
  const stroke = (pts: [number, number][], r: number, out: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([u, v]) => surf(u, v, out).p));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, r, 8, false), dark));
  };

  for (const s of [-1, 1]) {
    const eye = surf(s * 0.4, -0.12, -rx * 0.012);
    const g = new THREE.SphereGeometry(1, 24, 18);
    g.scale(rx * 0.14, ry * 0.22, rx * 0.06);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), eye.n));
    g.translate(eye.p.x, eye.p.y, eye.p.z);
    group.add(new THREE.Mesh(g, dark));

    const hl = surf(s * 0.4 + 0.05, -0.12 + 0.09, rx * 0.04);
    group.add(new THREE.Mesh(ball(hl.p, rx * 0.038), white));

    stroke([[s * 0.4 - 0.11, 0.2], [s * 0.4, 0.26], [s * 0.4 + 0.11, 0.2]], rx * 0.014, rx * 0.004);
  }
  stroke([[-0.13, -0.33], [-0.065, -0.395], [0, -0.41], [0.065, -0.395], [0.13, -0.33]], rx * 0.016, rx * 0.005);
}

// ── garments ───────────────────────────────────────────────────────────────

function topShell(b: Body, m: number, sleeve: 'none' | 'short' | 'long', hemY: number, topY = b.neckBaseY): THREE.BufferGeometry[] {
  const out = [loft(b, ringsBetween(b, hemY, topY, 30), m)];
  if (sleeve === 'none') return out;
  const a = b.arm;
  for (const s of [1, -1] as const) {
    const { sh, el, wr } = armPoints(b, s);
    out.push(ball(sh, a.upperR * 1.2 + m));
    if (sleeve === 'long') {
      out.push(tube(sh, el, a.upperR + m, a.foreR * 1.12 + m));
      out.push(ball(el, a.foreR * 1.12 + m));
      out.push(tube(el, wr, a.foreR * 1.12 + m, a.wristR + m + 0.006));
    } else {
      const end = sh.clone().lerp(el, 0.62);
      out.push(tube(sh, end, a.upperR + m, lerp(a.upperR, a.foreR * 1.12, 0.62) + m));
    }
  }
  return out;
}

function pelvisShell(b: Body, m: number): THREE.BufferGeometry {
  return loft(b, ringsBetween(b, b.waistY - 0.006 * b.H, b.crotchY + 0.004 * b.H, 14), m);
}

function skirtShell(b: Body, m: number, fromY: number, hemY: number): THREE.BufferGeometry {
  const hip = b.ringAt(b.hipY);
  const rings: Ring[] = Array.from({ length: 16 }, (_, i) => {
    const y = lerp(fromY, hemY, i / 15);
    if (y >= b.hipY) { const r = b.ringAt(y); return { y, a: r.a, b: r.b }; }
    const u = (b.hipY - y) / (b.hipY - hemY);
    const f = 1 + 0.16 * smooth(0, 1, u);
    return { y, a: hip.a * f, b: hip.b * f };
  });
  return loft(b, rings, m);
}

function bottomShell(b: Body, m: number, kind: 'pants' | 'skirt' | 'shorts'): THREE.BufferGeometry[] {
  if (kind === 'skirt') return [skirtShell(b, m, b.waistY - 0.006 * b.H, b.leg.kneeY + 0.03 * b.H)];
  const out = [pelvisShell(b, m)];
  const l = b.leg;
  for (const s of [1, -1] as const) {
    const { hip, knee, ankle } = legPoints(b, s);
    if (kind === 'shorts') {
      const end = hip.clone().lerp(knee, 0.55);
      out.push(tube(hip, end, l.thighR + m, lerp(l.thighR, l.kneeR, 0.55) + m));
    } else {
      out.push(tube(hip, knee, l.thighR + m, l.kneeR + m));
      out.push(ball(knee, l.kneeR + m));
      out.push(tube(knee, ankle.clone().setY(ankle.y + 0.015 * b.H), l.kneeR * 1.04 + m, l.ankleR + m + 0.006));
      out.push(ellipsoid(knee.clone().lerp(ankle, 0.3), l.calfR + m, (knee.y - ankle.y) * 0.24, (l.calfR + m) * 0.97));
    }
  }
  return out;
}

function dressShell(b: Body, m: number): THREE.BufferGeometry[] {
  return [
    ...topShell(b, m, 'none', b.hipY - 0.01 * b.H),
    skirtShell(b, m, b.hipY + 0.01 * b.H, b.leg.kneeY + 0.02 * b.H),
  ];
}

function shoeShell(b: Body, m: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const s of [1, -1] as const) {
    const l = b.leg;
    out.push(ellipsoid(V(s * l.x, b.foot.h / 2 + 0.001, b.foot.len * 0.28), b.foot.w / 2 + m, b.foot.h / 2 + m, b.foot.len / 2 + m));
    out.push(tube(V(s * l.x, l.ankleY - 0.01 * b.H, 0), V(s * l.x, l.ankleY + 0.03 * b.H, 0), l.ankleR + m, l.ankleR + m));
  }
  return out;
}

/**
 * Projects the garment photo onto the shell. All pieces of one garment share a bounding box so the
 * photo spans them as a whole. Surfaces facing away from the camera blend to a corner of the
 * texture, which prepareTexture() fills with the garment's average colour, so the back and sides
 * read as plain fabric instead of a smeared stretch of the photo.
 */
function projectUV(geoms: THREE.BufferGeometry[], mode: 'front' | 'side') {
  const box = new THREE.Box3();
  for (const g of geoms) { g.computeBoundingBox(); box.union(g.boundingBox as THREE.Box3); }
  const sx = box.max.x - box.min.x || 1, sy = box.max.y - box.min.y || 1, sz = box.max.z - box.min.z || 1;
  for (const g of geoms) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let fu: number, f: number;
      const fv = (y - box.min.y) / sy;
      if (mode === 'front') {
        fu = (x - box.min.x) / sx;
        f = smooth(-0.15, 0.5, n.getZ(i));
      } else {
        const side = x >= 0 ? 1 : -1;
        fu = side > 0 ? (z - box.min.z) / sz : 1 - (z - box.min.z) / sz;
        f = smooth(0.15, 0.65, n.getX(i) * side);
      }
      uv[i * 2] = lerp(0.015, fu, f);
      uv[i * 2 + 1] = lerp(0.015, fv, f);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
}

function garmentGeoms(b: Body, spec: GarmentSpec): THREE.BufferGeometry[] {
  switch (spec.slot) {
    case 'top': return topShell(b, 0.010, 'short', b.hipY - 0.012 * b.H);
    case 'outer': return topShell(b, 0.024, 'long', b.crotchY + 0.012 * b.H);
    case 'bottom': return bottomShell(b, 0.008, spec.kind ?? 'pants');
    case 'dress': return dressShell(b, 0.010);
    case 'shoes': return shoeShell(b, 0.008);
  }
}

// ── assembly ───────────────────────────────────────────────────────────────

export function buildAvatar(cfg: AvatarConfig, specs: GarmentSpec[]): { group: THREE.Group; body: Body } {
  const body = deriveBody(cfg);
  const group = new THREE.Group();
  const add = (geoms: THREE.BufferGeometry[], mat: THREE.Material) => geoms.forEach((g) => group.add(new THREE.Mesh(g, mat)));

  add(skinParts(body), new THREE.MeshStandardMaterial({ color: cfg.skin, roughness: 0.85, metalness: 0 }));
  addHair(group, body, cfg.hair, cfg.hairColor);
  addFace(group, body);

  for (const spec of specs) {
    const geoms = garmentGeoms(body, spec);
    projectUV(geoms, spec.slot === 'shoes' ? 'side' : 'front');
    const mat = new THREE.MeshStandardMaterial({
      map: spec.texture, color: spec.color, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    });
    add(geoms, mat);
  }
  return { group, body };
}

/** Frees geometry and materials. Textures are shared through a cache, so they are left alone. */
export function disposeGroup(group: THREE.Object3D) {
  const mats = new Set<THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
  mats.forEach((m) => m.dispose());
}