import type { AuthAdapter } from './auth-types';
// The existing web showcase is independent. Never initialize native Firebase or
// pretend to authenticate unsupported platforms through a demo fallback.
const unavailable = async (): Promise<never> => { throw new Error('Native Android authentication required'); };
export const authAdapter: AuthAdapter = {
  subscribe: () => { throw new Error('Native Android authentication required'); },
  register: unavailable, login: unavailable, reset: unavailable,
  verify: unavailable, refresh: unavailable, signOut: unavailable,
};
