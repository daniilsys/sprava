const EPOCH = 1767225600000; // 2026-01-01T00:00:00Z

export function snowflakeToTimestamp(id: string): number {
  return Number(BigInt(id) >> 22n) + EPOCH;
}

export function snowflakeToDate(id: string): Date {
  return new Date(snowflakeToTimestamp(id));
}
