// backend/realtime/middleware/socketAuth.ts
import type { Socket } from "socket.io";
import { verifyToken } from "../../utils/jwt";

/**
 * Middleware to authenticate Socket.IO connections using JWT.
 */
export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {

    // 1️⃣ Get the token from handshake auth data
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log("Socket connection rejected — no token");
      return next(new Error("Unauthorized"));
    }

    // 2️⃣ Check and decode the token
    const payload = verifyToken(token);
    if (!payload || !(payload.id || payload.user_id)) {
      console.log(
        "Socket connection rejected — invalid token payload:",
        payload
      );
      return next(new Error("Unauthorized"));
    }

    // 3️⃣ Save user info to socket object for future use
    socket.data.userId = payload.id || payload.user_id;
    console.log(`Authorized socket for user ${socket.data.userId}`);

    // 4️⃣ Call next to proceed with the connection
    next();
  } catch (err) {
    console.log("Socket auth error:", (err as Error).message);
    next(new Error("Unauthorized"));
  }
}
