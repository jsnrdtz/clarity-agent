export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitStore =
  Map<string, RateLimitEntry>;

export type RateLimiterOptions = {
  now?: () => number;
  store?: RateLimitStore;
};

export type RateLimiter = {
  consume: (
    key: string,
    policy: RateLimitPolicy
  ) => RateLimitDecision;

  clear: () => void;
  size: () => number;
};

function validatePolicy(
  policy: RateLimitPolicy
): void {
  if (
    !Number.isSafeInteger(
      policy.limit
    ) ||
    policy.limit <= 0
  ) {
    throw new Error(
      "Rate limit must be a positive integer."
    );
  }

  if (
    !Number.isSafeInteger(
      policy.windowMs
    ) ||
    policy.windowMs <= 0
  ) {
    throw new Error(
      "Rate limit window must be a positive integer."
    );
  }
}

function cleanupExpiredEntries(
  store: RateLimitStore,
  now: number
): void {
  for (
    const [
      key,
      entry
    ]
    of store
  ) {
    if (
      entry.resetAt <= now
    ) {
      store.delete(key);
    }
  }
}

function getRetryAfterSeconds(
  resetAt: number,
  now: number
): number {
  return Math.max(
    1,
    Math.ceil(
      (
        resetAt -
        now
      ) /
      1000
    )
  );
}

export function createRateLimiter(
  options:
    RateLimiterOptions = {}
): RateLimiter {
  const store =
    options.store ??
    new Map<
      string,
      RateLimitEntry
    >();

  const now =
    options.now ??
    (() => Date.now());

  return {
    consume:
      (
        key,
        policy
      ) => {
        const normalizedKey =
          key.trim();

        if (!normalizedKey) {
          throw new Error(
            "Rate limit key must not be empty."
          );
        }

        validatePolicy(
          policy
        );

        const currentTime =
          now();

        cleanupExpiredEntries(
          store,
          currentTime
        );

        const existing =
          store.get(
            normalizedKey
          );

        if (!existing) {
          const resetAt =
            currentTime +
            policy.windowMs;

          store.set(
            normalizedKey,
            {
              count: 1,
              resetAt
            }
          );

          return {
            allowed: true,

            limit:
              policy.limit,

            remaining:
              Math.max(
                0,
                policy.limit - 1
              ),

            resetAt,

            retryAfterSeconds:
              0
          };
        }

        if (
          existing.count >=
          policy.limit
        ) {
          return {
            allowed: false,

            limit:
              policy.limit,

            remaining:
              0,

            resetAt:
              existing.resetAt,

            retryAfterSeconds:
              getRetryAfterSeconds(
                existing.resetAt,
                currentTime
              )
          };
        }

        const nextCount =
          existing.count +
          1;

        store.set(
          normalizedKey,
          {
            count:
              nextCount,

            resetAt:
              existing.resetAt
          }
        );

        return {
          allowed: true,

          limit:
            policy.limit,

          remaining:
            Math.max(
              0,
              policy.limit -
              nextCount
            ),

          resetAt:
            existing.resetAt,

          retryAfterSeconds:
            0
        };
      },

    clear:
      () => {
        store.clear();
      },

    size:
      () =>
        store.size
  };
}
