import { authErrorMessage, resetConfirmation, validateAuthForm } from './auth-errors';
import type { AuthAdapter, AuthOperation, AuthState, OperationResult, PublicUser } from './auth-types';
import type { DepartureBoundary } from '../navigation/departure-boundary';

export function createAuthController(adapter: AuthAdapter, now = Date.now) {
  let state: AuthState = { session: { status: 'RESTORING', user: null }, busy: null };
  let unsubscribe: (() => void) | null = null;
  let active = false;
  let generation = 0;
  let lastVerification: { uid: string; at: number } | null = null;
  let endDeparture: (() => void) | null = null;
  let endSignOutWait: (() => void) | null = null;
  const observers = new Set<() => void>();
  const getSnapshot = (): AuthState => state;
  const publish = (next: AuthState) => { state = next; observers.forEach(observer => observer()); };
  const resolve = (user: PublicUser | null) => publish({ ...state,
    signOutMessage: user?.uid === state.session.user?.uid ? state.signOutMessage : undefined, session: user
    ? { status: 'SIGNED_IN', user } : { status: 'SIGNED_OUT', user: null } });
  function stop() {
    active = false;
    generation++;
    endDeparture?.();
    endSignOutWait?.();
    const cleanup = unsubscribe;
    unsubscribe = null;
    cleanup?.();
  }
  function start() {
    if (active) return;
    active = true;
    const current = ++generation;
    publish({ session: { status: 'RESTORING', user: null }, busy: null });
    try {
      unsubscribe = adapter.subscribe(user => {
        if (active && current === generation) resolve(user);
      }, () => {
        if (active && current === generation) publish({ ...state, session: { status: 'ERROR', user: null } });
      });
    } catch {
      publish({ session: { status: 'ERROR', user: null }, busy: null });
    }
  }
  async function run(operation: Exclude<AuthOperation, 'signout'>, email = '', password = '', confirmation = ''): Promise<OperationResult> {
    if (!active || state.session.status === 'RESTORING' || state.session.status === 'ERROR') {
      return { ok: false, message: 'Account access is not ready. Please try again.' };
    }
    if (state.busy) return { ok: false, message: 'An account operation is already in progress.' };
    if (operation === 'register' || operation === 'login' || operation === 'reset') {
      const invalid = validateAuthForm(operation, email, password, confirmation);
      if (invalid) return { ok: false, message: invalid };
    }
    const user = state.session.user;
    if ((operation === 'register' || operation === 'login') && user) return { ok: false, message: 'An account is already signed in.' };
    if ((operation === 'resend' || operation === 'refresh') && !user) return { ok: false, message: 'Sign in to manage email verification.' };
    if (operation === 'resend' && lastVerification && lastVerification.uid === user?.uid && now() - lastVerification.at < 60000) {
      return { ok: false, message: 'Please wait a minute before requesting another verification email.' };
    }
    const current = generation;
    publish({ ...state, busy: operation });
    let result: OperationResult;
    try {
      if (operation === 'register') {
        const uid = await adapter.register(email.trim(), password);
        // Successful credentials do not establish React session state. Only the
        // native listener can do that. Verification failure preserves the account.
        if (!active || current !== generation) return { ok: false, message: 'Account operation ended.' };
        lastVerification = { uid, at: now() };
        try { await adapter.verify(uid); result = { ok: true, message: 'Account created. A verification email was requested.' }; }
        catch { result = { ok: true, message: 'Account created. Verification email could not be sent; you can retry from email verification.' }; }
      } else if (operation === 'login') {
        await adapter.login(email.trim(), password);
        result = { ok: true, message: 'Sign-in completed. Waiting for your authenticated session.' };
      } else if (operation === 'reset') {
        await adapter.reset(email.trim());
        result = { ok: true, message: resetConfirmation };
      } else if (operation === 'resend') {
        lastVerification = { uid: user!.uid, at: now() };
        await adapter.verify(user!.uid);
        result = { ok: true, message: 'A verification email was requested. Check your inbox.' };
      } else {
        const refreshed = await adapter.refresh();
        if (active && current === generation && refreshed && state.session.user?.uid === user!.uid && refreshed.uid === user!.uid) {
          resolve(refreshed);
        }
        result = refreshed?.uid === user!.uid && state.session.user?.uid === user!.uid
          ? { ok: true, message: refreshed.emailVerified ? 'Your email is verified.' : 'Your email is not yet verified. Check the email link, then try again.' }
          : { ok: false, message: 'The account changed. Please reopen email verification.' };
      }
    } catch (error) {
      const message = authErrorMessage(error, operation);
      result = { ok: operation === 'reset' && message === resetConfirmation, message };
    } finally {
      if (active && current === generation) publish({ ...state, busy: null });
    }
    return active && current === generation ? result : { ok: false, message: 'Account operation ended.' };
  }
  async function requestSignOut(boundary: DepartureBoundary): Promise<OperationResult> {
    if (!active || state.session.status !== 'SIGNED_IN' || state.busy) {
      return { ok: false, message: 'Account access is busy or no account is signed in.' };
    }
    const current = generation;
    const uid = state.session.user.uid;
    publish({ ...state, busy: 'signout', signOutMessage: undefined });
    const departure = boundary.requestDeparture();
    endDeparture = departure.release;
    try {
      if (!await departure.ready || !active || current !== generation || state.session.user?.uid !== uid) {
        return { ok: false, message: 'The account operation ended.' };
      }
      await adapter.signOut();
      // Command completion does not establish signed-out truth. Keep the latch
      // and new-work block until the existing native listener changes identity.
      if (active && current === generation && state.session.user?.uid === uid) {
        await new Promise<void>(done => {
          const changed = () => {
            if (!active || current !== generation || state.session.user?.uid !== uid) {
              observers.delete(changed); endSignOutWait = null; done();
            }
          };
          endSignOutWait = () => { observers.delete(changed); done(); };
          observers.add(changed);
          changed();
        });
      }
      return { ok: active && current === generation && getSnapshot().session.status === 'SIGNED_OUT', message: 'Account session changed.' };
    } catch {
      const message = 'Unable to sign out. Please try again.';
      if (active && current === generation && state.session.user?.uid === uid) publish({ ...state, signOutMessage: message });
      return { ok: false, message };
    } finally {
      departure.release();
      if (endDeparture === departure.release) endDeparture = null;
      if (active && current === generation) publish({ ...state, busy: null });
    }
  }
  return { getSnapshot, subscribe: (observer: () => void) => {
    observers.add(observer); return () => { observers.delete(observer); };
  }, start, stop, retry: () => { stop(); start(); }, run, requestSignOut };
}
