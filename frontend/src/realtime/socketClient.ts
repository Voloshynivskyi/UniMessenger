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
    event: string; // allow "__onAny__"
    callback: (...args: any[]) => void;
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

    this.socket.on("connect", () => {
      console.log("[SocketClient] Connected:", this.socket?.id);

      // Attach all pending listeners
      this.pendingListeners.forEach(({ event, callback }) => {
        console.log("[SocketClient] Attaching pending listener:", event);

        if (event === "__onAny__") {
          this.socket?.onAny(callback as any);
        } else {
          this.socket?.on(event as any, callback as any);
        }
      });

      this.pendingListeners = [];
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

    // Debug catch-all (used only for logging):
    this.socket.onAny((event, ...args) => {
      console.log("[SocketClient:onAny LOG]", event, args);
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
    if (!this.socket) {
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
      return;
    }

    this.pendingListeners = this.pendingListeners.filter(
      (l) => l.event !== event || (callback && l.callback !== callback)
    );
  }

  public onAny(handler: (event: string, ...args: any[]) => void): void {
    if (this.socket) {
      this.socket.onAny(handler);
    } else {
      this.pendingListeners.push({
        event: "__onAny__",
        callback: handler,
      });
    }
  }

  public offAny(handler: (event: string, ...args: any[]) => void): void {
    if (this.socket) {
      this.socket.offAny(handler);
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

export const socketClient = new SocketClient();
