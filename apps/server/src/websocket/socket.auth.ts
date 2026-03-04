import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error("UNAUTHORIZED"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
}
