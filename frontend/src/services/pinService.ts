// PIN authorization management service
// Handles sessionStorage for PIN verification state with 30-minute timeout

const PIN_AUTHORIZED_KEY = 'milp.pin.isAuthorized';
const PIN_EXPIRES_AT_KEY = 'milp.pin.expiresAt';
const PIN_VALUE_KEY = 'milp.pin.value';
const PIN_TIMEOUT_MINUTES = 30;

/**
 * Check if user is currently authorized (PIN verified within timeout window)
 */
export function isPINAuthorized(): boolean {
  const isAuthorized = sessionStorage.getItem(PIN_AUTHORIZED_KEY);
  const expiresAt = sessionStorage.getItem(PIN_EXPIRES_AT_KEY);

  if (!isAuthorized || !expiresAt) {
    return false;
  }

  const now = Date.now();
  const expiration = parseInt(expiresAt, 10);

  if (now > expiration) {
    // Authorization has expired
    clearPINAuthorized(false);
    return false;
  }

  return true;
}

/**
 * Set PIN authorization flag with 30-minute expiration
 */
export function setPINAuthorized(pin: string): void {
  const expiresAt = Date.now() + PIN_TIMEOUT_MINUTES * 60 * 1000;
  sessionStorage.setItem(PIN_AUTHORIZED_KEY, 'true');
  sessionStorage.setItem(PIN_EXPIRES_AT_KEY, expiresAt.toString());
  sessionStorage.setItem(PIN_VALUE_KEY, pin);
}

/**
 * Return the authorized PIN value if session is still valid.
 */
export function getAuthorizedPIN(): string | null {
  if (!isPINAuthorized()) {
    return null;
  }
  return sessionStorage.getItem(PIN_VALUE_KEY);
}

/**
 * Clear PIN authorization and optionally show warning
 */
export function clearPINAuthorized(showWarning: boolean = false): void {
  sessionStorage.removeItem(PIN_AUTHORIZED_KEY);
  sessionStorage.removeItem(PIN_EXPIRES_AT_KEY);
  sessionStorage.removeItem(PIN_VALUE_KEY);

  if (showWarning) {
    // Return a message that can be shown to the user
    console.warn('PIN authorization expired. Please verify again.');
  }
}

/**
 * Get remaining time in seconds until authorization expires
 */
export function getPINTimeRemaining(): number {
  const expiresAt = sessionStorage.getItem(PIN_EXPIRES_AT_KEY);

  if (!expiresAt) {
    return 0;
  }

  const remaining = Math.max(0, parseInt(expiresAt, 10) - Date.now());
  return Math.ceil(remaining / 1000);
}

/**
 * Set up an interval to check for expiration and trigger callback
 * Returns cleanup function
 */
export function setupPINTimeoutCheck(
  onExpired?: () => void
): () => void {
  const checkInterval = setInterval(() => {
    if (!isPINAuthorized()) {
      clearInterval(checkInterval);
      if (onExpired) {
        onExpired();
      }
    }
  }, 60000); // Check every minute

  return () => clearInterval(checkInterval);
}
