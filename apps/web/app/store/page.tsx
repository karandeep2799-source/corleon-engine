import type { Metadata } from 'next';
import StoreClient from './store-client';

export const metadata: Metadata = {
  title: 'Corleon Store | Digital tools for modern operators',
  description: 'Explore practical digital resources for smarter workflows and better business operations.',
  alternates: { canonical: '/store' },
};

export default function StorePage() {
  return <StoreClient />;
}
