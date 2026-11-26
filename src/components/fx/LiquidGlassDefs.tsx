import { useEffect } from "react";

/**
 * Mounts the SVG filter used for true liquid-glass refraction
 * (`backdrop-filter: url(#lg-refract)`). Only Chromium can apply SVG filters
 * to the backdrop, so we flag support with `html.lg-svg` and every other
 * engine keeps the plain blur fallback defined in `.liquid-glass`.
 */
export default function LiquidGlassDefs() {
  useEffect(() => {
    const ua = navigator.userAgent;
    const isChromium = /Chrome\/\d+/.test(ua) && !/Edg\/|OPR\//.test(ua) ? true : /Edg\//.test(ua);
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (isChromium && !isIOS && !reduce) document.documentElement.classList.add("lg-svg");
  }, []);

  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <filter id="lg-refract" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          {/* low-frequency noise → smooth "liquid" lens warp */}
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="38" xChannelSelector="R" yChannelSelector="G" result="warped" />
          <feGaussianBlur in="warped" stdDeviation="1.2" />
        </filter>
      </defs>
    </svg>
  );
}
