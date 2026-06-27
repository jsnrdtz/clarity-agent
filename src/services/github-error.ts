import {
  ClarityError,
  isClarityError
} from "../errors/clarity-error.js";

export type GitHubErrorResource =
  | "owner"
  | "repository"
  | "request";

export type GitHubErrorContext = {
  resource:
    GitHubErrorResource;

  owner?: string;
  repository?: string;
};

type UnknownRecord =
  Record<string, unknown>;

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function getStatus(
  error: unknown
): number | null {
  if (!isRecord(error)) {
    return null;
  }

  return typeof error.status ===
    "number"
    ? error.status
    : null;
}

function getMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    isRecord(error) &&
    typeof error.message ===
      "string"
  ) {
    return error.message;
  }

  return "Unknown GitHub API error.";
}

function getResponseHeaders(
  error: unknown
): UnknownRecord | null {
  if (!isRecord(error)) {
    return null;
  }

  const response =
    error.response;

  if (!isRecord(response)) {
    return null;
  }

  const headers =
    response.headers;

  return isRecord(headers)
    ? headers
    : null;
}

function getHeader(
  error: unknown,
  name: string
): string | null {
  const headers =
    getResponseHeaders(error);

  if (!headers) {
    return null;
  }

  const value =
    headers[name] ??
    headers[name.toLowerCase()];

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    typeof value === "number"
  ) {
    return String(value);
  }

  return null;
}

function getResetAt(
  error: unknown
): string | null {
  const rawReset =
    getHeader(
      error,
      "x-ratelimit-reset"
    );

  if (!rawReset) {
    return null;
  }

  const resetSeconds =
    Number(rawReset);

  if (
    !Number.isFinite(
      resetSeconds
    )
  ) {
    return null;
  }

  return new Date(
    resetSeconds * 1000
  ).toISOString();
}

function getResourceLabel(
  context:
    GitHubErrorContext
): string {
  if (
    context.resource ===
      "repository" &&
    context.owner &&
    context.repository
  ) {
    return (
      `${context.owner}/${context.repository}`
    );
  }

  if (
    context.resource ===
      "owner" &&
    context.owner
  ) {
    return context.owner;
  }

  return "GitHub API";
}

function isRateLimitError(
  error: unknown,
  status: number | null,
  message: string
): boolean {
  if (status === 429) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const remaining =
    getHeader(
      error,
      "x-ratelimit-remaining"
    );

  return (
    remaining === "0" ||
    message
      .toLowerCase()
      .includes(
        "rate limit"
      )
  );
}

export function normalizeGitHubError(
  error: unknown,
  context:
    GitHubErrorContext
): ClarityError {
  if (isClarityError(error)) {
    return error;
  }

  const status =
    getStatus(error);

  const message =
    getMessage(error);

  const resourceLabel =
    getResourceLabel(context);

  if (
    isRateLimitError(
      error,
      status,
      message
    )
  ) {
    const resetAt =
      getResetAt(error);

    return new ClarityError(
      "GITHUB_RATE_LIMITED",
      resetAt
        ? `GitHub API rate limit exceeded. Retry after ${resetAt}.`
        : "GitHub API rate limit exceeded.",
      429,
      {
        retryable: true,

        details: {
          resetAt
        },

        cause: error
      }
    );
  }

  if (status === 404) {
    if (
      context.resource ===
      "owner"
    ) {
      return new ClarityError(
        "GITHUB_OWNER_NOT_FOUND",
        `GitHub owner "${resourceLabel}" was not found.`,
        404,
        {
          cause: error
        }
      );
    }

    return new ClarityError(
      "GITHUB_REPOSITORY_NOT_FOUND",
      `GitHub repository "${resourceLabel}" was not found.`,
      404,
      {
        cause: error
      }
    );
  }

  if (status === 401) {
    return new ClarityError(
      "GITHUB_AUTHENTICATION_FAILED",
      "GitHub authentication failed.",
      503,
      {
        cause: error
      }
    );
  }

  if (status === 403) {
    return new ClarityError(
      "GITHUB_ACCESS_DENIED",
      `GitHub denied access to "${resourceLabel}".`,
      502,
      {
        cause: error
      }
    );
  }

  return new ClarityError(
    "GITHUB_UNAVAILABLE",
    `GitHub data is temporarily unavailable for "${resourceLabel}".`,
    503,
    {
      retryable: true,

      details: {
        upstreamStatus:
          status,

        upstreamMessage:
          message
      },

      cause: error
    }
  );
}
