export interface LogRow {
  id: string;
  timestamp: string;
  userId: string | null;
  result: string;
  score: number | null;
  reason: string | null;
  user: { id: string; name: string } | null;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function reasonText(reason: string | null): string {
  switch (reason) {
    case "NO_MATCH":
      return "Fingerprint not recognized";
    case "POOR_QUALITY":
      return "Scan was too unclear to read";
    case "NO_TEMPLATES":
      return "No users were enrolled";
    case null:
      return "Denied";
    default:
      return reason;
  }
}

export function describeLog(l: LogRow): string {
  return l.result === "GRANTED"
    ? `${l.user?.name ?? "A user"} was let in`
    : reasonText(l.reason);
}