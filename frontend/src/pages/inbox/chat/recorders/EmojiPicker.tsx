import { Box } from "@mui/material";
import Picker, { type EmojiClickData, EmojiStyle } from "emoji-picker-react";

interface Props {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: Props) {
  const handleSelect = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
  };

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: "48px",
        left: 0,
        zIndex: 1500,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        borderRadius: 2,
      }}
    >
      <Picker
        onEmojiClick={handleSelect}
        lazyLoadEmojis
        emojiStyle={EmojiStyle.NATIVE}
      />
    </Box>
  );
}
