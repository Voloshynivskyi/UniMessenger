import { Box, Typography, Divider } from "@mui/material";

const AuthModalHeader: React.FC<{ title: string }> = ({ title }) => {
  return (
    <Box sx={{ textAlign: "center", mb: 1 }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Typography>

      <Divider sx={{ mt: 1, opacity: 0.2 }} />
    </Box>
  );
};

export default AuthModalHeader;
