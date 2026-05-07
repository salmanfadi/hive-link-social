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

  return (
    <noscript>
      <meta httpEquiv="refresh" content="0; url=/login.html" />
      <a href="/login.html">Continue to login</a>
    </noscript>
  );
}
