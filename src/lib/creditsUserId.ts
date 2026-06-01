/**
 * ERP designer identity for user-credits (userId === normalized email).
 */
export function normalizeCreditsUserId(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) {
    throw new Error("userId is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("userId must be a valid email address");
  }
  return value;
}
