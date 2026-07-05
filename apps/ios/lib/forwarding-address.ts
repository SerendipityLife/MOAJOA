// apps/ios/lib/forwarding-address.ts
// Phase 21 (LEDGER-01) — thin wrappers around the mail-forwarding address. The
// opaque token comes from getOrCreateForwardingAddress (@moajoa/api, 21-03); the
// domain is env-wired via app.config.ts extra.forwardingDomain (never hardcoded —
// CLAUDE.md §4.7). Domain is undefined until 21-04 Task 5 sets EXPO_PUBLIC_
// FORWARDING_DOMAIN, so buildForwardingAddress returns null then and the card
// renders a graceful placeholder instead of a broken `<token>@undefined`.
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';

/** `<token>@<domain>` — null when the domain isn't wired yet (unset env). */
export function buildForwardingAddress(token: string): string | null {
  const domain = Constants.expoConfig?.extra?.forwardingDomain as string | undefined;
  if (!domain) return null;
  return `${token}@${domain}`;
}

/** Copy the address to the clipboard; throws on failure so the caller can toast. */
export async function copyForwardingAddress(addr: string): Promise<void> {
  await Clipboard.setStringAsync(addr);
}
