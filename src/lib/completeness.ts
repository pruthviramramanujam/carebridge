export interface CompletenessResult {
  score: number;
  missing: string[];
  strengths: string[];
}

export function assessCompleteness(
  fields: Record<string, string | number | boolean | null | undefined>,
): CompletenessResult {
  const entries = Object.entries(fields);
  const total = entries.length;
  const presentEntries = entries.filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

  const missing = entries
    .filter(([, value]) => {
      if (value === null || value === undefined) return true;
      if (typeof value === "string") return value.trim().length === 0;
      return false;
    })
    .map(([key]) => key);

  const strengthLabels = presentEntries.slice(0, 3).map(([key]) => key);
  const score = total === 0 ? 0 : Math.round((presentEntries.length / total) * 100);

  return {
    score,
    missing,
    strengths: strengthLabels,
  };
}
