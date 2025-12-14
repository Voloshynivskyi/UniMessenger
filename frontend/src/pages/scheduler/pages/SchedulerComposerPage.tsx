import React, { useState } from "react";
import { Box, Paper } from "@mui/material";
import PostComposer from "../components/composer/PostComposer";
import type { ChatTarget } from "../components/composer/types";
import { useScheduler } from "../../../context/SchedulerContext";
import { useNavigate } from "react-router-dom";

export default function SchedulerComposerPage() {
  const { createPost } = useScheduler();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [targets, setTargets] = useState<ChatTarget[]>([]);

  const handleSubmit = async () => {
    await createPost({ text, scheduledAt, targets });
    navigate("/scheduler");
  };

  return (
    <Box sx={{ height: "100%" }}>
      <Paper sx={{ borderRadius: 3, height: "100%", overflow: "hidden" }}>
        <PostComposer
          text={text}
          onTextChange={setText}
          scheduledAt={scheduledAt}
          onScheduledAtChange={setScheduledAt}
          targets={targets}
          onTargetsChange={setTargets}
          onSubmit={handleSubmit}
        />
      </Paper>
    </Box>
  );
}
