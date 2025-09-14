// Payment events for event-driven architecture
export interface PaymentEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, any>;
}

export class PaymentEventEmitter {
  private listeners: Map<string, Array<(event: PaymentEvent) => void>> = new Map();

  on(eventType: string, callback: (event: PaymentEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)?.push(callback);
  }

  emit(eventType: string, data: Record<string, any>): void {
    const event: PaymentEvent = {
      id: `evt_${Date.now()}`,
      type: eventType,
      timestamp: new Date(),
      data,
    };

    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(callback => callback(event));
  }

  off(eventType: string, callback: (event: PaymentEvent) => void): void {
    const callbacks = this.listeners.get(eventType) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

export const paymentEventEmitter = new PaymentEventEmitter();