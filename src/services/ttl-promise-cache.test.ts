import assert from "node:assert/strict";
import test from "node:test";

import {
  setTimeout as delay
} from "node:timers/promises";

import {
  TtlPromiseCache
} from "./ttl-promise-cache.js";

test(
  "combines concurrent requests for the same key",
  async () => {
    const cache =
      new TtlPromiseCache<number>(
        1000
      );

    let factoryCalls = 0;

    let release:
      | ((value: number) => void)
      | undefined;

    const first =
      cache.getOrCreate(
        "agent:aeon",
        async () => {
          factoryCalls += 1;

          return new Promise<number>(
            (resolve) => {
              release = resolve;
            }
          );
        }
      );

    const second =
      cache.getOrCreate(
        "agent:aeon",
        async () => {
          factoryCalls += 1;
          return 99;
        }
      );

    assert.strictEqual(
      first,
      second
    );

    await Promise.resolve();

    assert.equal(
      factoryCalls,
      1
    );

    assert.ok(release);

    release(42);

    assert.equal(
      await first,
      42
    );

    assert.equal(
      await second,
      42
    );
  }
);

test(
  "returns cached result before TTL expires",
  async () => {
    const cache =
      new TtlPromiseCache<number>(
        1000
      );

    let factoryCalls = 0;

    const factory =
      async (): Promise<number> => {
        factoryCalls += 1;
        return factoryCalls;
      };

    const first =
      await cache.getOrCreate(
        "agent:aeon",
        factory
      );

    const second =
      await cache.getOrCreate(
        "agent:aeon",
        factory
      );

    assert.equal(first, 1);
    assert.equal(second, 1);

    assert.equal(
      factoryCalls,
      1
    );

    assert.equal(
      cache.size,
      1
    );
  }
);

test(
  "refreshes result after TTL expires",
  async () => {
    const cache =
      new TtlPromiseCache<number>(
        25
      );

    let factoryCalls = 0;

    const factory =
      async (): Promise<number> => {
        factoryCalls += 1;
        return factoryCalls;
      };

    const first =
      await cache.getOrCreate(
        "agent:aeon",
        factory
      );

    await delay(60);

    const second =
      await cache.getOrCreate(
        "agent:aeon",
        factory
      );

    assert.equal(first, 1);
    assert.equal(second, 2);

    assert.equal(
      factoryCalls,
      2
    );
  }
);

test(
  "does not cache rejected promises",
  async () => {
    const cache =
      new TtlPromiseCache<number>(
        1000
      );

    let factoryCalls = 0;

    await assert.rejects(
      cache.getOrCreate(
        "agent:aeon",
        async () => {
          factoryCalls += 1;

          throw new Error(
            "Temporary GitHub failure"
          );
        }
      ),

      /Temporary GitHub failure/
    );

    await Promise.resolve();

    const recovered =
      await cache.getOrCreate(
        "agent:aeon",
        async () => {
          factoryCalls += 1;
          return 42;
        }
      );

    assert.equal(
      recovered,
      42
    );

    assert.equal(
      factoryCalls,
      2
    );
  }
);

test(
  "clear removes all cached entries",
  async () => {
    const cache =
      new TtlPromiseCache<number>(
        1000
      );

    await cache.getOrCreate(
      "agent:aeon",
      async () => 1
    );

    await cache.getOrCreate(
      "agent:prxvt",
      async () => 2
    );

    assert.equal(
      cache.size,
      2
    );

    cache.clear();

    assert.equal(
      cache.size,
      0
    );
  }
);
