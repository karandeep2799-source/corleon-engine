'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, callback: (response: unknown) => void) => void };
  }
}

type Props = {
  amount: number; // integer paise, never rupees
  description: string;
  customer?: { name?: string; email?: string; contact?: string };
  onSuccess?: (paymentId: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

let razorpayScriptPromise: Promise<void> | undefined;
function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Checkout is only available in a browser.'));
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { razorpayScriptPromise = undefined; reject(new Error('Unable to load secure checkout.')); };
      document.head.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

function idempotencyKey() {
  return `web:${crypto.randomUUID()}`;
}

export function PaymentPlayer({ amount, description, customer, onSuccess, onError, disabled, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => { loadRazorpay().then(() => setReady(true)).catch(() => setReady(false)); }, []);

  async function pay() {
    if (busy || disabled) return;
    setBusy(true); setMessage('');
    try {
      await loadRazorpay();
      const orderResponse = await fetch('/api/payments/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ amount, description, idempotencyKey: idempotencyKey() }),
      });
      const order = await orderResponse.json() as { error?: string; paymentId?: string; orderId?: string; keyId?: string; amount?: number; currency?: string };
      if (!orderResponse.ok || !order.orderId || !order.paymentId || !order.keyId) throw new Error(order.error || 'Unable to start checkout.');

      const checkout = new window.Razorpay!({
        key: order.keyId, amount: order.amount, currency: order.currency,
        name: 'Corleon Engine', description, order_id: order.orderId,
        prefill: customer,
        theme: { color: '#635bff' },
        handler: async (response: unknown) => {
          try {
            const verified = await fetch('/api/payments/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
              body: JSON.stringify({ paymentId: order.paymentId, ...(response as Record<string, string>) }),
            });
            const result = await verified.json() as { error?: string; status?: string; paymentId?: string };
            if (!verified.ok) throw new Error(result.error || 'Payment verification failed.');
            if (result.status === 'CAPTURED') { setMessage('Payment successful.'); onSuccess?.(result.paymentId || order.paymentId!); }
            else {\n              setMessage('Payment received by gateway; final confirmation is pending.');\n              for (let attempt = 0; attempt < 5; attempt += 1) {\n                await new Promise((resolve) => setTimeout(resolve, 1500));\n                const statusResponse = await fetch(\`/api/payments/\${encodeURIComponent(order.paymentId!)}\`, { credentials: 'same-origin', cache: 'no-store' });\n                if (!statusResponse.ok) break;\n                const latest = await statusResponse.json() as { status?: string };\n                if (latest.status === 'CAPTURED') { setMessage('Payment successful.'); onSuccess?.(order.paymentId!); break; }\n                if (latest.status === 'FAILED') { setMessage('Payment failed.'); break; }\n              }\n            }
          } catch (error) {
            const text = error instanceof Error ? error.message : 'Payment verification failed.';
            setMessage(text); onError?.(text);
          } finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setMessage('Checkout closed. Payment status will be confirmed by the server if a payment was completed.'); } },
      });
      checkout.on('payment.failed', (event: unknown) => {
        const description = (event as { error?: { description?: string } }).error?.description || 'Payment failed.';
        setMessage(description); onError?.(description); setBusy(false);
      });
      checkout.open();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to start payment.';
      setMessage(text); onError?.(text); setBusy(false);
    }
  }

  const rupees = (amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  return (
    <div className={className} aria-live="polite">
      <button type="button" onClick={pay} disabled={disabled || busy || !ready}
        className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Processing…' : `Pay ${rupees}`}
      </button>
      {message ? <p role="status" className="mt-2 text-sm">{message}</p> : null}
      {!ready ? <p className="mt-2 text-xs text-gray-500">Loading secure checkout…</p> : null}
    </div>
  );
}
