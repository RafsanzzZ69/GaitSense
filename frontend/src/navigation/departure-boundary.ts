// Generic navigation lease. The measurement owner supplies live lifecycle safety;
// the application supplies permission to begin new work. Neither owns the other.
export function createDepartureBoundary(isEntryAllowed: () => boolean) {
  let owner: (() => boolean) | null = null;
  let revision = 0;
  const observers = new Set<() => void>();
  const changed = () => { revision++; observers.forEach(observer => observer()); };
  return {
    canStart: isEntryAllowed,
    mustRetain: () => owner !== null && !owner(),
    changed,
    register(canLeave: () => boolean) {
      if (owner) throw new Error('A measurement workspace already owns navigation settlement.');
      owner = canLeave;
      changed();
      return () => { if (owner === canLeave) { owner = null; changed(); } };
    },
    getSnapshot: () => revision,
    subscribe(observer: () => void) {
      observers.add(observer);
      return () => { observers.delete(observer); };
    },
  };
}
export type DepartureBoundary = ReturnType<typeof createDepartureBoundary>;
