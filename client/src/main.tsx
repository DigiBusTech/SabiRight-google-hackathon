import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "./registerSW";

// Register Service Worker for PWA
registerSW();

createRoot(document.getElementById("root")!).render(<App />);
