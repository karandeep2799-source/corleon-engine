import type { Metadata } from "next";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export const metadata: Metadata = {
  title: "Sign in | Corleon Engine",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Corleon Engine</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in securely</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Continue with your verified Google identity. Access to customer orders is separately granted by your organization.
        </p>
        <div className="mt-8"><GoogleSignIn /></div>
        <p className="mt-7 text-xs leading-5 text-slate-500">
          Signing in does not automatically grant payment access. An organization must link your account to the relevant customer record.
        </p>
      </section>
    </main>
  );
}
