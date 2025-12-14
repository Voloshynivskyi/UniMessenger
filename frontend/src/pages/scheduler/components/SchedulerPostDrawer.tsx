// frontend/src/pages/scheduler/components/SchedulerPostDrawer.tsx

import React from "react";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CancelIcon from "@mui/icons-material/Cancel";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import DeleteIcon from "@mui/icons-material/Delete";

import { useScheduler } from "../../../context/SchedulerContext";

export default function SchedulerPostDrawer() {
  const {
    drawerOpen,
    closePost,
    selectedPost,
    selectedPostId,
    detailsLoading,
    deletePost,
    cancelPost,
    retryPost,
  } = useScheduler();

  const canCancel = selectedPost?.status === "scheduled";
  const canRetry = selectedPost?.status === "failed";
  const canDelete = selectedPost?.status !== "sending";

  if (!drawerOpen) return null;

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={closePost}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
    >
      <Box
        sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography fontWeight={900}>Post details</Typography>
          <IconButton onClick={closePost}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {detailsLoading || !selectedPost ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography fontWeight={800}>{selectedPost.text}</Typography>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={1} sx={{ flex: 1, overflow: "auto" }}>
              {selectedPost.targets.map((t) => (
                <Box
                  key={t.id}
                  sx={(theme) => ({
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    p: 1,
                  })}
                >
                  <Typography fontWeight={700}>
                    {t.platform.toUpperCase()} · {t.status}
                  </Typography>

                  {t.lastError && (
                    <Typography variant="caption" color="error">
                      {t.lastError}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                startIcon={<CancelIcon />}
                disabled={!canCancel}
                onClick={() => selectedPostId && cancelPost(selectedPostId)}
              >
                Cancel
              </Button>

              <Button
                startIcon={<AutorenewIcon />}
                disabled={!canRetry}
                onClick={() => selectedPostId && retryPost(selectedPostId)}
              >
                Retry
              </Button>

              <Button
                startIcon={<DeleteIcon />}
                color="error"
                disabled={!canDelete}
                onClick={() => selectedPostId && deletePost(selectedPostId)}
              >
                Delete
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </Drawer>
  );
}
