import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Sends a password reset email.
 * Anti-enumeration: swallows auth/user-not-found so callers always receive
 * a uniform success signal regardless of whether the address is registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase no está inicializado.');

  const actionCodeSettings = {
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  };

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes('auth/user-not-found') ||
        error.message.includes('INVALID_EMAIL') === false)
    ) {
      // Swallow silently — anti-enumeration: caller shows success regardless
      if (!error.message.includes('auth/invalid-email')) return;
    }
    throw error;
  }
}

/**
 * Verifies a password reset oobCode and returns the associated email address.
 * Throws with Firebase error codes (auth/expired-action-code, auth/invalid-action-code)
 * so callers can show specific messages.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  if (!auth) throw new Error('Firebase no está inicializado.');
  return verifyPasswordResetCode(auth, oobCode);
}

/**
 * Applies a new password using the oobCode from the reset email link.
 * Should only be called after verifyResetCode succeeds.
 */
export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  if (!auth) throw new Error('Firebase no está inicializado.');
  await confirmPasswordReset(auth, oobCode, newPassword);
}
