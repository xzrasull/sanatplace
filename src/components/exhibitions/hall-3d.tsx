// src/components/exhibitions/hall-3d.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EYE, type RoomLayout } from '@/src/lib/exhibitions/room-layout';
import { prefersReducedMotion } from '@/src/lib/sanat/reveal';
import { isStorageUrl } from '@/src/lib/uploads/buckets';

export type HallApi = { walkTo: (index: number) => void };

type Props = {
  layout: RoomLayout;
  images: string[]; // in the layout's order
  wall: string;
  label: string;
  onFocus: (index: number) => void; // the work in front of the visitor, or -1
  onOpen: (index: number) => void; // a click on the work already in front
  onReady: (api: HallApi) => void;
};

const SPEED = 2.4; // m/s
const TURN = 1.8; // rad/s
const MAX_PITCH = 0.6;

// Stored photos come through Next's optimizer (a ~1000 px webp/avif from our
// origin); other addresses are loaded as they are.
const textureUrl = (src: string) => (isStorageUrl(src) ? `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75` : src);

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const angleTo = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

// One hall as a small room the visitor walks through. Nothing is drawn while
// nothing moves: a frame is asked for on input and while a walk lasts.
export default function Hall3D({ layout, images, wall, label, onFocus, onOpen, onReady }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef({ onFocus, onOpen, onReady });
  cb.current = { onFocus, onOpen, onReady };

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    const { width: W, depth: D, height: H, works } = layout;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(wall);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.4, 1, 0.7);
    scene.add(sun);

    // the room: floor, ceiling, four walls and skirting, from two shared shapes
    const plane = new THREE.PlaneGeometry(1, 1);
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const wallMat = new THREE.MeshLambertMaterial({ color: wall });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xb9a58c });
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const skirtMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(wall).multiplyScalar(0.8) });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
    const mats: THREE.Material[] = [wallMat, floorMat, ceilMat, skirtMat, frameMat];
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, s: [number, number, number], p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(...s);
      m.position.set(...p);
      m.rotation.set(...r);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      return m;
    };
    const floor = add(plane, floorMat, [W, D, 1], [0, 0, 0], [-Math.PI / 2, 0, 0]);
    add(plane, ceilMat, [W, D, 1], [0, H, 0], [Math.PI / 2, 0, 0]);
    for (const [len, x, z, ry] of [
      [W, 0, -D / 2, 0],
      [W, 0, D / 2, Math.PI],
      [D, -W / 2, 0, Math.PI / 2],
      [D, W / 2, 0, -Math.PI / 2],
    ] as const) {
      add(plane, wallMat, [len, H, 1], [x, H / 2, z], [0, ry, 0]);
      add(cube, skirtMat, [len, 0.1, 0.02], [x * 0.998, 0.05, z * 0.998], [0, ry, 0]);
    }

    // the works: a grey card until the photo arrives, in a thin dark frame
    const paintings = works.map((w) => {
      const r: [number, number, number] = [0, w.rotY, 0];
      const back = 0.02; // the frame's face sits just behind the photo
      add(cube, frameMat, [w.w + 0.04, w.h + 0.04, 0.03], [w.x - Math.sin(w.rotY) * back, w.y, w.z - Math.cos(w.rotY) * back], r);
      const mat = new THREE.MeshBasicMaterial({ color: 0xdedbd4 });
      mats.push(mat);
      return add(plane, mat, [w.w, w.h, 1], [w.x, w.y, w.z], r);
    });

    // the visitor
    const pos = new THREE.Vector3(0, EYE, D / 2 - 1.2);
    let yaw = 0;
    let pitch = 0.02;
    const keys = new Set<string>();
    let walk: { from: [number, number, number, number]; to: [number, number, number, number]; t0: number; dur: number } | null = null;
    let frame = 0;
    let last = 0;
    let focus = -1;
    let dead = false;

    const clampToRoom = () => {
      pos.x = Math.min(W / 2 - 0.4, Math.max(-W / 2 + 0.4, pos.x));
      pos.z = Math.min(D / 2 - 0.4, Math.max(-D / 2 + 0.4, pos.z));
    };
    const place = () => {
      camera.position.copy(pos);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    };
    // the most central work in sight, within a few metres
    const fwd = new THREE.Vector3();
    const to = new THREE.Vector3();
    const findFocus = () => {
      camera.getWorldDirection(fwd);
      let best = -1;
      let bestCos = Math.cos(0.4);
      works.forEach((w, i) => {
        to.set(w.x - pos.x, w.y - pos.y, w.z - pos.z);
        const dist = to.length();
        if (dist > Math.max(5, w.w * 2.5)) return;
        const c = to.normalize().dot(fwd);
        if (c > bestCos) [best, bestCos] = [i, c];
      });
      if (best !== focus) cb.current.onFocus((focus = best));
    };

    const tick = (now: number) => {
      frame = 0;
      if (dead) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      let moving = false;
      if (walk) {
        const t = Math.min(1, (now - walk.t0) / walk.dur);
        const k = ease(t);
        const [a, b] = [walk.from, walk.to];
        pos.x = a[0] + (b[0] - a[0]) * k;
        pos.z = a[1] + (b[1] - a[1]) * k;
        yaw = a[2] + (b[2] - a[2]) * k;
        pitch = a[3] + (b[3] - a[3]) * k;
        if (t >= 1) walk = null;
        moving = true;
      }
      if (keys.size) {
        const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
        const s = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
        yaw += ((keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0)) * TURN * dt;
        pos.x += (-Math.sin(yaw) * f + Math.cos(yaw) * s) * SPEED * dt;
        pos.z += (-Math.cos(yaw) * f - Math.sin(yaw) * s) * SPEED * dt;
        clampToRoom();
        moving = true;
      }
      place();
      renderer.render(scene, camera);
      findFocus();
      if (moving) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    const invalidate = () => {
      if (!frame && !dead) frame = requestAnimationFrame(tick);
    };

    const walkTo = (x: number, z: number, y2 = yaw, p2 = pitch) => {
      const target: [number, number, number, number] = [x, z, angleTo(yaw, y2), p2];
      if (prefersReducedMotion()) {
        [pos.x, pos.z, yaw, pitch] = target;
        clampToRoom();
        walk = null;
      } else {
        const dist = Math.hypot(x - pos.x, z - pos.z) + Math.abs(target[2] - yaw);
        walk = { from: [pos.x, pos.z, yaw, pitch], to: target, t0: performance.now(), dur: Math.min(2000, Math.max(450, dist * 420)) };
      }
      invalidate();
    };
    const walkToWork = (i: number) => {
      const w = works[i];
      if (!w) return;
      const [dx, dz] = [w.x - w.standX, w.z - w.standZ];
      walkTo(w.standX, w.standZ, Math.atan2(-dx, -dz), Math.atan2(w.y - EYE, Math.hypot(dx, dz)));
    };
    cb.current.onReady({ walkTo: walkToWork });

    // size follows the box
    const resize = () => {
      const { clientWidth: cw, clientHeight: ch } = host;
      if (!cw || !ch) return;
      renderer.setSize(cw, ch, false);
      camera.aspect = cw / ch;
      camera.fov = cw < ch ? 75 : 60;
      camera.updateProjectionMatrix();
      invalidate();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // photos, nearest first, three at a time
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const textures: THREE.Texture[] = [];
    const queue = works.map((_, i) => i).sort((a, b) => Math.hypot(works[a].x - pos.x, works[a].z - pos.z) - Math.hypot(works[b].x - pos.x, works[b].z - pos.z));
    const next = () => {
      const i = queue.shift();
      if (i === undefined || dead) return;
      loader.load(
        textureUrl(images[i]),
        (tex) => {
          if (dead) return tex.dispose();
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          textures.push(tex);
          const mat = paintings[i].material as THREE.MeshBasicMaterial;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          invalidate();
          next();
        },
        undefined,
        () => next(),
      );
    };
    for (let k = 0; k < 3; k++) next();

    // look by dragging; a click walks to the floor spot or to the work
    let drag: { x: number; y: number; moved: number; touch: boolean } | null = null;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0, touch: e.pointerType !== 'mouse' };
      canvas.setPointerCapture(e.pointerId);
      walk = null;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const [dx, dy] = [e.clientX - drag.x, e.clientY - drag.y];
      drag.moved += Math.abs(dx) + Math.abs(dy);
      [drag.x, drag.y] = [e.clientX, e.clientY];
      const k = drag.touch ? 0.006 : 0.004;
      yaw += dx * k;
      // on a phone, vertical swipes scroll the page (touch-action: pan-y)
      if (!drag.touch) pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch + dy * k));
      invalidate();
    };
    const up = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      if (!d || d.moved > 6) return;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([...paintings, floor], false)[0];
      if (!hit) return;
      const i = paintings.indexOf(hit.object as (typeof paintings)[number]);
      if (i < 0) return walkTo(hit.point.x, hit.point.z);
      const w = works[i];
      if (i === focus && Math.hypot(pos.x - w.standX, pos.z - w.standZ) < 0.6) cb.current.onOpen(i);
      else walkToWork(i);
    };
    const keyName = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      return ({ ц: 'w', ф: 'a', ы: 's', в: 'd' } as Record<string, string>)[k] ?? k;
    };
    const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const keydown = (e: KeyboardEvent) => {
      const k = keyName(e);
      if (!MOVE_KEYS.includes(k) || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      keys.add(k);
      walk = null;
      invalidate();
    };
    const keyup = (e: KeyboardEvent) => keys.delete(keyName(e));
    const blur = () => keys.clear();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => (drag = null));
    canvas.addEventListener('keydown', keydown);
    canvas.addEventListener('keyup', keyup);
    canvas.addEventListener('blur', blur);

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      textures.forEach((t) => t.dispose());
      mats.forEach((m) => m.dispose());
      plane.dispose();
      cube.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [layout, images, wall, label]);

  return <div ref={box} className="ex-3d-canvas" />;
}
