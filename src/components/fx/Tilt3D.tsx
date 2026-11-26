import { useRef, type ReactNode, type PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** classes for the tilting plane (put radius / border / background here) */
  className?: string;
  /** classes for the outer perspective wrapper (margins, sizing) */
  wrapperClassName?: string;
  /** max tilt in degrees */
  max?: number;
  /** show holographic foil sheen that follows the pointer */
  holo?: boolean;
}

/**
 * Physical 3D tilt card: rotates toward the pointer with spring physics and
 * casts a moving specular / holographic highlight. Children can use
 * `style={{ transform: "translateZ(40px)" }}` to float above the card.
 */
export default function Tilt3D({ children, className, wrapperClassName, max = 10, holo = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const active = useMotionValue(0);

  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const rotX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const glare = useSpring(active, { stiffness: 120, damping: 20 });
  const mx = useTransform(px, v => `${v * 100}%`);
  const my = useTransform(py, v => `${v * 100}%`);
  const holoO = useTransform(glare, v => v * 0.9);
  const sheen = useMotionTemplate`radial-gradient(circle at ${mx} ${my}, hsl(0 0% 100% / 0.18), transparent 50%)`;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
    active.set(1);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
    active.set(0);
  };

  return (
    <div style={{ perspective: 1000 }} className={wrapperClassName}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        onPointerCancel={reset}
        onPointerUp={e => e.pointerType !== "mouse" && reset()}
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className={cn("relative h-full w-full will-change-transform", className)}
      >
        {children}
        {holo && (
          <>
            <motion.div
              aria-hidden
              className="holo-foil pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
              style={{ ["--mx" as string]: mx, ["--my" as string]: my, ["--holo-o" as string]: holoO }}
            />
            <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]" style={{ background: sheen, opacity: glare }} />
          </>
        )}
      </motion.div>
    </div>
  );
}

/** Wrap children so they float above a Tilt3D plane. */
export function Float3D({ z = 30, className, children }: { z?: number; className?: string; children: ReactNode }) {
  return (
    <div className={cn(className)} style={{ transform: `translateZ(${z}px)`, transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}
