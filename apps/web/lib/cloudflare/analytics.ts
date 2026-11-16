export type AnalyticsRange = '24h' | '7d' | '30d';

export type AnalyticsWindow = {
  range: AnalyticsRange;
  start: string;
  end: string;
};

export type ZoneAnalytics = {
  zone: string;
  range: AnalyticsRange;
  generatedAt: string;
  window: { start: string; end: string };
  requests: number;
  responseBytes: number;
  visits: number;
  averageSampleInterval: number | null;
  statusBreakdown: Array<{ status: string; requests: number }>;
  cacheBreakdown: Array<{ status: string; requests: number }>;
};

type GraphQLResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        overview?: Array<{
          count?: number | null;
          sum?: { edgeResponseBytes?: number | null; visits?: number | null } | null;
          avg?: { sampleInterval?: number | null } | null;
        }>;
        byStatus?: Array<{
          count?: number | null;
          dimensions?: { edgeResponseStatus?: number | string | null } | null;
        }>;
        byCache?: Array<{
          count?: number | null;
          dimensions?: { cacheStatus?: string | null } | null;
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

const GRAPHQL_QUERY = `
  query CorleonZoneAnalytics($zoneTag: string, $start: Time, $end: Time) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        overview: httpRequestsAdaptiveGroups(
          limit: 1
          filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }
        ) {
          count
          sum { edgeResponseBytes visits }
          avg { sampleInterval }
        }
        byStatus: httpRequestsAdaptiveGroups(
          limit: 100
          orderBy: [count_DESC]
          filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }
        ) {
          count
          dimensions { edgeResponseStatus }
        }
        byCache: httpRequestsAdaptiveGroups(
          limit: 100
          orderBy: [count_DESC]
          filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }
        ) {
          count
          dimensions { cacheStatus }
        }
      }
    }
  }
`;

const RANGE_MS: Record<AnalyticsRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function parseAnalyticsRange(value: string | null): AnalyticsRange {
  if (value === '7d' || value === '30d' || value === '24h') return value;
  return '24h';
}

export function getAnalyticsWindow(
  range: AnalyticsRange,
  now: Date = new Date(),
): AnalyticsWindow {
  const end = new Date(now);
  const start = new Date(end.getTime() - RANGE_MS[range]);
  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function breakdown<T extends { count?: number | null; dimensions?: Record<string, unknown> | null }>(
  rows: T[] | undefined,
  dimension: string,
): Array<{ status: string; requests: number }> {
  return (rows ?? []).map((row) => {
    const raw = row.dimensions?.[dimension];
    const status = raw === null || raw === undefined || raw === '' ? 'unknown' : String(raw);
    return { status, requests: finiteNumber(row.count) };
  });
}

export function normalizeAnalyticsResponse(
  payload: GraphQLResponse,
  zone: string,
  window: AnalyticsWindow,
  generatedAt: Date = new Date(),
): ZoneAnalytics {
  if (payload.errors?.length) {
    const error = new Error('Cloudflare Analytics returned a GraphQL error');
    (error as Error & { code?: string }).code = payload.errors[0]?.extensions?.code;
    throw error;
  }

  const zoneData = payload.data?.viewer?.zones?.[0];
  if (!zoneData) throw new Error('Cloudflare returned no analytics data for the configured zone');

  const overview = zoneData.overview?.[0];
  return {
    zone,
    range: window.range,
    generatedAt: generatedAt.toISOString(),
    window: { start: window.start, end: window.end },
    requests: finiteNumber(overview?.count),
    responseBytes: finiteNumber(overview?.sum?.edgeResponseBytes),
    visits: finiteNumber(overview?.sum?.visits),
    averageSampleInterval:
      typeof overview?.avg?.sampleInterval === 'number' &&
      Number.isFinite(overview.avg.sampleInterval)
        ? overview.avg.sampleInterval
        : null,
    statusBreakdown: breakdown(zoneData.byStatus, 'edgeResponseStatus'),
    cacheBreakdown: breakdown(zoneData.byCache, 'cacheStatus'),
  };
}

export async function fetchZoneAnalytics(
  range: AnalyticsRange,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ZoneAnalytics> {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zone = env.CLOUDFLARE_ZONE_ID;

  if (!token || !zone) {
    throw new Error('Cloudflare analytics is not configured');
  }

  const window = getAnalyticsWindow(range);
  const response = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { zoneTag: zone, start: window.start, end: window.end },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Analytics request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse;
  return normalizeAnalyticsResponse(payload, zone, window);
}
