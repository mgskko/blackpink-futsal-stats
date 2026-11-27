import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);

// Installed PWAs stay alive in the background for days: re-check for a new version whenever the app
// comes back to the foreground (the new worker then reloads the page itself, see public/sw-update.js).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
