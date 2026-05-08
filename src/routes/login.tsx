import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
  head: () => ({
    meta: [{ title: "Login - Decentra" }],
  }),
});

function LoginRedirect() {
  useEffect(() => {
    window.location.replace("/login.html");
  }, []);

  return null;
}
