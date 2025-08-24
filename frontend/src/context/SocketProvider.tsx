// frontend/src/context/SocketProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTelegramAuth } from './TelegramAuthContext';

type Ctx = {
  ws?: WebSocket | null;
  wsReady: boolean;
};

const SocketCtx = createContext<Ctx>({ ws: null, wsReady: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sessionId, authorized } = useTelegramAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [wsReady, setWsReady] = useState(false);

  useEffect(() => {
    if (!authorized || !sessionId) return;

    // уникаємо дублю
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsReady(true);
    ws.onclose = () => setWsReady(false);
    ws.onerror = () => setWsReady(false);

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
      setWsReady(false);
    };
  }, [authorized, sessionId]);

  return (
    <SocketCtx.Provider value={{ ws: wsRef.current, wsReady }}>
      {children}
    </SocketCtx.Provider>
  );
};

export const useSocket = () => useContext(SocketCtx);
