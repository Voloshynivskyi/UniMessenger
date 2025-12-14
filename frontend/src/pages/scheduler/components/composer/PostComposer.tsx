// frontend/src/pages/scheduler/components/composer/PostComposer.tsx

import React from "react";
import { Box, Button, Divider, Stack } from "@mui/material";
import ScheduleSendIcon from "@mui/icons-material/ScheduleSend";

import ComposerHeader from "./ComposerHeader";
import TextEditor from "./TextEditor";
import MediaAttachments from "./MediaAttachments";
import SchedulePanel from "./SchedulePanel";
import SchedulerChatPicker from "./SchedulerChatPicker";
import type { ChatTarget } from "./types";

interface Props {
  text: string;
  onTextChange: (v: string) => void;
  scheduledAt: string;
  onScheduledAtChange: (v: string) => void;
  targets: ChatTarget[];
  onTargetsChange: (v: ChatTarget[]) => void;
  onSubmit: () => void;
}

export default function PostComposer({
  text,
  onTextChange,
  scheduledAt,
  onScheduledAtChange,
  targets,
  onTargetsChange,
  onSubmit,
}: Props) {
  const canSchedule =
    targets.length > 0 && text.trim().length > 0 && !!scheduledAt;

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // Page does not scroll
      }}
    >
      <ComposerHeader />
      <Divider />

      {/* MAIN CONTENT */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden", // ✅ ключ
          p: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.4fr 0.6fr" },
          gap: 2,
        }}
      >
        {/* LEFT COLUMN */}
        <Stack spacing={2}>
          <TextEditor value={text} onChange={onTextChange} />
          <MediaAttachments />
        </Stack>

        {/* RIGHT COLUMN */}
        <Stack
          spacing={2}
          sx={{
            height: "100%",
            overflow: "hidden", // ✅
          }}
        >
          <SchedulerChatPicker value={targets} onChange={onTargetsChange} />

          <SchedulePanel value={scheduledAt} onChange={onScheduledAtChange} />
        </Stack>
      </Box>

      <Divider />

      {/* ACTIONS */}
      <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<ScheduleSendIcon />}
          disabled={!canSchedule}
          onClick={onSubmit}
          sx={{ borderRadius: 2 }}
        >
          Schedule
        </Button>
      </Box>
    </Box>
  );
}
