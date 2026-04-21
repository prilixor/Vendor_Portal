import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import "leaflet/dist/leaflet.css";

createRoot(document.getElementById("root")!).render(<App />);
