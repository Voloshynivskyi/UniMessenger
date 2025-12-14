import React from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import type { SchedulerPost } from "./listUtils";
import ScheduledPostListItem from "./ScheduledPostListItem";
import { useScheduler } from "../../../../context/SchedulerContext";

export default function ScheduledPostsList({
  selectedDate,
  posts,
}: {
  selectedDate: Date;
  posts: SchedulerPost[];
}) {
  const navigate = useNavigate();
  const { openPost } = useScheduler();

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack spacing={0.25}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            Scheduled posts
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            {selectedDate.toDateString()}
          </Typography>
        </Stack>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate("/scheduler/compose")}
          sx={{ borderRadius: 2 }}
        >
          Compose
        </Button>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
        {posts.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ opacity: 0.8 }}>
              No posts for this day. Create one with <b>Compose</b>.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {posts
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.scheduledAt).getTime() -
                  new Date(b.scheduledAt).getTime()
              )
              .map((p) => (
                <ScheduledPostListItem key={p.id} post={p} onOpen={openPost} />
              ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
