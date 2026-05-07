import { hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
// CSS imported as a JS module — Vite injects it via <style> tags at runtime.
import "./styles.css";

const router = getRouter();

// TanStack Start SSR pre-renders the app into <div id="root"> via shellComponent.
// hydrateRoot ATTACHES React to the existing DOM (preserves elements + event listeners)
// instead of createRoot which REPLACES the DOM (causing typed text to vanish).
const rootElement = document.getElementById("root");

if (rootElement) {
  hydrateRoot(rootElement, <RouterProvider router={router} />);
} else {
  // Safety fallback if SSR didn't produce #root
  const el = document.createElement("div");
  el.id = "root";
  document.body.appendChild(el);
  import("react-dom/client").then(({ createRoot }) => {
    createRoot(el).render(<RouterProvider router={router} />);
  });
}

// Register service worker for PWA / offline mode
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
