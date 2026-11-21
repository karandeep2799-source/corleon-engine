import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Corleon Research | Clarity Before Conviction',
  description: 'Independent market research, trading education and risk-first frameworks from Corleon Research.',
  robots: { index: false, follow: false },
};
export default function ResearchLayout({ children }: { children: React.ReactNode }) { return children; }
