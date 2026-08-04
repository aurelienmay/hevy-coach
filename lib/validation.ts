// Shape guard for the one API request field with real internal structure
// (volume_targets); everything else at the API boundaries is simple enough
// to check inline with typeof.
type VolumeTargetEntry = { min: number; max: number };

function isVolumeTargetEntry(value: unknown): value is VolumeTargetEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.min === "number" &&
    typeof entry.max === "number" &&
    entry.min >= 0 &&
    entry.max >= entry.min
  );
}

export function isVolumeTargets(value: unknown): value is Record<string, VolumeTargetEntry> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(isVolumeTargetEntry);
}
