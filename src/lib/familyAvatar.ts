/**
 * Generate a stable HSL color and initials from a user identifier.
 * Used across the Family module for consistent member representation.
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Returns an HSL color string stable for a given seed (e.g., user_id). */
export function avatarColor(seed: string): string {
  if (!seed) return 'hsl(220, 60%, 55%)';
  const hue = hashString(seed) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/** Returns 1-2 initials from a display name. */
export function avatarInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
