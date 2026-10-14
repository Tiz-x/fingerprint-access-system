import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "node:http";

let io: SocketServer | null = null;

export function initRealtime(httpServer: HttpServer): SocketServer {
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: false },
});

  io.on("connection", (socket) => {
    console.log(`[ws] client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[ws] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export interface UnlockEvent {
  granted: true;
  userId: string;
  userName: string;
  score: number;
  unlockSeconds: number;
  timestamp: string;
}

export interface DeniedEvent {
  granted: false;
  reason: string;
  timestamp: string;
}

export function emitUnlock(event: UnlockEvent): void {
  io?.emit("door:unlock", event);
}

export function emitDenied(event: DeniedEvent): void {
  io?.emit("door:denied", event);
}