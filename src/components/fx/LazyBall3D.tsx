import { lazy, Suspense } from "react";
import type { Ball3DProps } from "./Ball3D";

const Ball3D = lazy(() => import("./Ball3D"));

/** Code-split wrapper so three.js (~150 kB gz) never blocks first paint. */
export default function LazyBall3D(props: Ball3DProps) {
  const size = props.size ?? 160;
  return (
    <Suspense
      fallback={
        <div style={{ width: size, height: size }} className={props.className} aria-hidden>
          <div className="m-[6%] h-[88%] w-[88%] rounded-full bg-[radial-gradient(circle_at_32%_28%,#fff_0%,#e9e9ef_38%,#9a9aa8_75%,#3a3a44_100%)]" />
        </div>
      }
    >
      <Ball3D {...props} />
    </Suspense>
  );
}
