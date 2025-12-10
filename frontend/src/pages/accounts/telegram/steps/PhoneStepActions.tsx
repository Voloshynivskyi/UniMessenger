// frontend/src/pages/accounts/telegram/steps/PhoneStepActions.tsx
import { Button, CircularProgress } from "@mui/material";

const PhoneStepActions: React.FC<{
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
      {loading ? <CircularProgress size={22} /> : "Send code"}
    </Button>

    <Button variant="text" fullWidth onClick={onCancel}>
      Cancel
    </Button>
  </>
);

export default PhoneStepActions;