import React from "react";
import {
  Typography,
  Box,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material";
import PageContainer from "../../components/common/PageContainer";
import SectionCard from "../../components/common/SectionCard";
import { useAuth } from "../../context/AuthContext";

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const displayName =
    user?.displayName ||
    user?.email.split("@")[0].charAt(0).toUpperCase() +
      user?.email.split("@")[0].slice(1)! ||
    "Unknown User";

  return (
    <PageContainer>
      {/* User Info */}
      <SectionCard>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Avatar sx={{ width: 80, height: 80, mb: 2 }} />
          <Typography variant="h6">{displayName}</Typography>
          <Typography color="text.secondary">{user?.email}</Typography>
        </Box>

        <Button variant="outlined" fullWidth>
          Edit Profile
        </Button>
      </SectionCard>

      {/* Account Details */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Account Details
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <List>
          <ListItem>
            <ListItemText primary="Email" secondary={user?.email} />
          </ListItem>

          <ListItem>
            <ListItemText primary="User ID" secondary={user?.id} />
          </ListItem>

          <ListItem>
            <ListItemText
              primary="Created At"
              secondary={new Date(user?.createdAt ?? "").toLocaleString()}
            />
          </ListItem>
        </List>
      </SectionCard>
    </PageContainer>
  );
};

export default ProfilePage;
