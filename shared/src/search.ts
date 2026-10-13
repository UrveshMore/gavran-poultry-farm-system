/** A LIKE pattern that treats `%`, `_`, and the escape mark as ordinary characters. */
export function likePattern(query: string): string | null {
  const trimmed = query.trim();
  if ([...trimmed].length < 2 || [...trimmed].length > 80) return null;
  const escaped = trimmed.replace(/[!%_]/g, (mark) => `!${mark}`);
  return `%${escaped}%`;
}
