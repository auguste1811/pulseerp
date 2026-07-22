export function normalizeFrenchPhone(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`;
  return digits;
}
export function formatCallDuration(seconds: number) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return minutes === 0 ? `${remaining} s` : `${minutes} min ${String(remaining).padStart(2, "0")} s`;
}
