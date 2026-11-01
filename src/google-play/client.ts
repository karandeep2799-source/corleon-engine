import { getGoogleAccessToken } from './auth.js';
const PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const REPORTING = 'https://playdeveloperreporting.googleapis.com/v1beta1';
async function googleRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(url, { ...init, headers: { authorization: 'Bearer ' + accessToken, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers }, cache: 'no-store' });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const safe = body.slice(0, 500).replace(/(purchaseToken|access_token|private_key)[^,}]*/gi, '$1=[redacted]');
    throw new Error('Google Play API request failed (' + response.status + '): ' + safe);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
const segment = (value: string) => encodeURIComponent(value);
export const googlePlay = {
  productPurchase: (pkg: string, product: string, token: string) => googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/purchases/products/' + segment(product) + '/tokens/' + segment(token)),
  subscription: (pkg: string, token: string) => googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/purchases/subscriptionsv2/tokens/' + segment(token)),
  voidedPurchases: (pkg: string, pageToken?: string, maxResults = 100) => {
    const query = new URLSearchParams({ maxResults: String(Math.min(Math.max(maxResults, 1), 1000)) });
    if (pageToken) query.set('token', pageToken);
    return googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/purchases/voidedpurchases?' + query);
  },
  reviews: (pkg: string, pageToken?: string, maxResults = 100) => {
    const query = new URLSearchParams({ maxResults: String(Math.min(Math.max(maxResults, 1), 100)) });
    if (pageToken) query.set('token', pageToken);
    return googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/reviews?' + query);
  },
  replyToReview: (pkg: string, id: string, text: string) => googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/reviews/' + segment(id) + ':reply', { method: 'POST', body: JSON.stringify({ replyText: text }) }),
  users: (developerId: string, pageToken?: string) => {
    const query = new URLSearchParams({ pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    return googleRequest<Record<string, unknown>>(PUBLISHER + '/developers/' + segment(developerId) + '/users?' + query);
  },
  createEdit: (pkg: string) => googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/edits', { method: 'POST', body: '{}' }),
  commitEdit: (pkg: string, id: string) => googleRequest<Record<string, unknown>>(PUBLISHER + '/applications/' + segment(pkg) + '/edits/' + segment(id) + ':commit', { method: 'POST', body: '{}' }),
  queryVitals: (pkg: string, metric: 'crashRateMetricSet' | 'anrRateMetricSet', body: Record<string, unknown>) => googleRequest<Record<string, unknown>>(REPORTING + '/apps/' + segment(pkg) + '/' + metric + ':query', { method: 'POST', body: JSON.stringify(body) }),
};