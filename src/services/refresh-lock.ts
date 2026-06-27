import {
  randomUUID
} from "node:crypto";

import {
  mkdir,
  open,
  readFile,
  unlink
} from "node:fs/promises";

import {
  dirname
} from "node:path";

const DEFAULT_REFRESH_LOCK_PATH =
  "data/refresh.lock";

const DEFAULT_REFRESH_LOCK_STALE_MS =
  30 * 60 * 1000;

type RefreshLockRecord = {
  schemaVersion: "1.0";
  token: string;
  pid: number;
  createdAt: string;
};

type ParsedLockRecord =
  | RefreshLockRecord
  | "invalid"
  | null;

export type RefreshLock = {
  path: string;
  release: () => Promise<void>;
};

export type RefreshLockOptions = {
  lockPath?: string;
  staleAfterMs?: number;
  now?: () => number;
  processId?: number;
};

export class RefreshAlreadyRunningError
extends Error {
  public readonly code =
    "REFRESH_ALREADY_RUNNING";

  public readonly retryable =
    true;

  public constructor(
    lockPath: string
  ) {
    super(
      `Another snapshot refresh is already running. Lock: ${lockPath}`
    );

    this.name =
      "RefreshAlreadyRunningError";
  }
}

function getFileSystemErrorCode(
  error: unknown
): string | undefined {
  return (
    error as {
      code?: string;
    }
  ).code;
}

function getRefreshLockPath():
string {
  return (
    process.env
      .CLARITY_REFRESH_LOCK_PATH ??
    DEFAULT_REFRESH_LOCK_PATH
  );
}

function getRefreshLockStaleMs():
number {
  const rawValue =
    process.env
      .CLARITY_REFRESH_LOCK_STALE_MS;

  if (!rawValue) {
    return (
      DEFAULT_REFRESH_LOCK_STALE_MS
    );
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return (
      DEFAULT_REFRESH_LOCK_STALE_MS
    );
  }

  return parsedValue;
}

function isRefreshLockRecord(
  value: unknown
): value is RefreshLockRecord {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Partial<RefreshLockRecord>;

  return (
    candidate.schemaVersion === "1.0" &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.pid === "number" &&
    Number.isInteger(
      candidate.pid
    ) &&
    typeof candidate.createdAt ===
      "string"
  );
}

async function readLockRecord(
  lockPath: string
): Promise<ParsedLockRecord> {
  let content: string;

  try {
    content =
      await readFile(
        lockPath,
        "utf8"
      );
  } catch (error) {
    if (
      getFileSystemErrorCode(error) ===
      "ENOENT"
    ) {
      return null;
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(content);
  } catch {
    return "invalid";
  }

  return isRefreshLockRecord(
    parsed
  )
    ? parsed
    : "invalid";
}

function isStaleLock(
  record: RefreshLockRecord,
  now: number,
  staleAfterMs: number
): boolean {
  const createdAt =
    new Date(
      record.createdAt
    ).getTime();

  if (
    !Number.isFinite(createdAt)
  ) {
    return false;
  }

  const age =
    now - createdAt;

  return (
    age > staleAfterMs
  );
}

async function tryCreateLock(
  lockPath: string,
  record: RefreshLockRecord
): Promise<boolean> {
  await mkdir(
    dirname(lockPath),
    {
      recursive: true
    }
  );

  let handle:
    Awaited<
      ReturnType<typeof open>
    >;

  try {
    handle =
      await open(
        lockPath,
        "wx"
      );
  } catch (error) {
    if (
      getFileSystemErrorCode(error) ===
      "EEXIST"
    ) {
      return false;
    }

    throw error;
  }

  try {
    await handle.writeFile(
      JSON.stringify(
        record,
        null,
        2
      ) + "\n",

      "utf8"
    );
  } finally {
    await handle.close();
  }

  return true;
}

async function removeLockFile(
  lockPath: string
): Promise<void> {
  try {
    await unlink(
      lockPath
    );
  } catch (error) {
    if (
      getFileSystemErrorCode(error) ===
      "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

export async function acquireRefreshLock(
  options:
    RefreshLockOptions = {}
): Promise<RefreshLock> {
  const lockPath =
    options.lockPath ??
    getRefreshLockPath();

  const staleAfterMs =
    options.staleAfterMs ??
    getRefreshLockStaleMs();

  const now =
    options.now ??
    (() => Date.now());

  const record:
  RefreshLockRecord = {
    schemaVersion: "1.0",

    token:
      randomUUID(),

    pid:
      options.processId ??
      process.pid,

    createdAt:
      new Date(
        now()
      ).toISOString()
  };

  let acquired =
    await tryCreateLock(
      lockPath,
      record
    );

  if (!acquired) {
    const existingRecord =
      await readLockRecord(
        lockPath
      );

    if (
      existingRecord ===
      null
    ) {
      acquired =
        await tryCreateLock(
          lockPath,
          record
        );
    } else if (
      existingRecord !==
        "invalid" &&
      isStaleLock(
        existingRecord,
        now(),
        staleAfterMs
      )
    ) {
      await removeLockFile(
        lockPath
      );

      acquired =
        await tryCreateLock(
          lockPath,
          record
        );
    }
  }

  if (!acquired) {
    throw new RefreshAlreadyRunningError(
      lockPath
    );
  }

  return {
    path:
      lockPath,

    release:
      async () => {
        const currentRecord =
          await readLockRecord(
            lockPath
          );

        if (
          currentRecord === null ||
          currentRecord ===
            "invalid" ||
          currentRecord.token !==
            record.token
        ) {
          return;
        }

        await removeLockFile(
          lockPath
        );
      }
  };
}
