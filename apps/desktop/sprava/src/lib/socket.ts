import { io, Socket } from "socket.io-client";
import { api } from "./api";

const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3000" : "https://api.sprava.top";

let socket: Socket | null = null;

export async function createSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await api.token.getAccessToken();
  console.log("[socket] creating connection to", SOCKET_URL, "token:", token ? "present" : "MISSING");

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
  });

  socket.on("connect", () => {
    console.log("[socket] connected, id:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
