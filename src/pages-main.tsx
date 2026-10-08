import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TrisApp } from "./components/game/TrisApp";
import "./styles.css";

const app = document.getElementById("app");
if (!app) throw new Error("Missing app container");
createRoot(app).render(
  <StrictMode>
    <TrisApp />
  </StrictMode>,
);
