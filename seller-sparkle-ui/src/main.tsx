import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import "leaflet/dist/leaflet.css";

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
