// frontend/src/pages/accounts/telegram/steps/PasswordStepActions.tsx
import { Button, CircularProgress } from "@mui/material";

const PasswordStepActions: React.FC<{
  loading: boolean;
  isValid: boolean;
  onNext: () => void;
  onCancel: () => void;
}> = ({ loading, isValid, onNext, onCancel }) => (
  <>
    <Button
      variant="contained"
      fullWidth
      disabled={!isValid || loading}
      onClick={onNext}
    >
      {loading ? <CircularProgress size={22} /> : "Sign in"}
    </Button>

    <Button variant="text" fullWidth onClick={onCancel}>
      Cancel
    </Button>
  </>
);
export default PasswordStepActions;