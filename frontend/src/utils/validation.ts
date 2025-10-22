/**
 * frontend/src/utils/validation.ts
 * validation functions for name, email, and password of registering user
 */

export function isValidPassword(password: string): {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  isValid: boolean;
} {
  return {
    hasMinLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>+-]/.test(password),
    isValid:
      password.length >= 8 &&
      /[a-zA-Z]/.test(password) &&
      /\d/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>+-]/.test(password),
  };
}

export function isValidName(name: string): boolean {
  return /^[a-zA-Zа-яА-ЯёЁїЇіІєЄґҐ\s'-]+$/.test(name);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPasswordMessage(password: string): string {
  const validation = isValidPassword(password);
  let message = "";
  if (!validation.hasMinLength) {
    message = "Password must be at least 8 characters long.";
  } else if (!validation.hasLetter) {
    message = "Password must include at least one letter.";
  } else if (!validation.hasDigit) {
    message = "Password must include at least one digit.";
  } else if (!validation.hasSpecial) {
    message = "Password must include at least one special character.";
  } else {
    message = "";
  }
  return message;
}
