import type { EmailTransport } from './email.transport';
import { EtherealEmailTransport } from './ethereal.transport';

export class SmtpTransportManager {
  private static defaultTransport: EmailTransport | null = null;
  private static readonly keyedTransports: Map<string, EmailTransport> = new Map();

  /**
   * Get or create the shared EtherealEmailTransport pool.
   */
  static getDefaultTransport(): EmailTransport {
    if (!this.defaultTransport) {
      this.defaultTransport = new EtherealEmailTransport();
    }
    return this.defaultTransport;
  }

  /**
   * Register or override the default transport (e.g. for dependency injection in tests).
   */
  static setDefaultTransport(transport: EmailTransport | null): void {
    this.defaultTransport = transport;
  }

  /**
   * Get or create a keyed transport instance (supports future sender-scoped credentials).
   */
  static getTransportForKey(key: string, factory: () => EmailTransport): EmailTransport {
    let transport = this.keyedTransports.get(key);
    if (!transport) {
      transport = factory();
      this.keyedTransports.set(key, transport);
    }
    return transport;
  }

  /**
   * Gracefully close all managed SMTP connection pools without leaking sockets.
   */
  static async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    if (this.defaultTransport) {
      closePromises.push(this.defaultTransport.close());
      this.defaultTransport = null;
    }

    for (const [, transport] of this.keyedTransports.entries()) {
      closePromises.push(transport.close());
    }
    this.keyedTransports.clear();

    await Promise.allSettled(closePromises);
  }
}
