import { describe, expect, it } from 'vitest';
import {
  getAnalyticsWindow,
  normalizeAnalyticsResponse,
  parseAnalyticsRange,
} from './analytics';

describe('Cloudflare analytics range handling', () => {
  it('defaults unsupported ranges to 24 hours', () => {
    expect(parseAnalyticsRange('1y')).toBe('24h');
    expect(parseAnalyticsRange(null)).toBe('24h');
  });

  it('accepts only the supported windows', () => {
    expect(parseAnalyticsRange('7d')).toBe('7d');
    expect(parseAnalyticsRange('30d')).toBe('30d');
  });

  it('creates an exact UTC time window', () => {
    const now = new Date('2026-11-16T12:00:00.000Z');
    const window = getAnalyticsWindow('24h', now);

    expect(window.start).toBe('2026-11-15T12:00:00.000Z');
    expect(window.end).toBe('2026-11-16T12:00:00.000Z');
  });
});

describe('Cloudflare analytics response normalization', () => {
  const window = getAnalyticsWindow('24h', new Date('2026-11-16T12:00:00.000Z'));

  it('returns aggregate metrics without exposing request-level identifiers', () => {
    const result = normalizeAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [{
              overview: [{
                count: 120,
                sum: { edgeResponseBytes: 4096, visits: 32 },
                avg: { sampleInterval: 1 },
              }],
              byStatus: [
                { count: 115, dimensions: { edgeResponseStatus: 200 } },
                { count: 5, dimensions: { edgeResponseStatus: 500 } },
              ],
              byCache: [
                { count: 80, dimensions: { cacheStatus: 'hit' } },
                { count: 40, dimensions: { cacheStatus: 'miss' } },
              ],
            }],
          },
        },
      },
      'zone-test',
      window,
      new Date('2026-11-16T12:01:00.000Z'),
    );

    expect(result.requests).toBe(120);
    expect(result.responseBytes).toBe(4096);
    expect(result.visits).toBe(32);
    expect(result.statusBreakdown).toEqual([
      { status: '200', requests: 115 },
      { status: '500', requests: 5 },
    ]);
    expect(result.cacheBreakdown).toEqual([
      { status: 'hit', requests: 80 },
      { status: 'miss', requests: 40 },
    ]);
    expect(JSON.stringify(result)).not.toContain('clientIP');
  });

  it('fails closed when Cloudflare returns a GraphQL error', () => {
    expect(() =>
      normalizeAnalyticsResponse(
        { errors: [{ message: 'internal provider detail', extensions: { code: 'budget' } }] },
        'zone-test',
        window,
      ),
    ).toThrow('Cloudflare Analytics returned a GraphQL error');
  });

  it('rejects an empty zone response', () => {
    expect(() =>
      normalizeAnalyticsResponse({ data: { viewer: { zones: [] } } }, 'zone-test', window),
    ).toThrow('Cloudflare returned no analytics data');
  });
});
