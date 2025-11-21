// frontend/src/pages/inbox/InboxPage.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Box } from "@mui/material";
import PageContainer from "../../components/common/PageContainer";
import InboxChatsSidebar from "./InboxChatsSidebar";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import { useTelegram } from "../../context/TelegramAccountContext";
import ChatWindow from "./chat/ChatWindow";

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 480;

const InboxPage: React.FC = () => {
  const { accounts } = useTelegram();
  const { fetchDialogs } = useUnifiedDialogs();

  const [sidebarWidth, setSidebarWidth] = useState<number>(320);

  const loadedAccounts = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    for (const acc of accounts) {
      if (!loadedAccounts.current.has(acc.accountId)) {
        loadedAccounts.current.add(acc.accountId);
        fetchDialogs("telegram", acc.accountId);
      }
    }
  }, [accounts, fetchDialogs]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        let nextWidth = startWidth + delta;
        if (nextWidth < MIN_SIDEBAR_WIDTH) nextWidth = MIN_SIDEBAR_WIDTH;
        if (nextWidth > MAX_SIDEBAR_WIDTH) nextWidth = MAX_SIDEBAR_WIDTH;
        setSidebarWidth(nextWidth);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [sidebarWidth]
  );

  return (
    <PageContainer>
      <Box
        sx={{
          display: "flex",
          height: "calc(100vh - 64px - 12px)", // header + paddings
          minHeight: 0,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: 1,
        }}
      >
        <InboxChatsSidebar width={sidebarWidth} />

        {/* Resize handle */}
        <Box
          onMouseDown={handleResizeMouseDown}
          sx={{
            width: 4,
            cursor: "col-resize",
            "&:hover": { bgcolor: "primary.light" },
          }}
        />

        {/* Chat area */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: "background.default",
            p: 0, // щоб ChatWindow сам керував відступами
            display: "flex",
          }}
        >
          <ChatWindow />
        </Box>
      </Box>
    </PageContainer>
  );
};

export default InboxPage;
