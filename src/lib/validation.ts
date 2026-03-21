/**
 * Sanitize a string input: trims whitespace, strips null bytes, and limits length.
 * Returns empty string for non-string inputs.
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/\0/g, "") // strip null bytes
    .slice(0, maxLength);
}

/**
 * Basic email format validation.
 * Checks for a reasonable email pattern — not fully RFC 5322 compliant,
 * but sufficient for practical use.
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email) && email.length <= 254;
}

/**
 * Validate password strength.
 * Requirements: min 8 characters, at least 1 uppercase letter, at least 1 number.
 */
export function validatePassword(password: string): { valid: boolean; message: string } {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a string." };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least 1 uppercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least 1 number." };
  }
  return { valid: true, message: "Password meets requirements." };
}

/**
 * Validate that a value is one of the allowed enum values.
 * Returns the value if valid, null otherwise.
 */
export function validateEnum<T extends string>(value: unknown, allowed: T[]): T | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * Validate and parse a positive integer.
 * Returns the parsed integer if positive, null otherwise.
 */
export function validatePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : parseInt(String(value), 10);

  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;
  if (num <= 0) return null;

  return num;
}

/**
 * Validate an ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z").
 * Returns the string if valid, null otherwise.
 */
export function validateDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Must match ISO date or datetime format
  const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!datePattern.test(value)) return null;

  // Also verify it parses to a valid date
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;

  return value;
}
