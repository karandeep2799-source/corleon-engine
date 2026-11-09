import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Corleon Trade | Multi-market trading workspace',
    template: '%s | Corleon Trade',
  },
  description: 'A secure multi-market trading workspace for equities, crypto, forex and commodities.',
  applicationName: 'Corleon Trade',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
