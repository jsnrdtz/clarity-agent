import {
  createHash,
  timingSafeEqual
} from "node:crypto";

import {
  ClarityError
} from "../errors/clarity-error.js";

import {
  refreshAllAgentSnapshots,
  type AgentRefreshReport
} from "./agent-refresh.js";

import {
  acquireRefreshLock,
  RefreshAlreadyRunningError,
  type RefreshLock
} from "./refresh-lock.js";

const MINIMUM_REFRESH_TOKEN_LENGTH =
  32;

export type AdminRefreshDependencies = {
  acquireLock: (
  ) => Promise<RefreshLock>;

  refreshSnapshots: (
  ) => Promise<AgentRefreshReport>;
};

const defaultDependencies:
AdminRefreshDependencies = {
  acquireLock:
    acquireRefreshLock,

  refreshSnapshots:
    refreshAllAgentSnapshots
};

function hashToken(
  token: string
): Buffer {
  return createHash(
    "sha256"
  )
    .update(
      token,
      "utf8"
    )
    .digest();
}

function tokensMatch(
  providedToken: string,
  configuredToken: string
): boolean {
  return timingSafeEqual(
    hashToken(
      providedToken
    ),

    hashToken(
      configuredToken
    )
  );
}

function getBearerToken(
  authorizationHeader:
    string | undefined
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match =
    authorizationHeader.match(
      /^Bearer[ \t]+(.+)$/i
    );

  const token =
    match?.[1]?.trim();

  return token
    ? token
    : null;
}

export function authenticateAdminRefresh(
  authorizationHeader:
    string | undefined,

  configuredToken:
    string | undefined =
      process.env
        .CLARITY_REFRESH_TOKEN
): void {
  const normalizedConfiguredToken =
    configuredToken?.trim();

  if (
    !normalizedConfiguredToken ||
    normalizedConfiguredToken.length <
      MINIMUM_REFRESH_TOKEN_LENGTH
  ) {
    throw new ClarityError(
      "REFRESH_NOT_CONFIGURED",
      "Administrative snapshot refresh is not configured.",
      503
    );
  }

  const providedToken =
    getBearerToken(
      authorizationHeader
    );

  if (
    !providedToken ||
    !tokensMatch(
      providedToken,
      normalizedConfiguredToken
    )
  ) {
    throw new ClarityError(
      "REFRESH_AUTHENTICATION_FAILED",
      "Valid Bearer authentication is required.",
      401
    );
  }
}

export async function runAdminRefresh(
  dependencyOverrides:
    Partial<AdminRefreshDependencies> = {}
): Promise<AgentRefreshReport> {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides
  };

  let lock:
    RefreshLock;

  try {
    lock =
      await dependencies
        .acquireLock();
  } catch (error) {
    if (
      error instanceof
        RefreshAlreadyRunningError
    ) {
      throw new ClarityError(
        "REFRESH_ALREADY_RUNNING",
        "A snapshot refresh is already running.",
        409,
        {
          retryable: true,
          cause: error
        }
      );
    }

    throw error;
  }

  try {
    return await dependencies
      .refreshSnapshots();
  } finally {
    await lock.release();
  }
}
