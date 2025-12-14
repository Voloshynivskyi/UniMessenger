import React from "react";
import { Box, TextField, Typography } from "@mui/material";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function TextEditor({ value, onChange }: Props) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
        Post text
      </Typography>

      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        minRows={4}
        maxRows={12}
        placeholder="Write your post…"
        fullWidth
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 2.5,
          },
        }}
      />

      <Typography
        variant="caption"
        sx={{ display: "block", mt: 0.75, opacity: 0.7 }}
      >
        Markdown / formatting — later. Plain text for now.
      </Typography>
    </Box>
  );
}
