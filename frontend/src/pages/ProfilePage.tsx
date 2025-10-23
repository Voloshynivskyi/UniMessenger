/**
 * frontend/src/pages/InfoPage.tsx
 * Welcome page with application information and feature overview
 */
import React from "react";
import {
  Box,
  Card,
  List,
  ListItem,
  Avatar,
  Typography,
  Divider,
  ListItemText,
  Button,
} from "@mui/material";
import { useAuth, type AuthContextType } from "../context/AuthContext";
const ProfilePage: React.FC = () => {
  const context = useAuth() as AuthContextType;
  return (
    <Card sx={{ p: 4, maxWidth: 500, mx: "auto", borderRadius: 4 }}>
      <Box
        sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <Avatar sx={{ width: 80, height: 80, mb: 2 }} />
        <Typography variant="h6">
          {context.user?.displayName ||
            context.user?.email.split("@")[0].toUpperCase()}
        </Typography>

        <Typography color="text.secondary">{context.user?.email}</Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <List>
        <ListItem>
          <ListItemText primary="Email" secondary={context.user?.email} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Display Name"
            secondary={
              context.user?.displayName || `@${context.user?.email.split("@")[0]}`
            }
          />
        </ListItem>
      </List>

      <Button variant="outlined" fullWidth sx={{ mt: 3 }}>
        Edit Profile
      </Button>
    </Card>
  );
};

export default ProfilePage;
