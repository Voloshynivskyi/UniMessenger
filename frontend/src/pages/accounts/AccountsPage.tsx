import React, { useEffect, useState } from "react";
import {
  Typography,
  Divider,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";

import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from "@mui/icons-material/Add";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import TelegramIcon from "@mui/icons-material/Telegram";
import AndroidIcon from "@mui/icons-material/Android";

import PageContainer from "../../components/common/PageContainer";
import SectionCard from "../../components/common/SectionCard";
import AccountList from "./AccountList";

import { useTelegram } from "../../context/TelegramAccountContext";
import { useDiscordBots } from "../../context/DiscordBotsContext";

import TelegramAuthFlow from "./telegram/TelegramAuthFlow";
import DiscordAddBotModal from "./discord/DiscordAddBotModal";
import type { TelegramAuthAccount } from "../../api/telegramApi";

const AccountsPage: React.FC = () => {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

  const { accounts, refreshAccounts, logoutAccount } = useTelegram();
  const { bots, refreshBots, deactivateBot } = useDiscordBots();

  const telegramAccounts = accounts ?? [];
  const discordBots = bots ?? [];

  const [isTelegramOpen, setIsTelegramOpen] = useState(false);
  const [isDiscordOpen, setIsDiscordOpen] = useState(false);

  useEffect(() => {
    refreshAccounts();
    refreshBots();
  }, []);

  const hasTelegram = telegramAccounts.length > 0;
  const hasDiscord = discordBots.length > 0;

  return (
    <PageContainer>
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Connected Accounts
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <Typography
          variant="caption"
          sx={{ color: "text.secondary", mb: 1, display: "block" }}
        >
          Telegram accounts
        </Typography>

        {hasTelegram ? (
          <AccountList
            accounts={telegramAccounts as TelegramAuthAccount[]}
            onAddClick={() => setIsTelegramOpen(true)}
            onLogoutAccount={logoutAccount}
            onRefreshAccounts={refreshAccounts}
          />
        ) : (
          <Box
            sx={{
              textAlign: "center",
              py: 4,
              px: 2,
              borderRadius: 2,
              backgroundColor: theme.palette.action.hover,
              mb: 3,
            }}
          >
            <IconButton onClick={() => setIsTelegramOpen(true)}>
              <AddCircleOutlineIcon />
            </IconButton>

            <Typography sx={{ fontWeight: 600 }}>
              No Telegram accounts
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Connect your first Telegram account
            </Typography>
          </Box>
        )}

        <Typography
          variant="caption"
          sx={{ color: "text.secondary", mb: 1, display: "block" }}
        >
          Discord bots
        </Typography>

        {hasDiscord ? (
          <List disablePadding>
            {discordBots.map((bot) => (
              <ListItem
                key={bot.id}
                disablePadding
                sx={{ minHeight: 64, px: 1 }}
                secondaryAction={
                  <IconButton
                    size="small"
                    onClick={() => deactivateBot(bot.id)}
                  >
                    <LogoutIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                }
              >
                <ListItemButton sx={{ pr: 6 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 40, height: 40 }}>
                      <AndroidIcon sx={{ fontSize: 22 }} />
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: "1rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: isSmDown ? "140px" : "250px",
                        }}
                      >
                        {bot.botUsername || "Discord Bot"}
                      </Typography>
                    }
                    secondary={!isSmDown ? `Bot ID: ${bot.id}` : undefined}
                  />
                </ListItemButton>
              </ListItem>
            ))}

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setIsDiscordOpen(true)}
                sx={{
                  borderRadius: 1.5,
                  px: 1.5,
                  py: 1.2,
                  transition: "0.15s",
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <AddIcon sx={{ fontSize: 22 }} />
                  {!isSmDown && (
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: "0.95rem",
                        color: "text.secondary",
                      }}
                    >
                      Add Discord bot
                    </Typography>
                  )}
                </Box>
              </ListItemButton>
            </ListItem>
          </List>
        ) : (
          <Box
            sx={{
              textAlign: "center",
              py: 4,
              px: 2,
              borderRadius: 2,
              backgroundColor: theme.palette.action.hover,
            }}
          >
            <IconButton onClick={() => setIsDiscordOpen(true)}>
              <AddCircleOutlineIcon />
            </IconButton>

            <Typography sx={{ fontWeight: 600 }}>No Discord bots</Typography>

            <Typography variant="body2" color="text.secondary">
              Add a Discord bot to start sending messages
            </Typography>
          </Box>
        )}
      </SectionCard>

      {/* MODALS */}
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
