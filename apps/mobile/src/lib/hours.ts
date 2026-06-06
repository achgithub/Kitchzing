import type { RestaurantConfig } from "./types";

export function isWithinHours(config: Pick<RestaurantConfig, "open_time" | "close_time" | "timezone">): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: config.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const current = `${h}:${m}`;
    return current >= config.open_time && current < config.close_time;
  } catch {
    return true; // fail open — don't block orders if config is malformed
  }
}
