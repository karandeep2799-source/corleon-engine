import type { Metadata } from "next";
import Link from "next/link";
import "../stocks.css";

export const metadata: Metadata = {
  title: "Google Data Use & Privacy | Corleon Stock Intelligence",
  description: "How Corleon Stock Intelligence accesses, processes, stores and deletes Google Gmail data.",
  robots: { index: true, follow: true },
};

export default function StocksPrivacyPage() {
  return (
    <main className="stocks-shell stocks-privacy-page">
      <nav className="stocks-nav">
        <Link className="stocks-brand" href="/stocks"><span className="stocks-mark">C</span> CORLEON <span>/ STOCK INTELLIGENCE</span></Link>
        <Link href="/stocks">Back to Stock Intelligence</Link>
      </nav>
      <article className="stocks-section">
        <p className="stocks-eyebrow">GOOGLE USER DATA · LIMITED USE DISCLOSURE</p>
        <h1>Google data use<br /><span>and privacy.</span></h1>
        <p className="stocks-lede">This notice describes the data flow implemented in the Stock Intelligence module. The service operator must complete the identity and contact details below and obtain appropriate legal review before public release.</p>
        <div className="stocks-privacy-placeholder">
          <b>Publication blocker</b>
          <p>Operator legal name, registered address, privacy contact email, retention schedule and final privacy policy have not yet been supplied. This engineering disclosure is not a substitute for a complete legal privacy policy.</p>
        </div>
        <h2>What Google data is requested?</h2>
        <p>When you choose Connect Gmail, Corleon requests Google sign-in identity scopes and the Gmail read-only scope, https://www.googleapis.com/auth/gmail.readonly. This scope can read message bodies, headers, metadata and attachments. Corleon does not request Gmail send, modify, delete or mailbox-settings permissions.</p>
        <h2>Why is it used?</h2>
        <p>Corleon searches for stock and investment records such as contract notes, trade confirmations, trade books, dividends, portfolio statements and depository/CAS references. It reads message text and supported CSV, TSV and plain-text attachments to identify candidate trade rows for the portfolio dashboard.</p>
        <h2>What is stored?</h2>
        <p>The full message body is processed in memory and is not saved as a complete email. The database stores the connected Google email address, display metadata, an encrypted refresh token, granted scope names, Gmail message and thread identifiers, message subject, sender, received date, attachment filename and MIME type, extracted trade fields and a short evidence excerpt. Refresh tokens are encrypted with AES-256-GCM. Application sessions use signed, HTTP-only cookies.</p>
        <h2>What is not done?</h2>
        <p>Corleon does not modify, send, archive or delete Gmail messages. This module does not place trades, move money, access broker credentials, sell Google data, serve advertising based on Google data, or send Gmail content to AI/model providers. No trading or investment recommendation is produced.</p>
        <h2>Review and deletion controls</h2>
        <p>New trade candidates are not included in confirmed positions until you approve them. From the Stock Intelligence workspace, choose Disconnect &amp; delete data to attempt to revoke the Google authorization and delete the connected mailbox's local connection, sync state, email evidence and imported transactions. If Google token revocation cannot be confirmed, the local records are still deleted; remove Corleon Engine from your Google Account's third-party access settings as well.</p>
        <h2>Retention and sharing</h2>
        <p>Imported data is retained in the private workspace until you disconnect and delete it. The operator must finalize the service retention schedule, backup deletion window, subprocessors and lawful contact details before the application is opened to other users. Google user data is used only for the feature displayed in this application and must not be used for advertising, resale, unrelated analytics, or general AI model training.</p>
        <h2>Google OAuth verification</h2>
        <p>The Gmail read-only scope is restricted. Public launch requires completion of Google's applicable OAuth verification and restricted-scope security assessment requirements. Users should not connect a production mailbox until those requirements have been satisfied.</p>
        <h2>Operator contact</h2>
        <p>Legal operator: [TO BE COMPLETED]</p>
        <p>Registered/business address: [TO BE COMPLETED]</p>
        <p>Privacy and data deletion contact: [TO BE COMPLETED]</p>
        <p>Last updated: 10 November 2026</p>
        <p><a href="https://developers.google.com/workspace/workspace-api-user-data-developer-policy" target="_blank" rel="noreferrer">Google Workspace user data and developer policy ↗</a></p>
      </article>
    </main>
  );
}
