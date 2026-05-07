import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthRedirect,
  head: () => ({
    meta: [{ title: "Sign in - Decentra" }],
  }),
});

function AuthRedirect() {
  useEffect(() => {
    window.location.replace("/login.html");
  }, []);

  return null;
}
