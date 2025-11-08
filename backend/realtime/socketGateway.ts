/**
 * backend/realtime/socketGateway.ts
 * Міст між TelegramClientManager та Socket.IO сервером
 */

import type { Server } from "socket.io";
import { logger } from "../utils/logger";

/**
 * Class representing the Socket Gateway
 */
export class SocketGateway {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /** Send an event to a specific user */
  emitToUser(userId: string, event: string, payload: any) {
    logger.info(
      `[SocketGateway] Emit to user ${userId} from account ${payload.accountId}: ${event}`
    );

    this.io.to(userId).emit(event, payload);
  }

  /** Send an event to a specific room */
  emitToRoom(room: string, event: string, payload: any) {
    logger.info(
      `[SocketGateway] Emit to room ${room} from account ${payload.accountId}: ${event}`
    );
    this.io.to(room).emit(event, payload);
  }

  /** Send an event to all users */
  broadcast(event: string, payload: any) {
    logger.info(
      `[SocketGateway] Broadcast from account ${payload.accountId}: ${event}`
    );
    this.io.emit(event, payload);
  }
}

let socketGateway: SocketGateway | null = null;

/** Initialize SocketGateway */
export function initSocketGateway(io: Server) {
  socketGateway = new SocketGateway(io);
  return socketGateway;
}

/** Global access (only after initialization) */
export function getSocketGateway() {
  if (!socketGateway) throw new Error("SocketGateway not initialized!");
  return socketGateway;
}

/**
 * Export a singleton instance of SocketGateway
 */
export default socketGateway;
