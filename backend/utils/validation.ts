/**
 * backend/utils/validation.ts
 * Provides reusable validation helpers for user input fields.
 */

export interface PasswordValidationResult {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

/**
 * Validates password strength based on minimum security requirements.
 * Policy:
 *  - At least 8 characters
 *  - Contains at least one letter
 *  - Contains at least one digit
 *  - Contains at least one special character
 */
export function isValidPassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>+\-]/.test(password); // corrected regex

  return {
    hasMinLength,
    hasLetter,
    hasDigit,
    hasSpecial,
    isValid: hasMinLength && hasLetter && hasDigit && hasSpecial,
  };
}

/**
 * Validates if a name contains letters (Latin or Cyrillic), spaces, apostrophes, or hyphens.
 */
export function isValidName(name: string): boolean {
  return /^[a-zA-Zа-яА-ЯёЁїЇіІєЄґҐ\s'-]+$/.test(name);
}

/**
 * Basic email validation using standard pattern.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates a phone number by checking digit count after trimming non-numeric characters.
 * Accepts at least 10 digits (suitable for most international formats).
 */
export function isValidPhone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const onlyDigits = value.replace(/[^\d]/g, "");
  return onlyDigits.length >= 10;
}
