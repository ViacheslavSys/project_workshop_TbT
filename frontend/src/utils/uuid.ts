const HEX: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0"),
);

function fallbackRandomUUID() {
  // Use crypto.getRandomValues when available, otherwise Math.random as a last resort.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version and variant bits to produce a UUIDv4-compatible string.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return (
    HEX[bytes[0]] +
    HEX[bytes[1]] +
    HEX[bytes[2]] +
    HEX[bytes[3]] +
    "-" +
    HEX[bytes[4]] +
    HEX[bytes[5]] +
    "-" +
    HEX[bytes[6]] +
    HEX[bytes[7]] +
    "-" +
    HEX[bytes[8]] +
    HEX[bytes[9]] +
    "-" +
    HEX[bytes[10]] +
    HEX[bytes[11]] +
    HEX[bytes[12]] +
    HEX[bytes[13]] +
    HEX[bytes[14]] +
    HEX[bytes[15]]
  );
}

export function safeRandomUUID(prefix?: string) {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackRandomUUID();

  if (!prefix) {
    return uuid;
  }

  return `${prefix}-${uuid}`;
}
