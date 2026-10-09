import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DepartureBoundary } from './departure-boundary';

export const NavigationSettlementContext = createContext<DepartureBoundary | null>(null);
export function useNavigationSettlement() {
  const boundary = useContext(NavigationSettlementContext);
  if (!boundary) throw new Error('Navigation settlement is unavailable.');
  useSyncExternalStore(boundary.subscribe, boundary.getSnapshot, boundary.getSnapshot);
  return boundary;
}
