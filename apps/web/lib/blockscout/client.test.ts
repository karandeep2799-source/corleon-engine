import { describe, expect, it } from 'vitest';
import { normalizeChains, validateAddress } from './client';

describe('Blockscout client validation', () => {
  it('accepts a valid EVM address', () => {
    expect(validateAddress('0xd6eCCeBC1a33f10b432cd5896554182411D840dF')).toBe('0xd6eCCeBC1a33f10b432cd5896554182411D840dF');
  });

  it('rejects malformed addresses', () => {
    expect(() => validateAddress('0x1234')).toThrow(/valid 0x-prefixed EVM address/);
  });

  it('normalizes chain registry formats and deduplicates ids', () => {
    const chains = normalizeChains({ chains: [
      { chain_id: 1, name: 'Ethereum', api_url: 'https://eth.example/' },
      { chainId: '8453', title: 'Base', apiUrl: 'https://base.example' },
      { chain_id: 1, name: 'Ethereum duplicate' },
      { name: 'Invalid' },
    ] });
    expect(chains).toHaveLength(2);
    expect(chains.find(chain => chain.id === '1')?.apiUrl).toBe('https://eth.example');
    expect(chains.find(chain => chain.id === '8453')?.name).toBe('Base');
  });
});
