// @ts-ignore - Export conflicts// Provider registry for payment providers
import { PaymentProvider, PaymentProviderName } from '../../types/providers.types';

export interface ProviderHealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
}

export class ProviderRegistry {
  private providers: Map<PaymentProviderName, PaymentProvider> = new Map();
  private healthStatus: Map<PaymentProviderName, ProviderHealthStatus> = new Map();

  registerProvider(name: PaymentProviderName, provider: PaymentProvider): void {
    this.providers.set(name, provider);
    this.healthStatus.set(name, {
      isHealthy: true,
      lastCheck: new Date(),
      responseTime: 0,
    });
  }

  getProvider(name: PaymentProviderName): PaymentProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }

  getHealthyProviders(): PaymentProvider[] {
    const healthyProviders: PaymentProvider[] = [];
    for (const [name, provider] of this.providers) {
      const health = this.healthStatus.get(name);
      if (health?.isHealthy) {
        healthyProviders.push(provider);
      }
    }
    return healthyProviders;
  }

  updateProviderHealth(name: PaymentProviderName, health: ProviderHealthStatus): void {
    this.healthStatus.set(name, health);
  }
}

export const providerRegistry = new ProviderRegistry();