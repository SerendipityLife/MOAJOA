import { PollKeys } from '@moajoa/core';

/**
 * Anonymous voter device token (Phase 19 / POLL-02).
 *
 * A localStorage UUID scopes vote dedup (cast_date_vote upsert) and own-comment
 * delete (delete_poll_comment device_token match) without an account. It is a
 * dedup handle, NOT a security boundary (RESEARCH Pitfall 1) — a determined
 * abuser can rotate tokens; the non-guessable poll code + poll-open gate bound
 * the blast radius server-side.
 *
 * SSR guard: returns '' on the server so a cached/SSR render never mints or reads
 * a token (the island calls this client-side only, mirroring vote-island.tsx's
 * client-only hydration discipline).
 */
export function getDeviceToken(): string {
  if (typeof window === 'undefined') return ''; // SSR guard — never run server-side
  let t = window.localStorage.getItem(PollKeys.DeviceToken);
  if (!t) {
    t = crypto.randomUUID();
    window.localStorage.setItem(PollKeys.DeviceToken, t);
  }
  return t;
}

/** localStorage key for the anonymous voter's chosen nickname (paired with the device token). */
const NICKNAME_KEY = 'moajoa:poll_nickname';

/** Read the persisted nickname (SSR-safe — '' on the server / first visit). */
export function getStoredNickname(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(NICKNAME_KEY) ?? '';
}

/** Persist the nickname so a returning visitor skips the gate (SSR no-op on the server). */
export function setStoredNickname(nickname: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NICKNAME_KEY, nickname);
}
