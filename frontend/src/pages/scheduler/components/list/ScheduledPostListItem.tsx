import React, { useState } from "react";
import {
  Box,
  Chip,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DraftsIcon from "@mui/icons-material/Drafts";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";

import type { SchedulerPost } from "./listUtils";
import { formatTime } from "./listUtils";
import { useScheduler } from "../../../../context/SchedulerContext";

/**
 * Exhaustive status → chip mapping
 */
const STATUS_CHIP_MAP: Record<
  SchedulerPost["status"],
  { icon: React.ReactElement; label: string }
> = {
  draft: { icon: <DraftsIcon fontSize="small" />, label: "Draft" },
  scheduled: { icon: <ScheduleIcon fontSize="small" />, label: "Scheduled" },
  sending: { icon: <AutorenewIcon fontSize="small" />, label: "Sending" },
  sent: { icon: <CheckCircleOutlineIcon fontSize="small" />, label: "Sent" },
  failed: { icon: <ErrorOutlineIcon fontSize="small" />, label: "Failed" },
  canceled: { icon: <CancelIcon fontSize="small" />, label: "Canceled" },
};

export default function ScheduledPostListItem({
  post,
  onOpen,
}: {
  post: SchedulerPost;
  onOpen: (id: string) => void;
}) {
  const { deletePost, cancelPost, retryPost } = useScheduler();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  const closeMenu = () => setAnchorEl(null);

  const st = STATUS_CHIP_MAP[post.status];
  const targetsCount = post.targetsCount;

  const canCancel = post.status === "scheduled";
  const canRetry = post.status === "failed";
  const canDelete = post.status !== "sending";

  const handleDelete = async () => {
    closeMenu();
    if (!canDelete) return;
    if (!window.confirm("Delete this scheduled post?")) return;
    await deletePost(post.id);
  };

  const handleCancel = async () => {
    closeMenu();
    if (!canCancel) return;
    await cancelPost(post.id);
  };

  const handleRetry = async () => {
    closeMenu();
    if (!canRetry) return;
    await retryPost(post.id);
  };

  return (
    <Box
      onClick={() => onOpen(post.id)}
      role="button"
      sx={(theme) => ({
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2.5,
        p: 1.5,
        cursor: "pointer",
        "&:hover": { bgcolor: theme.palette.action.hover },
      })}
    >
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        justifyContent="space-between"
      >
        <Stack spacing={0.4} sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 900 }}>
            {formatTime(post.scheduledAt)} · {targetsCount} target
            {targetsCount === 1 ? "" : "s"}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
            title={post.text}
          >
            {post.text}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            icon={st.icon}
            label={st.label}
            sx={{ borderRadius: 2, fontWeight: 900 }}
            onClick={(e) => e.stopPropagation()}
          />

          <IconButton size="small" onClick={openMenu}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip
          title={canCancel ? "" : "Only scheduled posts can be canceled"}
          placement="left"
        >
          <span>
            <MenuItem disabled={!canCancel} onClick={handleCancel}>
              <ListItemIcon>
                <CancelIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Cancel" />
            </MenuItem>
          </span>
        </Tooltip>

        <Tooltip
          title={canRetry ? "" : "Only failed posts can be retried"}
          placement="left"
        >
          <span>
            <MenuItem disabled={!canRetry} onClick={handleRetry}>
              <ListItemIcon>
                <AutorenewIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Retry" />
            </MenuItem>
          </span>
        </Tooltip>

        <Tooltip
          title={canDelete ? "" : "Cannot delete while sending"}
          placement="left"
        >
          <span>
            <MenuItem disabled={!canDelete} onClick={handleDelete}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Delete" />
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>
    </Box>
  );
}
