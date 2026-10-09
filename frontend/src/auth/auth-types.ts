export type PublicUser = Readonly<{
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerIds: readonly string[];
}>;
export type Session =
  | { status: 'RESTORING' | 'SIGNED_OUT' | 'ERROR'; user: null }
  | { status: 'SIGNED_IN'; user: PublicUser };
export type AuthOperation = 'register' | 'login' | 'reset' | 'resend' | 'refresh' | 'signout';
export type OperationResult = { ok: boolean; message: string };
export interface AuthAdapter {
  subscribe(next: (user: PublicUser | null) => void, error: () => void): () => void;
  register(email: string, password: string): Promise<string>;
  login(email: string, password: string): Promise<void>;
  reset(email: string): Promise<void>;
  verify(expectedUid?: string): Promise<void>;
  refresh(): Promise<PublicUser | null>;
  signOut(): Promise<void>;
}
export type AuthState = { session: Session; busy: AuthOperation | null; signOutMessage?: string };
