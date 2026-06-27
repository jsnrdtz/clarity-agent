type CacheEntry<T> = {
  promise: Promise<T>;
  expiresAt: number | null;
};

export class TtlPromiseCache<T> {
  private readonly entries =
    new Map<string, CacheEntry<T>>();

  public constructor(
    private readonly ttlMs: number
  ) {
    if (
      !Number.isInteger(ttlMs) ||
      ttlMs < 1
    ) {
      throw new Error(
        `Cache TTL must be a positive integer. Received: ${ttlMs}`
      );
    }
  }

  public getOrCreate(
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const now =
      Date.now();

    const existing =
      this.entries.get(key);

    if (existing) {
      const isPending =
        existing.expiresAt === null;

      const isFresh =
        existing.expiresAt !== null &&
        existing.expiresAt > now;

      if (
        isPending ||
        isFresh
      ) {
        return existing.promise;
      }

      this.entries.delete(key);
    }

    const entry: CacheEntry<T> = {
      expiresAt: null,

      promise:
        Promise.resolve().then(
          factory
        )
    };

    this.entries.set(
      key,
      entry
    );

    entry.promise.then(
      () => {
        if (
          this.entries.get(key) ===
          entry
        ) {
          entry.expiresAt =
            Date.now() +
            this.ttlMs;
        }
      },

      () => {
        if (
          this.entries.get(key) ===
          entry
        ) {
          this.entries.delete(key);
        }
      }
    );

    return entry.promise;
  }

  public delete(
    key: string
  ): boolean {
    return this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}
