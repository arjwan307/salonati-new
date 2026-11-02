/**
 * Salonati — WhatsApp password recovery (STAGED / NOT ACTIVE).
 *
 * IMPORTANT: This module is intentionally NOT imported by any worker, route,
 * frontend bundle or deployment entry point. It cannot send messages or change
 * passwords until the product owner authorizes activation and integration.
 *
 * Activation prerequisites:
 * 1. Written approval from Salonati's owner.
 * 2. A WhatsApp Business Platform number controlled/authorized by that owner.
 * 3. Meta authentication-template approval and production API credentials.
 * 4. D1 migration for recovery_challenges and rate-limit state.
 * 5. Backend integration with the existing account password hashing scheme,
 *    customer/owner/admin account tables and session invalidation.
 * 6. End-to-end tests, abuse controls, and explicit feature-flag rollout.
 */
export const PASSWORD_RECOVERY_ENABLED = false;

export const recoveryPolicy = Object.freeze({
  delivery: 'whatsapp_business_platform',
  codeDigits: 6,
  codeTtlSeconds: 300,
  maxVerifyAttempts: 5,
  resendCooldownSeconds: 60,
  maxRequestsPerPhonePerHour: 3,
  maxRequestsPerIpPerHour: 10,
  passwordMinLength: 10,
  passwordMaxLength: 128,
  invalidatePreviousSessions: true,
  genericAccountResponse: true,
  accountRoles: ['customer', 'salon_owner', 'cosmetics_owner', 'admin'],
});

export const proposedRoutes = Object.freeze({
  request: 'POST /api/auth/recovery/request',
  verify: 'POST /api/auth/recovery/verify',
  complete: 'POST /api/auth/recovery/complete',
});

/**
 * Integration contract (no live implementation yet):
 *
 * request {app, phone}
 *   - Normalize Iraqi phone to E.164 (+9647XXXXXXXXX).
 *   - Enforce IP + phone + account rate limits.
 *   - Return the SAME generic response for existing/nonexisting accounts.
 *   - Generate a cryptographically secure OTP; store only its keyed hash,
 *     challenge ID, expiry and attempt counters (never the plaintext code).
 *   - Send through the owner's approved WhatsApp authentication template.
 *
 * verify {challengeId, code}
 *   - Check expiry, attempts, hash in constant time, and single-use state.
 *   - Produce a short-lived, single-use reset authorization.
 *
 * complete {resetAuthorization, newPassword}
 *   - Validate password policy and hash using the account's existing PBKDF2
 *     settings (or an approved coordinated migration).
 *   - Update ONLY the verified account in the correct app namespace.
 *   - Atomically consume reset authorization and revoke old sessions.
 *   - Audit without logging codes, passwords or credentials.
 *
 * All endpoints MUST fail closed while PASSWORD_RECOVERY_ENABLED === false.
 * No client-side-only reset, unverified phone reset or manual WhatsApp link.
 */
export function recoveryNotEnabledResponse() {
  return new Response(JSON.stringify({ error: 'password_recovery_not_enabled' }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
