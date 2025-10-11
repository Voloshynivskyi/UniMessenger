// File: frontend/src/context/SocketProvider.tsx
// Purpose: Real WebSocket readiness context wired to wsHub (no raw ws object).
// - Uses ensureSessionSocket(sessionId) to open/keep the connection.
// - Sets wsReady=true after any WS update is received for the session.
// - If no updates arrive for 60s, flips wsReady=false (simple liveness check).

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDefaultSessionId } from "../lib/http";
import { ensureSessionSocket, onSessionUpdate } from "../lib/wsHub";
import { useTelegramAuth } from "./TelegramAuthContext";

type Ctx = { ws?: WebSocket | null; wsReady: boolean };
const SocketCtx = createContext<Ctx>({ ws: null, wsReady: false });

// English: mirror ChatWindow's logic to resolve active session id
function resolveSessionIdFromCtx(ctx: any): string | null {
  return (
    ctx?.activeSessionId ||
    ctx?.sessionId ||
    ctx?.active?.sessionId ||
    ctx?.current?.sessionId ||
    (Array.isArray(ctx?.accounts) &&
      (ctx.accounts.find((a: any) => a?.active)?.sessionId ||
        ctx.accounts[0]?.sessionId)) ||
    null
  );
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useTelegramAuth() as any;

  // English: choose a sessionId (default -> from context). Adjust priority if needed.
  const sessionId = useMemo(() => {
    return (
      (getDefaultSessionId() || resolveSessionIdFromCtx(auth) || "").trim() ||
      null
    );
  }, [auth]);

  const [wsReady, setWsReady] = useState(false);
  const lastSeenRef = useRef<number>(0);
  const hbTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    // English: cleanup old handlers/heartbeat when session changes
    if (offRef.current) {
      try {
        offRef.current();
      } catch {}
      offRef.current = null;
    }
    if (hbTimerRef.current) {
      clearInterval(hbTimerRef.current);
      hbTimerRef.current = null;
    }
    setWsReady(false);
    lastSeenRef.current = 0;

    if (!sessionId) return;

    // 1) Ensure socket exists/kept by wsHub
    ensureSessionSocket(sessionId);

    // 2) Mark ready when any update arrives; store lastSeen timestamp
    const off = onSessionUpdate(sessionId, () => {
      lastSeenRef.current = Date.now();
      if (!wsReady) setWsReady(true);
    });
    offRef.current = off;

    // 3) Heartbeat: if no updates for 60s -> consider not ready
    hbTimerRef.current = setInterval(() => {
      const now = Date.now();
      const stale =
        lastSeenRef.current === 0 || now - lastSeenRef.current > 60_000;
      if (stale && wsReady) setWsReady(false);
    }, 10_000);

    return () => {
      if (offRef.current) {
        try {
          offRef.current();
        } catch {}
        offRef.current = null;
      }
      if (hbTimerRef.current) {
        clearInterval(hbTimerRef.current);
        hbTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const value = useMemo<Ctx>(() => ({ ws: null, wsReady }), [wsReady]);

  return <SocketCtx.Provider value={value}>{children}</SocketCtx.Provider>;
};

export const useSocket = () => useContext(SocketCtx);
