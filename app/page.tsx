export default function HomePage() {
  return <main style={{ maxWidth: 760, margin: "4rem auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif" }}>
    <h1>Corleon Engine</h1>
    <p>Google Pay integration foundation is installed.</p>
    <p>Checkout is intentionally disabled until an authenticated order/session integration and a processor-specific Google Pay adapter are configured.</p>
    <p><a href="/api/payments/google-pay/config">View public Google Pay configuration</a></p>
  </main>;
}
