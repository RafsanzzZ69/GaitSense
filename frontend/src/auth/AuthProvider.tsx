import { createContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { authAdapter } from './firebase-auth-adapter';
import { createAuthController } from './auth-controller';
import type { AuthAdapter, AuthState } from './auth-types';

type Controller = ReturnType<typeof createAuthController>;
export const AuthContext = createContext<(AuthState & Pick<Controller, 'run' | 'retry'>) | null>(null);
export function AuthProvider({ children, adapter = authAdapter }: PropsWithChildren<{ adapter?: AuthAdapter }>) {
  const [controller] = useState(() => createAuthController(adapter));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); return controller.stop; }, [controller]);
  return <AuthContext.Provider value={{ ...state, run: controller.run, retry: controller.retry }}>{children}</AuthContext.Provider>;
}
