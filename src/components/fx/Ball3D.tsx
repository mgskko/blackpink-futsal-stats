import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface Ball3DProps {
  /** CSS size in px (canvas is square) */
  size?: number;
  /** idle spin speed (rad/s) */
  spin?: number;
  /** allow drag-to-spin with inertia */
  interactive?: boolean;
  className?: string;
  /** hex colour of the pentagon rim accent */
  accent?: string;
}

/* ── Truncated-icosahedron panel centres ──────────────────────────────────
 * A classic match ball is the spherical Voronoi diagram of the 12 vertices
 * (pentagons) and 20 face centres (hexagons) of an icosahedron. We compute
 * the pattern per-fragment in the shader, so the ball is razor-sharp at any
 * size and needs no texture download. */
function panelCentres(): THREE.Vector3[] {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute("position");
  const verts: THREE.Vector3[] = [];
  const key = (v: THREE.Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  const seen = new Set<string>();
  const faces: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    faces.push(a.clone().add(b).add(c).normalize());
    [a, b, c].forEach(v => {
      const k = key(v);
      if (!seen.has(k)) {
        seen.add(k);
        verts.push(v.clone().normalize());
      }
    });
  }
  geo.dispose();
  return [...verts, ...faces]; // first 12 = pentagons
}

const CENTRES = panelCentres();

/**
 * Real-time glossy 3D futsal ball (three.js). Self-contained: own renderer,
 * pauses when offscreen or in a background tab, honours reduced-motion and
 * cleans up every GPU resource on unmount.
 */
export default function Ball3D({ size = 160, spin = 0.5, interactive = true, className, accent = "#ff5fae" }: Ball3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      host.dataset.fallback = "1"; // CSS fallback ball stays visible
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = `${size}px`;
    renderer.domElement.style.height = `${size}px`;
    renderer.domElement.style.touchAction = interactive ? "none" : "auto";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 0, 4.3);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 3);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 3.2);
    rim.position.set(2.5, -1, -2.5);
    const fill = new THREE.HemisphereLight(0xbfd4ff, 0x1a0b14, 0.5);
    scene.add(key, rim, fill);

    const geometry = new THREE.SphereGeometry(1, 128, 96);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
      sheenColor: new THREE.Color(accent),
    });
    const uniforms = {
      uCentres: { value: CENTRES },
      uAccent: { value: new THREE.Color(accent) },
    };
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vObjN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjN = normalize(position);");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vObjN;
uniform vec3 uCentres[32];
uniform vec3 uAccent;`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  vec3 n = normalize(vObjN);
  float d1 = -2.0; float d2 = -2.0; int i1 = 0;
  for (int i = 0; i < 32; i++) {
    float d = dot(n, uCentres[i]);
    if (d > d1) { d2 = d1; d1 = d; i1 = i; }
    else if (d > d2) { d2 = d; }
  }
  float e = d1 - d2;                    // distance to nearest seam
  float aa = fwidth(e) * 1.2;
  float seam = 1.0 - smoothstep(0.006 - aa, 0.006 + aa, e);
  bool pent = i1 < 12;
  vec3 hex = vec3(0.96, 0.965, 0.975);
  vec3 pnt = vec3(0.045, 0.045, 0.06);
  float ring = pent ? (1.0 - smoothstep(0.045 - aa, 0.045 + aa, e)) : 0.0;
  vec3 base = pent ? mix(pnt, uAccent, ring) : hex;
  base = mix(base, vec3(0.18, 0.18, 0.2), seam);
  diffuseColor.rgb = base;
}`
        );
    };
    const ball = new THREE.Mesh(geometry, material);
    ball.rotation.set(0.35, 0.6, 0.1);
    scene.add(ball);

    // ── interaction: drag-to-spin with inertia ──
    const vel = new THREE.Vector2(0, reduce ? 0 : spin);
    let dragging = false;
    let last = { x: 0, y: 0, t: 0 };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(16, now - last.t) / 1000;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      ball.rotation.y += dx * 0.012;
      ball.rotation.x += dy * 0.012;
      vel.set((dy * 0.012) / dt, (dx * 0.012) / dt);
      last = { x: e.clientX, y: e.clientY, t: now };
    };
    const onUp = () => (dragging = false);
    if (interactive) {
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);
      renderer.domElement.style.cursor = "grab";
    }

    // ── render loop (only while visible) ──
    let raf = 0;
    let visible = true;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!dragging) {
        ball.rotation.x += vel.x * dt;
        ball.rotation.y += vel.y * dt;
        // ease back to idle spin
        vel.x *= 0.95;
        vel.y += ((reduce ? 0 : spin) - vel.y) * 0.03;
      }
      ball.position.y = reduce ? 0 : Math.sin(now / 900) * 0.04;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    renderer.render(scene, camera);
    host.dataset.ready = "1";
    start();

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      geometry.dispose();
      material.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.ready;
    };
  }, [size, spin, interactive, accent]);

  return (
    <div
      ref={hostRef}
      className={`group/ball relative ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* CSS stand-in shown until WebGL paints (or if it is unavailable) */}
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_32%_28%,#fff_0%,#e9e9ef_38%,#9a9aa8_75%,#3a3a44_100%)] opacity-100 transition-opacity duration-500 group-data-[ready=1]/ball:opacity-0" />
    </div>
  );
}
