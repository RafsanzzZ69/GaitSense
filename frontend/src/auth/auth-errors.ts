import type { AuthOperation } from './auth-types';

export const resetConfirmation = 'If an account can receive a reset email, instructions will be sent.';
export function authErrorMessage(error: unknown, operation: AuthOperation): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' ? error.code : '';
  switch (code) {
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'Choose a password that meets the account password policy.';
    case 'auth/email-already-in-use': return 'Unable to create this account. Try signing in or resetting your password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait before trying again.';
    case 'auth/network-request-failed': return 'This account operation needs an internet connection. Please try again when connected.';
    case 'auth/operation-not-allowed': return 'Email authentication is currently unavailable. Please try again later.';
    case 'auth/user-not-found': return operation === 'reset' ? resetConfirmation : 'Unable to sign in with those credentials.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-disabled': return 'Unable to sign in with those credentials.';
    default: return 'Unable to complete this account operation. Please try again.';
  }
}
export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address.';
}
export function validateAuthForm(operation: 'register' | 'login' | 'reset', email: string, password = '', confirmation = ''): string | null {
  const invalidEmail = validateEmail(email);
  if (invalidEmail) return invalidEmail;
  if (operation !== 'reset' && !password) return 'Enter your password.';
  if (operation === 'register' && password !== confirmation) return 'The passwords do not match.';
  // Firebase/project policy remains authoritative; do not impose another policy.
  return null;
}
