// frontend/src/pages/auth/PasswordField.tsx
import {
  isValidPassword,
  isValidPasswordMessage,
} from "../../utils/validation";
import React from "react";
import { TextField, IconButton, InputAdornment } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
interface PasswordFieldProps {
  password: string;
  setPassword: (value: string) => void;
  validation: boolean;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  password,
  setPassword,
  validation,
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  return (
    <TextField
      error={
        !isValidPassword(password).isValid && password.length > 0 && validation
      }
      onChange={(e) => setPassword(e.target.value)}
      label="Password"
      sx={{ width: "100%", mb: "4vh" }}
      type={showPassword ? "text" : "password"}
      helperText={validation ? isValidPasswordMessage(password) : ""}
      fullWidth
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
export default PasswordField;
