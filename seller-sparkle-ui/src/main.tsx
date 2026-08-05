import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "./app/utils/errorMessages";

// Globally intercept toast.error to ensure no raw backend error codes leak to the UI
const originalToastError = toast.error;
toast.error = (message: string | React.ReactNode, data?: any) => {
  if (typeof message === "string") {
    return originalToastError(getUserFriendlyMessage(message), data);
  }
  return originalToastError(message, data);
};

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

// Push notifications only in production — avoids stale cached bundles during local dev (localhost).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("SW registration failed:", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Hide HTML boot splash once React has painted (keeps BlinksMed branding during JS load).
requestAnimationFrame(() => {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  splash.classList.add("boot-splash--hide");
  window.setTimeout(() => splash.remove(), 220);
});
