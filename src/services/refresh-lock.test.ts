import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";
import test from "node:test";

import {
  acquireRefreshLock,
  RefreshAlreadyRunningError
} from "./refresh-lock.js";

async function createTestLockPath():
Promise<{
  directory: string;
  lockPath: string;
}> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        "clarity-refresh-lock-"
      )
    );

  return {
    directory,

    lockPath:
      join(
        directory,
        "refresh.lock"
      )
  };
}

test(
  "prevents two refresh processes from holding the lock",
  async (
    context
  ) => {
    const {
      directory,
      lockPath
    } =
      await createTestLockPath();

    context.after(
      async () => {
        await rm(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const firstLock =
      await acquireRefreshLock(
        {
          lockPath,

          now:
            () =>
              1_750_000_000_000,

          processId:
            100
        }
      );

    await assert.rejects(
      acquireRefreshLock(
        {
          lockPath,

          now:
            () =>
              1_750_000_001_000,

          processId:
            200
        }
      ),

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            RefreshAlreadyRunningError
        );

        assert.equal(
          error.code,
          "REFRESH_ALREADY_RUNNING"
        );

        assert.equal(
          error.retryable,
          true
        );

        return true;
      }
    );

    await firstLock.release();

    const secondLock =
      await acquireRefreshLock(
        {
          lockPath,

          now:
            () =>
              1_750_000_002_000,

          processId:
            200
        }
      );

    await secondLock.release();
  }
);

test(
  "replaces a stale refresh lock",
  async (
    context
  ) => {
    const {
      directory,
      lockPath
    } =
      await createTestLockPath();

    context.after(
      async () => {
        await rm(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const now =
      1_750_000_000_000;

    await writeFile(
      lockPath,

      JSON.stringify(
        {
          schemaVersion: "1.0",
          token: "old-token",
          pid: 100,

          createdAt:
            new Date(
              now - 10_000
            ).toISOString()
        },
        null,
        2
      ) + "\n",

      "utf8"
    );

    const lock =
      await acquireRefreshLock(
        {
          lockPath,
          staleAfterMs: 5_000,
          now: () => now,
          processId: 200
        }
      );

    const content =
      await readFile(
        lockPath,
        "utf8"
      );

    assert.doesNotMatch(
      content,
      /old-token/
    );

    await lock.release();

    await assert.rejects(
      readFile(
        lockPath,
        "utf8"
      ),

      (
        error: unknown
      ): boolean =>
        (
          error as {
            code?: string;
          }
        ).code === "ENOENT"
    );
  }
);

test(
  "does not remove a lock owned by another process",
  async (
    context
  ) => {
    const {
      directory,
      lockPath
    } =
      await createTestLockPath();

    context.after(
      async () => {
        await rm(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const lock =
      await acquireRefreshLock(
        {
          lockPath,

          now:
            () =>
              1_750_000_000_000,

          processId:
            100
        }
      );

    await writeFile(
      lockPath,

      JSON.stringify(
        {
          schemaVersion: "1.0",
          token:
            "replacement-token",

          pid:
            200,

          createdAt:
            "2026-06-27T08:00:00.000Z"
        },
        null,
        2
      ) + "\n",

      "utf8"
    );

    await lock.release();

    const remaining =
      JSON.parse(
        await readFile(
          lockPath,
          "utf8"
        )
      ) as {
        token: string;
      };

    assert.equal(
      remaining.token,
      "replacement-token"
    );
  }
);
