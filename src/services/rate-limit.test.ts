import assert from "node:assert/strict";
import test from "node:test";

import {
  createRateLimiter,
  type RateLimitStore
} from "./rate-limit.js";

const POLICY = {
  limit: 2,
  windowMs: 10_000
};

test(
  "allows requests within the fixed window",
  () => {
    const now =
      1_750_000_000_000;

    const limiter =
      createRateLimiter(
        {
          now:
            () => now
        }
      );

    const first =
      limiter.consume(
        "evaluate:client-one",
        POLICY
      );

    const second =
      limiter.consume(
        "evaluate:client-one",
        POLICY
      );

    assert.deepEqual(
      first,
      {
        allowed: true,
        limit: 2,
        remaining: 1,

        resetAt:
          now + 10_000,

        retryAfterSeconds:
          0
      }
    );

    assert.deepEqual(
      second,
      {
        allowed: true,
        limit: 2,
        remaining: 0,

        resetAt:
          now + 10_000,

        retryAfterSeconds:
          0
      }
    );
  }
);

test(
  "blocks requests after the limit is reached",
  () => {
    const now =
      1_750_000_000_000;

    const limiter =
      createRateLimiter(
        {
          now:
            () => now
        }
      );

    limiter.consume(
      "ranking:client-one",
      POLICY
    );

    limiter.consume(
      "ranking:client-one",
      POLICY
    );

    const blocked =
      limiter.consume(
        "ranking:client-one",
        POLICY
      );

    assert.deepEqual(
      blocked,
      {
        allowed: false,
        limit: 2,
        remaining: 0,

        resetAt:
          now + 10_000,

        retryAfterSeconds:
          10
      }
    );
  }
);

test(
  "rounds retry-after up to the next second",
  () => {
    let now =
      1_750_000_000_000;

    const limiter =
      createRateLimiter(
        {
          now:
            () => now
        }
      );

    limiter.consume(
      "evaluate:client-one",
      {
        limit: 1,
        windowMs: 10_000
      }
    );

    now +=
      9_001;

    const blocked =
      limiter.consume(
        "evaluate:client-one",
        {
          limit: 1,
          windowMs: 10_000
        }
      );

    assert.equal(
      blocked.allowed,
      false
    );

    assert.equal(
      blocked.retryAfterSeconds,
      1
    );
  }
);

test(
  "starts a new window after reset",
  () => {
    let now =
      1_750_000_000_000;

    const limiter =
      createRateLimiter(
        {
          now:
            () => now
        }
      );

    limiter.consume(
      "compare:client-one",
      {
        limit: 1,
        windowMs: 5_000
      }
    );

    now +=
      5_000;

    const nextWindow =
      limiter.consume(
        "compare:client-one",
        {
          limit: 1,
          windowMs: 5_000
        }
      );

    assert.equal(
      nextWindow.allowed,
      true
    );

    assert.equal(
      nextWindow.remaining,
      0
    );

    assert.equal(
      nextWindow.resetAt,
      now + 5_000
    );
  }
);

test(
  "isolates independent rate limit keys",
  () => {
    const limiter =
      createRateLimiter(
        {
          now:
            () =>
              1_750_000_000_000
        }
      );

    limiter.consume(
      "evaluate:client-one",
      {
        limit: 1,
        windowMs: 10_000
      }
    );

    const firstClientBlocked =
      limiter.consume(
        "evaluate:client-one",
        {
          limit: 1,
          windowMs: 10_000
        }
      );

    const secondClientAllowed =
      limiter.consume(
        "evaluate:client-two",
        {
          limit: 1,
          windowMs: 10_000
        }
      );

    assert.equal(
      firstClientBlocked.allowed,
      false
    );

    assert.equal(
      secondClientAllowed.allowed,
      true
    );
  }
);

test(
  "removes expired entries automatically",
  () => {
    let now =
      1_750_000_000_000;

    const store:
    RateLimitStore =
      new Map();

    const limiter =
      createRateLimiter(
        {
          now:
            () => now,

          store
        }
      );

    limiter.consume(
      "evaluate:expired-client",
      {
        limit: 1,
        windowMs: 100
      }
    );

    assert.equal(
      limiter.size(),
      1
    );

    now +=
      101;

    limiter.consume(
      "evaluate:active-client",
      {
        limit: 1,
        windowMs: 100
      }
    );

    assert.equal(
      store.has(
        "evaluate:expired-client"
      ),
      false
    );

    assert.equal(
      store.has(
        "evaluate:active-client"
      ),
      true
    );

    assert.equal(
      limiter.size(),
      1
    );
  }
);

test(
  "clears all tracked rate limit entries",
  () => {
    const limiter =
      createRateLimiter();

    limiter.consume(
      "evaluate:client-one",
      POLICY
    );

    limiter.consume(
      "ranking:client-two",
      POLICY
    );

    assert.equal(
      limiter.size(),
      2
    );

    limiter.clear();

    assert.equal(
      limiter.size(),
      0
    );
  }
);

test(
  "rejects invalid keys and policies",
  () => {
    const limiter =
      createRateLimiter();

    assert.throws(
      () => {
        limiter.consume(
          "   ",
          POLICY
        );
      },

      /must not be empty/
    );

    assert.throws(
      () => {
        limiter.consume(
          "evaluate:client",
          {
            limit: 0,
            windowMs: 10_000
          }
        );
      },

      /positive integer/
    );

    assert.throws(
      () => {
        limiter.consume(
          "evaluate:client",
          {
            limit: 10,
            windowMs: -1
          }
        );
      },

      /positive integer/
    );
  }
);
