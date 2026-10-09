// Generic navigation lease. The measurement owner supplies live lifecycle safety;
// the application supplies permission to begin new work. Neither owns the other.
export function createDepartureBoundary(isEntryAllowed: () => boolean) {
  let owner: (() => boolean) | null = null;
  let revision = 0;
  const departures = new Set<{ resolve: (safe: boolean) => void; settled: boolean }>();
  const observers = new Set<() => void>();
  const changed = () => {
    if (!owner || owner()) for (const departure of departures) {
      if (!departure.settled) { departure.settled = true; departure.resolve(true); }
    }
    revision++; observers.forEach(observer => observer());
  };
  return {
    canStart: () => departures.size === 0 && isEntryAllowed(),
    isPending: () => departures.size > 0,
    requestDeparture() {
      let resolve!: (safe: boolean) => void;
      const ready = new Promise<boolean>(done => { resolve = done; });
      const departure = { resolve, settled: false };
      departures.add(departure);
      changed();
      return { ready, release() {
        if (departures.delete(departure)) {
          if (!departure.settled) { departure.settled = true; resolve(false); }
          changed();
        }
      } };
    },
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
