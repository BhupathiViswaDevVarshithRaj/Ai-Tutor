/** Only allow in-app redirect targets (prevents open redirects via ?next=). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/app') && !next.startsWith('//') ? next : '/app'
}
