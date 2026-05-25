/**
 * Centralized env access for the web app.
 * NEXT_PUBLIC_* vars are inlined at build time — these checks happen at
 * compile time for static optimization, not runtime.
 *
 * Strict === '1' check: '0', 'true', 'false', undefined all evaluate to false.
 * Fail-safe default = gate-closed.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1';
}
