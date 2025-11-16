// frontend/src/pages/auth/PasswordConfirmationField.tsx
import React from "react";
import { TextField, IconButton, InputAdornment } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
interface PasswordFieldProps {
  password: string;
  passwordConfirmation: string;
  setPasswordConfirmation: (value: string) => void;
}
const PasswordConfirmationField: React.FC<PasswordFieldProps> = ({
  password,
  passwordConfirmation,
  setPasswordConfirmation,
}) => {
  const [showPassword, setShowPassword] = React.useState(false);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  return (
    <TextField
      type={showPassword ? "text" : "password"}
      error={
        password !== passwordConfirmation && passwordConfirmation.length > 0
      }
      onChange={(e) => setPasswordConfirmation(e.target.value)}
      label="Password confirmation"
      sx={{ width: "100%", mb: "4vh" }}
      helperText={
        password !== passwordConfirmation ? "Passwords do not match" : ""
      }
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={togglePasswordVisibility} edge="end">
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
};

export default PasswordConfirmationField;
