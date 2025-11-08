/**
 * backend/realtime/socketServer.ts
 * Initializes Socket.IO and exports a function to attach it to the app later.
 */
import { Server, Socket } from "socket.io";
import http from "http";
import { socketAuth } from "./middleware/socketAuth";
import { initSocketGateway } from "./socketGateway";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
} from "./events";

let io: Server | null = null;
let server: http.Server | null = null;

export function createSocketServer(app: any) {
  server = http.createServer(app);
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents
  >(server, {
    cors: { origin: "*" },
  });
  initSocketGateway(io);
  // Apply authentication middleware

  io.use(socketAuth);

  // Handle client connections

  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      const userId = socket.data.userId;
      console.log("✅ New client connected:", socket.id, "user:", userId);

      // Join a room for the user

      socket.join(userId);

      // Handle user-specific events

      // 🔹 Client → Server: "system:ping"
      socket.on("system:ping", () => {
        // 🔹 Server → Client: "system:pong"
        socket.emit("system:pong");
      });

      socket.on("telegram:send_message", async (data) => {
        // data: TelegramSendMessagePayload (TS вже знає!)
        // const { accountId, chatId, text } = data;
        // Тут ПОВИНЕН бути виклик TelegramClientManager:
        // await telegramClientManager.sendMessage(accountId, chatId, text);
        // Але ми це зробимо на окремому етапі, щоб не мішати шари.
      });
      
      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`❎ User ${userId} disconnected`);
      });
    }
  );

  return { io, server };
}

export { io, server };
