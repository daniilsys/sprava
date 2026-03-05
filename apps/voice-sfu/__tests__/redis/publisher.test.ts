import { describe, it, expect, vi } from "vitest";
import { publishResponse, publishNotification } from "../../src/redis/publisher.js";

// Access the mock Redis publish function through the module
vi.mock("../../src/redis/publisher.js", async (importOriginal) => {
  const mockPublish = vi.fn().mockResolvedValue(1);

  return {
    pub: { publish: mockPublish },
    publishResponse: async (requestId: string, response: any) => {
      const msg = { requestId, ...response };
      await mockPublish(`voice:res:${requestId}`, JSON.stringify(msg));
    },
    publishNotification: async (notification: any) => {
      await mockPublish("voice:notify", JSON.stringify(notification));
    },
  };
});

// Re-import to get the mocked pub
import { pub } from "../../src/redis/publisher.js";

describe("publisher", () => {
  it("publishResponse publishes to voice:res:{requestId}", async () => {
    await publishResponse("req-123", { ok: true, payload: { foo: "bar" } });

    expect(pub.publish).toHaveBeenCalledWith(
      "voice:res:req-123",
      JSON.stringify({ requestId: "req-123", ok: true, payload: { foo: "bar" } }),
    );
  });

  it("publishResponse includes error field on failure", async () => {
    await publishResponse("req-456", { ok: false, error: "something broke" });

    expect(pub.publish).toHaveBeenCalledWith(
      "voice:res:req-456",
      JSON.stringify({ requestId: "req-456", ok: false, error: "something broke" }),
    );
  });

  it("publishNotification publishes to voice:notify", async () => {
    const notification = {
      type: "NEW_PRODUCER" as const,
      roomId: "channel:ch1",
      userId: "user-1",
      payload: { producerId: "p1", kind: "audio" },
    };

    await publishNotification(notification);

    expect(pub.publish).toHaveBeenCalledWith(
      "voice:notify",
      JSON.stringify(notification),
    );
  });

  it("publishNotification works for USER_LEFT", async () => {
    const notification = {
      type: "USER_LEFT" as const,
      roomId: "channel:ch1",
      userId: "user-1",
    };

    await publishNotification(notification);

    expect(pub.publish).toHaveBeenCalledWith(
      "voice:notify",
      JSON.stringify(notification),
    );
  });
});
