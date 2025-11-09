// frontend/src/realtime/RealtimeContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { socketClient } from "../realtime/socketClient";

interface RealtimeContextValue {
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
});

export const RealtimeProvider: React.FC<{
  token: string;
  children: React.ReactNode;
}> = ({ token, children }) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socketClient.connect(token);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    (socketClient as any).socket?.on("connect", handleConnect);
    (socketClient as any).socket?.on("disconnect", handleDisconnect);

    return () => {
      (socketClient as any).socket?.off("connect", handleConnect);
      (socketClient as any).socket?.off("disconnect", handleDisconnect);
      socketClient.disconnect();
    };
  }, [token]);

  return (
    <RealtimeContext.Provider value={{ connected }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
