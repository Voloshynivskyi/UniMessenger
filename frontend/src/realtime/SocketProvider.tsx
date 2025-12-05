// frontend/src/realtime/SocketProvider.tsx
import { useEffect } from "react";
import { socketClient } from "./socketClient";
import { socketBus } from "./eventBus";

interface Props {
  children: React.ReactNode;
}

export function SocketProvider({ children }: Props) {
  useEffect(() => {
    const handleAny = (event: string, ...args: any[]) => {
      const payload = args.length === 1 ? args[0] : args;
      socketBus.emit(event, payload);
    };

    socketClient.onAny(handleAny);

    return () => {
      socketClient.offAny(handleAny);
    };
  }, []);

  return <>{children}</>;
}
