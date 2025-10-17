import React from "react";
import { Box, Paper, Typography, TextField, Button } from "@mui/material";

const LoginPage: React.FC = () => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="70vh"
    >
      <Paper elevation={3} sx={{ p: 4, width: 400 }}>
        <Typography variant="h5" gutterBottom>
          Telegram Login
        </Typography>

        <TextField
          fullWidth
          label="Phone number"
          variant="outlined"
          sx={{ mb: 2 }}
        />
        <Button fullWidth variant="contained">
          Send Code
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Use your Telegram phone number to sign in.
        </Typography>
      </Paper>
    </Box>
  );
};

export default LoginPage;
