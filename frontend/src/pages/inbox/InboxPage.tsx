// frontend/src/pages/inbox/InboxPage.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Box } from "@mui/material";
import PageContainer from "../../components/common/PageContainer";
import InboxChatsSidebar from "./InboxChatsSidebar";
import { useUnifiedDialogs } from "../../context/UnifiedDialogsContext";
import { useTelegram } from "../../context/TelegramAccountContext";

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 480;

const InboxPage: React.FC = () => {
  const { accounts } = useTelegram();
  const { fetchDialogs } = useUnifiedDialogs();

  const [sidebarWidth, setSidebarWidth] = useState<number>(320);

  // Tracks which accounts already loaded dialogs
  const loadedAccounts = useRef<Set<string>>(new Set());

  // Load dialogs for new accounts only ONCE
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    for (const acc of accounts) {
      if (!loadedAccounts.current.has(acc.accountId)) {
        loadedAccounts.current.add(acc.accountId); // mark as loaded
        fetchDialogs("telegram", acc.accountId); // load once
      }
    }
  }, [accounts, fetchDialogs]);

  // Sidebar resize
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
          height: "calc(100vh - 64px - 48px)",
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

        {/* Chat placeholder */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: "background.default",
            p: 2,
          }}
        >
          No chat selected. Please select a chat from the sidebar.
        </Box>
      </Box>
    </PageContainer>
  );
};

export default InboxPage;
