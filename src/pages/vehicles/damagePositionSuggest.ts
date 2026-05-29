import type { DamagePosition, SketchMarker } from "../../domain/vehicle";

export type PositionSuggestion = {
  suggested: DamagePosition;
  allowed: DamagePosition[];
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Heuristik basierend auf Skizzenorientierung:
 * - Front = rechts (x hoch)
 * - Heck = links (x niedrig)
 * - Links am Fahrzeug = oben (y niedrig)
 * - Rechts am Fahrzeug = unten (y hoch)
 */
export function suggestDamagePosition(marker: SketchMarker | undefined): PositionSuggestion {
  if (!marker) {
    return {
      suggested: "unknown",
      allowed: [
        "unknown",
        "front_right",
        "front_center",
        "front_left",
        "side_right",
        "side_left",
        "rear_right",
        "rear_center",
        "rear_left",
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
      ],
    };
  }

  const x = clamp01(marker.x);
  const y = clamp01(marker.y);

  const regionX = x < 0.33 ? "rear" : x > 0.66 ? "front" : "mid";
  const regionY = y < 0.33 ? "top" : y > 0.66 ? "bottom" : "mid";

  const quadrant: DamagePosition =
    regionY === "top"
      ? regionX === "rear"
        ? "top_left"
        : "top_right"
      : regionY === "bottom"
        ? regionX === "rear"
          ? "bottom_left"
          : "bottom_right"
        : "unknown";

  const primary: DamagePosition =
    regionX === "front"
      ? regionY === "top"
        ? "front_left"
        : regionY === "bottom"
          ? "front_right"
          : "front_center"
      : regionX === "rear"
        ? regionY === "top"
          ? "rear_left"
          : regionY === "bottom"
            ? "rear_right"
            : "rear_center"
        : regionY === "top"
          ? "side_left"
          : regionY === "bottom"
            ? "side_right"
            : "unknown";

  // erlaubte Positionen in der Umgebung (etwas breiter, damit man korrigieren kann)
  const allowed: DamagePosition[] = [];
  allowed.push(primary);
  allowed.push(quadrant);

  if (regionX === "front") allowed.push("front_left", "front_center", "front_right");
  if (regionX === "rear") allowed.push("rear_left", "rear_center", "rear_right");
  if (regionX === "mid") allowed.push("side_left", "side_right");

  if (regionY === "top") allowed.push("top_left", "top_right");
  if (regionY === "bottom") allowed.push("bottom_left", "bottom_right");

  allowed.push("unknown");

  const suggested = primary !== "unknown" ? primary : quadrant !== "unknown" ? quadrant : "unknown";
  return { suggested, allowed: uniq(allowed) };
}
