// Purpose: Context provider for WebSocket connection state (no-op placeholder).

import React, { createContext, useContext } from 'react';

type Ctx = { ws?: WebSocket | null; wsReady: boolean };
const SocketCtx = createContext<Ctx>({ ws: null, wsReady: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <SocketCtx.Provider value={{ ws: null, wsReady: false }}>{children}</SocketCtx.Provider>;
};

export const useSocket = () => useContext(SocketCtx);
