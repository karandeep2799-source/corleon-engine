import type { Metadata } from "next";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export const metadata: Metadata = {
  title: "Sign in | Corleon Engine",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: "48px 20px", color: "#0f172a" }}>
      <section style={{ width: "100%", maxWidth: 440, border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", padding: 32, boxShadow: "0 12px 40px rgba(15,23,42,.06)" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".2em", color: "#64748b", textTransform: "uppercase" }}>Corleon Engine</p>
        <h1 style={{ margin: "14px 0 8px", fontSize: 28, lineHeight: 1.15, letterSpacing: "-.03em" }}>Sign in securely</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#64748b" }}>
          Continue with your verified Google identity. Access to customer orders is separately granted by your organization.
        </p>
        <div style={{ marginTop: 32 }}><GoogleSignIn /></div>
        <p style={{ margin: "28px 0 0", fontSize: 12, lineHeight: 1.6, color: "#64748b" }}>
          Signing in does not automatically grant payment access. An organization must link your account to the relevant customer record.
        </p>
      </section>
    </main>
  );
}
