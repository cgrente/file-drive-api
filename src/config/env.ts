/**
 * Require an environment variable to be defined and non-empty.
 * Fails fast during application startup.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

/**
 * Optional environment variable with default.
 */
export function getEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : defaultValue;
}

/**
 * Require a numeric environment variable.
 */
export function requireNumberEnv(name: string): number {
  const value = requireEnv(name);
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}