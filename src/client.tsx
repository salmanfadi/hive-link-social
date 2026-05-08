import { hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { supabase } from "@/integrations/supabase/client";
// CSS imported as a JS module — Vite injects it via <style> tags at runtime.
import "./styles.css";

const publicPaths = new Set(["/login.html", "/signup.html", "/verify.html"]);

async function bootstrap() {
  if (!publicPaths.has(window.location.pathname)) {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      window.location.replace("/login.html");
      return;
    }
  }

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
}

bootstrap().catch(() => {
  if (!publicPaths.has(window.location.pathname)) {
    window.location.replace("/login.html");
  }
});

const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";

// Register service worker for PWA / offline mode. During local development,
// unregister it so stale cached auth bundles cannot keep old input bugs alive.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
      if ("caches" in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((key) => {
            window.caches.delete(key);
          });
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
