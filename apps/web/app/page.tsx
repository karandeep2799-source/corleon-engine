export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32 }}>
      <section style={{ maxWidth: 760 }}>
        <p style={{ opacity: 0.65 }}>CORLEON ENGINE</p>
        <h1 style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', margin: '12px 0' }}>AI orchestration, built for production.</h1>
        <p style={{ fontSize: 20, lineHeight: 1.6, opacity: 0.75 }}>A secure foundation for model routing, integrations, compliance, observability, and agent workloads.</p>
      </section>
    </main>
  );
}
