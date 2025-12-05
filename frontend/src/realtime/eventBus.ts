// frontend/src/realtime/eventBus.ts

type Handler<T = any> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Handler[]>();

  on(event: string, handler: Handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: Handler) {
    const list = this.listeners.get(event);
    if (!list) return;

    this.listeners.set(
      event,
      list.filter((h) => h !== handler)
    );
  }

  emit(event: string, payload: any) {
    const list = this.listeners.get(event);
    if (!list) return;
    list.forEach((handler) => handler(payload));
  }
}

export const socketBus = new EventBus();
