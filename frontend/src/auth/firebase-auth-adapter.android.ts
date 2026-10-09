import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, reload,
  type User,
} from '@react-native-firebase/auth';
import type { AuthAdapter, PublicUser } from './auth-types';

export function publicUser(user: User): PublicUser {
  return Object.freeze({ uid: user.uid, email: user.email, displayName: user.displayName,
    photoURL: user.photoURL, emailVerified: user.emailVerified,
    providerIds: Object.freeze(user.providerData.map(provider => provider.providerId)) });
}
// Resolve native Firebase lazily so initialization failure can be represented by
// the provider, without throwing while importing a route or blocking local gait.
export const authAdapter: AuthAdapter = {
  subscribe: (next, error) => onAuthStateChanged(getAuth(), user => next(user ? publicUser(user) : null), error),
  register: async (email, password) => (await createUserWithEmailAndPassword(getAuth(), email, password)).user.uid,
  login: async (email, password) => { await signInWithEmailAndPassword(getAuth(), email, password); },
  reset: email => sendPasswordResetEmail(getAuth(), email),
  verify: async expectedUid => {
    const user = getAuth().currentUser;
    if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Identity changed');
    await sendEmailVerification(user);
  },
  refresh: async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await reload(user);
    return auth.currentUser?.uid === user.uid ? publicUser(auth.currentUser) : null;
  },
};
