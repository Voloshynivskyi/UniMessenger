/**
 * backend/utils/validation.ts
 * validation functions for name, email, and password of registering user
 */

export function isValidPassword(password: string): {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
} {
  return {
    hasMinLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]+-/.test(password),
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

export function isValidPhone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const onlyDigits = trimmed.replace(/[^\d]/g, "");
  return onlyDigits.length >= 10;
}
