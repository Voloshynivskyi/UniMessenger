import React, { createContext, useContext, useState, useCallback } from "react";
import { discordApi } from "../api/discordApi";

export interface DiscordBot {
  id: string;
  botUserId?: string | null;
  botUsername?: string | null;
  guilds: any[];
}

interface DiscordBotsContextProps {
  bots: DiscordBot[];
  loading: boolean;
  refreshBots: () => Promise<void>;
  registerBot: (token: string) => Promise<void>;
  deactivateBot: (botId: string) => Promise<void>;
}

const DiscordBotsContext = createContext<DiscordBotsContextProps>(null!);

export const DiscordBotsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [bots, setBots] = useState<DiscordBot[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshBots = useCallback(async () => {
    setLoading(true);
    const data = await discordApi.listBots();
    setBots(data.bots);
    setLoading(false);
  }, []);

  const registerBot = useCallback(async (token: string) => {
    await discordApi.registerBot(token);
    await refreshBots();
  }, []);

  const deactivateBot = useCallback(async (botId: string) => {
    await discordApi.deactivateBot(botId);
    await refreshBots();
  }, []);

  return (
    <DiscordBotsContext.Provider
      value={{ bots, loading, refreshBots, registerBot, deactivateBot }}
    >
      {children}
    </DiscordBotsContext.Provider>
  );
};

export const useDiscordBots = () => useContext(DiscordBotsContext);
