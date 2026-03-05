import { describe, it, expect, beforeEach } from "vitest";
import {
  userTransports,
  userProducers,
  userConsumers,
  userRooms,
  roomProducers,
} from "../src/state.js";

describe("state maps", () => {
  beforeEach(() => {
    userTransports.clear();
    userProducers.clear();
    userConsumers.clear();
    userRooms.clear();
    roomProducers.clear();
  });

  it("userTransports stores and retrieves transports", () => {
    const transport = { id: "t1" } as any;
    userTransports.set("user-1", transport);
    expect(userTransports.get("user-1")).toBe(transport);
  });

  it("userProducers stores arrays of producers", () => {
    const producers = [{ id: "p1" }, { id: "p2" }] as any[];
    userProducers.set("user-1", producers);
    expect(userProducers.get("user-1")).toHaveLength(2);
  });

  it("userConsumers stores arrays of consumers", () => {
    userConsumers.set("user-1", []);
    expect(userConsumers.get("user-1")).toEqual([]);
  });

  it("userRooms maps userId to roomId", () => {
    userRooms.set("user-1", "channel:ch1");
    expect(userRooms.get("user-1")).toBe("channel:ch1");
  });

  it("roomProducers stores nested Maps", () => {
    const inner = new Map([["prod-1", { userId: "u1", producer: {} as any }]]);
    roomProducers.set("channel:ch1", inner);
    expect(roomProducers.get("channel:ch1")?.get("prod-1")?.userId).toBe("u1");
  });
});
