const EPOCH = BigInt(new Date("2026-01-01T00:00:00.000Z").getTime());

let sequence = 0n;
let lastTimestamp = -1n;

export const generateId = (): string => {
  let timestamp = BigInt(Date.now());

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & 0xfffn;
    if (sequence === 0n) {
      while (timestamp <= lastTimestamp) {
        timestamp = BigInt(Date.now());
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  const id = ((timestamp - EPOCH) << 22n) | (1n << 12n) | sequence;
  return id.toString();
};
