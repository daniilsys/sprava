import type { VoiceCommand } from "../redis/subscriber.js";
import { publishResponse, publishNotification } from "../redis/publisher.js";
import { destroyRoom } from "../mediasoup/rooms.js";
import {
  userTransports,
  userProducers,
  userConsumers,
  userRooms,
  roomProducers,
} from "../state.js";

export async function handleLeave(cmd: VoiceCommand): Promise<void> {
  const { requestId, roomId, userId } = cmd;

  try {
    // Close and remove all consumers
    const consumers = userConsumers.get(userId) ?? [];
    for (const consumer of consumers) consumer.close();
    userConsumers.delete(userId);

    // Close and remove all producers, also clean room index
    const producers = userProducers.get(userId) ?? [];
    const roomMap = roomProducers.get(roomId);
    for (const producer of producers) {
      roomMap?.delete(producer.id);
      producer.close();
    }
    userProducers.delete(userId);

    // Close and remove transport
    const transport = userTransports.get(userId);
    if (transport) {
      transport.close();
      userTransports.delete(userId);
    }

    userRooms.delete(userId);

    // Notify gateway that this user left (so it can update Redis state)
    await publishNotification({
      type: "USER_LEFT",
      roomId,
      userId,
    });

    // Destroy the room if it's now empty
    if (roomMap && roomMap.size === 0) {
      // Count remaining users (those still in userRooms pointing to this room)
      const roomUsers = Array.from(userRooms.values()).filter(
        (r) => r === roomId,
      );
      if (roomUsers.length === 0) {
        destroyRoom(roomId);
      }
    }

    await publishResponse(requestId, { ok: true, payload: {} });
  } catch (err) {
    const error = err instanceof Error ? err.message : "LEAVE_ERROR";
    await publishResponse(requestId, { ok: false, error });
  }
}
