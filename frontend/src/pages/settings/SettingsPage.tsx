// frontend/src/pages/settings/SettingsPage.tsx
import React from "react";
import { Typography, Divider, Switch, FormControlLabel } from "@mui/material";
import PageContainer from "../../components/common/PageContainer";
import SectionCard from "../../components/common/SectionCard";

const SettingsPage: React.FC = () => {
  return (
    <PageContainer>
      {/* GENERAL */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          General
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <FormControlLabel control={<Switch />} label="Dark mode" />

        <FormControlLabel control={<Switch />} label="System theme" />
      </SectionCard>

      {/* NOTIFICATIONS */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Notifications
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <FormControlLabel control={<Switch />} label="Desktop notifications" />
        <FormControlLabel control={<Switch />} label="Email updates" />
      </SectionCard>

      {/* SECURITY */}
      <SectionCard>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Security
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Typography>Password change — coming soon</Typography>
      </SectionCard>
    </PageContainer>
  );
};

export default SettingsPage;
