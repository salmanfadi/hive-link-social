import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/signup")({
  component: SignupRedirect,
  head: () => ({
    meta: [{ title: "Sign up - Decentra" }],
  }),
});

function SignupRedirect() {
  useEffect(() => {
    window.location.replace("/signup.html");
  }, []);

  return null;
}
