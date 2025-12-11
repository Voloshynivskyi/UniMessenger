import React, { useEffect, useState } from "react";
import { Typography, Divider, Box, Button } from "@mui/material";

import PageContainer from "../../components/common/PageContainer";
import SectionCard from "../../components/common/SectionCard";
import AccountList from "./AccountList";
import { useTelegram } from "../../context/TelegramAccountContext";
import { useDiscordBots } from "../../context/DiscordBotsContext";

import TelegramAuthFlow from "../accounts/telegram/TelegramAuthFlow";
import DiscordAddBotModal from "./discord/DiscordAddBotModal";
import type { TelegramAuthAccount } from "../../api/telegramApi";

const AccountsPage: React.FC = () => {
  const { accounts, refreshAccounts, logoutAccount } = useTelegram();
  const { bots, refreshBots, deactivateBot } = useDiscordBots();

  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isDiscordOpen, setIsDiscordOpen] = useState(false);

  useEffect(() => {
    refreshAccounts();
    refreshBots();
  }, []);

  return (
    <PageContainer>
      {/* Telegram accounts */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Connected Telegram Accounts
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <AccountList
          accounts={accounts as TelegramAuthAccount[]}
          onAddClick={() => setIsTelegramOpen(true)}
          onLogoutAccount={logoutAccount}
          onRefreshAccounts={refreshAccounts}
        />
      </SectionCard>

      {/* Discord Bots */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Connected Discord Bots
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {bots.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No Discord bots added yet.
            </Typography>
            <Button variant="contained" onClick={() => setIsDiscordOpen(true)}>
              Add Discord Bot
            </Button>
          </Box>
        ) : (
          bots.map((b) => (
            <Box
              key={b.id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                p: 2,
                bgcolor: "background.paper",
                borderRadius: 2,
                mb: 1,
              }}
            >
              <Typography>
                {b.botUsername || "Bot"} (ID: {b.id})
              </Typography>
              <Button
                color="error"
                onClick={() => deactivateBot(b.id)}
                size="small"
              >
                Remove
              </Button>
            </Box>
          ))
        )}

        <Button
          variant="outlined"
          sx={{ mt: 2 }}
          onClick={() => setIsDiscordOpen(true)}
        >
          Add Discord Bot
        </Button>
      </SectionCard>

      {/* AUTH MODALS */}
      <TelegramAuthFlow
        open={isTelegramOpen}
        onClose={() => setIsTelegramOpen(false)}
        onComplete={refreshAccounts}
      />

      <DiscordAddBotModal
        open={isDiscordOpen}
        onClose={() => setIsDiscordOpen(false)}
        onComplete={refreshBots}
      />
    </PageContainer>
  );
};

export default AccountsPage;
