import "@fontsource-variable/dm-sans";
import "@fontsource/syne/600.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("No se encontró #root");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
