import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** New pages start at the top; back/forward keeps the browser's restoration. */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  useLayoutEffect(() => {
    if (navType !== "POP") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, navType]);
  return null;
}
