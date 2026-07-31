type Origin = { x: number; y: number };
type Listener = (origin: Origin) => void;

let listeners: Listener[] = [];

// Fire-and-forget event bus: the overlay UI is mounted once at the app root
// (survives navigation), while any screen can trigger it without threading
// state through the navigator.
export function triggerSaleSuccessOverlay(origin: Origin) {
  listeners.forEach((listener) => listener(origin));
}

export function subscribeSaleSuccessOverlay(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
