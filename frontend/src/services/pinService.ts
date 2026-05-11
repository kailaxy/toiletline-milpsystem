// PIN management (no persistent authorization)
// Every action must provide a PIN; we temporarily store the entered PIN
// so the immediate pending action can include it in headers, then it's
// consumed and cleared by the API header builder.

const PIN_VALUE_KEY = 'milp.pin.value';

/**
 * Always return false so callers always require PIN entry.
 */
export function isPINAuthorized(): boolean {
  return false;
}

/**
 * Store a single-use PIN. This will be consumed by the API header builder
 * on the next request and then cleared.
 */
export function setPINAuthorized(pin: string): void {
  try {
    sessionStorage.setItem(PIN_VALUE_KEY, pin);
  } catch {
    // ignore storage failures
  }
}

/**
 * Return the stored PIN value (single-use) or null if absent.
 */
export function getAuthorizedPIN(): string | null {
  try {
    return sessionStorage.getItem(PIN_VALUE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear any stored PIN value.
 */
export function clearPINAuthorized(): void {
  try {
    sessionStorage.removeItem(PIN_VALUE_KEY);
  } catch {
    // ignore
  }
}
