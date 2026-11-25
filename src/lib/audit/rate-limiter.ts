/**
 * In-memory domain rate limiter.
 * Ensures strict serialization: only one active audit request per domain at a time.
 */
class DomainRateLimiter {
  private domainLocks: Map<string, Promise<void>> = new Map();

  async acquire(url: string): Promise<() => void> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      hostname = url.toLowerCase();
    }

    while (this.domainLocks.has(hostname)) {
      await this.domainLocks.get(hostname);
    }

    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.domainLocks.set(hostname, lockPromise);

    return () => {
      this.domainLocks.delete(hostname);
      releaseLock();
    };
  }
}

export const domainRateLimiter = new DomainRateLimiter();
