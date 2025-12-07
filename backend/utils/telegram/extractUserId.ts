// backend/utils/extractUserId.ts
// Function to extract userId from various 'fromId' structures
// Returns userId as string or null if not found

export function extractUserId(fromId: any): string | null {
  if (!fromId || typeof fromId !== "object") {
    if (typeof fromId === "number") return fromId.toString();
    if (typeof fromId === "string") return fromId;
    return null;
  }
  // Handle different className cases
  switch (fromId.className) {
    case "PeerUser":
    case "PeerSelf":
      return fromId.userId?.toString() ?? null;

    // PeerChat and PeerChannel do not contain userId
    default:
      return null;
  }
}
