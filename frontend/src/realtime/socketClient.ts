// frontend/src/realtime/socketClient.ts
import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:7007";

export class SocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
  private pingInterval?: ReturnType<typeof setInterval>;

  // Store events registered BEFORE connection
  private pendingListeners: {
    event: keyof ServerToClientEvents;
    callback: ServerToClientEvents[keyof ServerToClientEvents];
  }[] = [];

  public connect(token: string): void {
    if (this.socket && this.socket.connected) return;

    console.log("[Socket connect] Token:", token);

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    this.registerBaseHandlers();

    // After connection, register pending listeners
    this.socket.on("connect", () => {
      console.log("[SocketClient] Connected:", this.socket?.id);
      this.pendingListeners.forEach(({ event, callback }) => {
        console.log("[SocketClient] Attaching pending listener:", event);
        this.socket?.on(event as any, callback as any);
      });
      this.pendingListeners = []; // Clear the queue
    });
  }

  private registerBaseHandlers(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Connected to Socket.IO server", this.socket?.id);
      this.socket?.emit("system:ping");
      this.startPing();
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("Socket disconnected:", reason);
      this.stopPing();
    });

    this.socket.on("system:pong", () => {
      console.debug("Pong received from server");
    });

    this.socket.on("realtime:connected", () => {
      console.log("Realtime connection established");
    });

    this.socket.on("system:error", (data) => {
      console.error("System error from server:", data);
    });

    this.socket.onAny((event, ...args) => {
      console.log("[SocketClient:onAny]", event, args);
    });
  }

  public emit<T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ): void {
    if (!this.socket) {
      console.warn("Cannot emit — socket not initialized");
      return;
    }
    console.log(`Emitting event: ${event}`, args);
    this.socket.emit(event, ...args);
  }

  public on<T extends keyof ServerToClientEvents>(
    event: T,
    callback: ServerToClientEvents[T]
  ): void {
    // If not connected yet, queue the listener
    if (!this.socket) {
      console.log("[SocketClient] Queueing listener until connect:", event);
      this.pendingListeners.push({ event, callback });
      return;
    }
    this.socket.on(event as any, callback as any);
  }

  public off<T extends keyof ServerToClientEvents>(
    event: T,
    callback?: ServerToClientEvents[T]
  ): void {
    if (this.socket) {
      this.socket.off(event as any, callback as any);
    } else {
      // Remove from queue if not connected yet
      this.pendingListeners = this.pendingListeners.filter(
        (l) => l.event !== event || (callback && l.callback !== callback)
      );
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.stopPing();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("system:ping");
      }
    }, 20_000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
}

// Singleton instance
export const socketClient = new SocketClient();
