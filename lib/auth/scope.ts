import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which account the current work belongs to.
 *
 * Web requests resolve the account from the session cookie, but crons, the
 * Health ingest endpoint, and the Siri routes have no cookie — they authenticate
 * with a device token and then run the ordinary data functions inside
 * `runAsUser`. Because the store carries the id, none of those functions need an
 * extra argument, and none of them can accidentally read another runner's rows.
 */

type Global = typeof globalThis & {
  __bhUserScope?: AsyncLocalStorage<string>;
};

const g = globalThis as Global;

function store(): AsyncLocalStorage<string> {
  if (!g.__bhUserScope) g.__bhUserScope = new AsyncLocalStorage<string>();
  return g.__bhUserScope;
}

export function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return store().run(userId, fn);
}

export function scopedUserId(): string | null {
  return store().getStore() ?? null;
}
