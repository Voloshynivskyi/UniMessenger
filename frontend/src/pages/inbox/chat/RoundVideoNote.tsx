// frontend/src/pages/inbox/chat/RoundVideoNote.tsx
import { useEffect, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

interface Props {
  src: string;
}

export default function RoundVideoNote({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // Auto-play on component mount
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.muted = true;
    vid.play().catch(() => {
      // If autoplay is blocked, show play button
      setIsPlaying(false);
      setShowControls(true);
    });
  }, []);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      vid.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: 240,
        height: 240,
        borderRadius: "50%",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: 3,
        bgcolor: "black",
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        muted={isMuted}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
          display: "block",
        }}
      />

      {/* Play / Pause */}
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "rgba(0,0,0,0.35)",
          color: "white",
          width: 56,
          height: 56,
          opacity: isPlaying ? 0 : 1,
          transition: "opacity 0.25s",
          "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
        }}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>

      {/* Mute / Unmute (center bottom on hover) */}
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        sx={{
          position: "absolute",
          bottom: 14, // Button positioned at bottom center of circle
          left: "50%",
          transform: "translateX(-50%)",
          width: 48,
          height: 48,
          bgcolor: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(5px)",
          color: "white",
          borderRadius: "50%",
          opacity: showControls ? 1 : 0, // Show only on hover
          transition: "opacity 0.25s ease",
          "&:hover": {
            bgcolor: "rgba(0,0,0,0.65)",
          },
        }}
      >
        {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
      </IconButton>
    </Box>
  );
}
