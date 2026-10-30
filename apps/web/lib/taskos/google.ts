import { decryptSecret, encryptSecret } from './security';
import { db } from './db';

const API = 'https://tasks.googleapis.com/tasks/v1';
type GoogleTask = { id: string; title?: string; notes?: string; status?: string; due?: string; updated?: string; completed?: string; deleted?: boolean; };
async function accessToken(connectionId: string) {
  const c = await db.googleTasksConnection.findUnique({ where: { id: connectionId } });
  if (!c) throw new Error('Google Tasks connection not found');
  if (c.accessExpiresAt.getTime() > Date.now() + 60_000) return decryptSecret(c.encryptedAccess);
  const refresh = decryptSecret(c.encryptedRefresh);
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refresh, grant_type: 'refresh_token' });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  if (!res.ok) throw new Error('Google token refresh failed');
  const token = await res.json() as { access_token: string; expires_in: number };
  await db.googleTasksConnection.update({ where: { id: c.id }, data: { encryptedAccess: encryptSecret(token.access_token), accessExpiresAt: new Date(Date.now() + token.expires_in * 1000), lastError: null } });
  return token.access_token;
}
async function googleFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(API + path, { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!res.ok) throw new Error('Google Tasks API returned ' + res.status);
  return res.json() as Promise<T>;
}
export async function syncGoogleToCorleon(tenantId: string, userId: string) {
  const c = await db.googleTasksConnection.findUnique({ where: { userId } });
  if (!c || c.tenantId !== tenantId) throw new Error('Google Tasks is not connected');
  const token = await accessToken(c.id);
  const lists = await googleFetch<{ items?: Array<{ id: string; title: string }> }>(token, '/users/@me/lists?maxResults=100');
  let imported = 0;
  for (const list of lists.items ?? []) {
    const tasks = await googleFetch<{ items?: GoogleTask[] }>(token, '/lists/' + encodeURIComponent(list.id) + '/tasks?showCompleted=true&showHidden=true&maxResults=100');
    for (const t of tasks.items ?? []) {
      if (t.deleted || !t.id || !t.title) continue;
      await db.task.upsert({
        where: { tenantId_source_externalId: { tenantId, source: 'GOOGLE_TASKS', externalId: t.id } },
        create: { tenantId, ownerId: userId, title: t.title, notes: t.notes, source: 'GOOGLE_TASKS', externalId: t.id, externalListId: list.id, status: t.status === 'completed' ? 'DONE' : 'TODO', dueAt: t.due ? new Date(t.due) : null, completedAt: t.completed ? new Date(t.completed) : null, lastSyncedAt: new Date(), metadata: { googleListTitle: list.title, googleUpdated: t.updated ?? null } },
        update: { title: t.title, notes: t.notes, status: t.status === 'completed' ? 'DONE' : 'TODO', dueAt: t.due ? new Date(t.due) : null, completedAt: t.completed ? new Date(t.completed) : null, externalListId: list.id, lastSyncedAt: new Date(), metadata: { googleListTitle: list.title, googleUpdated: t.updated ?? null } }
      });
      imported++;
    }
  }
  await db.googleTasksConnection.update({ where: { id: c.id }, data: { lastSyncAt: new Date(), lastError: null } });
  return { imported, lists: lists.items?.length ?? 0 };
}
