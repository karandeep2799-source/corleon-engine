"use client";

import Script from "next/script";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: { name?: string; email?: string };
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => Promise<void>;
      modal?: { ondismiss?: () => void };
      theme?: { color?: string };
    }) => { open: () => void; on: (event: string, callback: (error: { description?: string }) => void) => void };
  }
}

export function RazorpayCheckoutButton({ orderReference }: { orderReference: string }) {
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function checkout() {
    if (!scriptReady || !window.Razorpay || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const orderResponse = await fetch("/api/payments/razorpay/orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ orderReference }),
      });
      const checkoutOrder = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(checkoutOrder.error ?? "Unable to initialize checkout.");
      const razorpay = new window.Razorpay({
        key: checkoutOrder.keyId,
        amount: checkoutOrder.amount,
        currency: checkoutOrder.currency,
        name: checkoutOrder.name ?? "Corleon Engine",
        description: checkoutOrder.description ?? "Order payment",
        order_id: checkoutOrder.orderId,
        prefill: checkoutOrder.prefill,
        handler: async (response) => {
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verifyResponse.json();
          if (!verifyResponse.ok) throw new Error(result.error ?? "Payment verification failed.");
          setMessage(result.status === "processing" ? "Payment is processing. We'll confirm it when Razorpay reports capture." : "Payment verified successfully.");
        },
        modal: { ondismiss: () => setMessage("Checkout was closed. If you completed a payment, status will be confirmed server-side.") },
        theme: { color: "#111827" },
      });
      razorpay.on("payment.failed", (error) => setMessage(error.description ?? "Payment failed. You can retry checkout."));
      razorpay.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => setMessage("Razorpay Checkout could not be loaded.")} />
      <button type="button" onClick={checkout} disabled={!scriptReady || loading} aria-busy={loading}>
        {loading ? "Preparing checkout…" : scriptReady ? "Pay securely with Razorpay" : "Loading secure checkout…"}
      </button>
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </div>
  );
}
