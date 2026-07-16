export function formatTime(s: number): string {
  const safe = Number.isFinite(s) ? Math.max(0, s) : 0;
  const m = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
