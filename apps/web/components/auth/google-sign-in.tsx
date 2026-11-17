"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            nonce: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: {
            theme: "outline";
            size: "large";
            shape: "rectangular";
            text: "signin_with";
            width: number;
          }) => void;
        };
      };
    };
  }
}

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleSignIn() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [message, setMessage] = useState("Preparing secure sign-in…");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not prepare secure sign-in.");
        return await response.json() as { csrfToken: string };
      })
      .then((data) => { if (active) { setCsrfToken(data.csrfToken); setMessage(""); } })
      .catch(() => { if (active) setMessage("Secure sign-in could not be initialized. Refresh the page."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!scriptReady || !csrfToken || !buttonRef.current) return;
    if (!clientId || !window.google?.accounts.id) {
      setMessage("Google sign-in is not configured for this deployment.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: csrfToken,
      callback: async ({ credential }) => {
        if (!credential || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setMessage("Verifying your Google identity…");
        try {
          const response = await fetch("/api/auth/google/session", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
            body: JSON.stringify({ credential }),
          });
          const result = await response.json() as { error?: string; redirectTo?: string };
          if (!response.ok) throw new Error(result.error ?? "Sign-in failed.");
          window.location.assign(result.redirectTo ?? "/");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
          busyRef.current = false;
          setBusy(false);
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline", size: "large", shape: "rectangular", text: "signin_with", width: 280,
    });
  }, [scriptReady, csrfToken]);

  return (
    <section style={{ width: "100%" }}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => setMessage("Google sign-in could not be loaded.")} />
      <div ref={buttonRef} style={{ display: "flex", minHeight: 44, justifyContent: "center" }} />
      {message ? <p role="status" aria-live="polite" style={{ marginTop: 12, textAlign: "center", fontSize: 14, color: "#475569" }}>{message}</p> : null}
      {busy ? <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "#64748b" }}>Please keep this window open.</p> : null}
    </section>
  );
}
