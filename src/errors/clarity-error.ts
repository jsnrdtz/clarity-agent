export type ClarityErrorCode =
  | "AGENT_NOT_FOUND"
  | "INVALID_COMPARISON"
  | "GITHUB_OWNER_NOT_FOUND"
  | "GITHUB_REPOSITORY_NOT_FOUND"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_AUTHENTICATION_FAILED"
  | "GITHUB_ACCESS_DENIED"
  | "GITHUB_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

export type ClarityErrorOptions = {
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export class ClarityError
extends Error {
  public readonly code:
    ClarityErrorCode;

  public readonly statusCode:
    number;

  public readonly retryable:
    boolean;

  public readonly details:
    Record<string, unknown> | null;

  public constructor(
    code: ClarityErrorCode,
    message: string,
    statusCode: number,
    options:
      ClarityErrorOptions = {}
  ) {
    super(message);

    this.name =
      "ClarityError";

    this.code =
      code;

    this.statusCode =
      statusCode;

    this.retryable =
      options.retryable ??
      false;

    this.details =
      options.details ??
      null;

    if (
      options.cause !==
      undefined
    ) {
      (
        this as Error & {
          cause?: unknown;
        }
      ).cause =
        options.cause;
    }
  }
}

export function isClarityError(
  error: unknown
): error is ClarityError {
  return (
    error instanceof
    ClarityError
  );
}

function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Unknown error.";
}

export function toClarityError(
  error: unknown
): ClarityError {
  if (isClarityError(error)) {
    return error;
  }

  const message =
    getErrorMessage(error);

  if (
    message.includes(
      "is not registered"
    )
  ) {
    return new ClarityError(
      "AGENT_NOT_FOUND",
      message,
      404,
      {
        cause: error
      }
    );
  }

  if (
    message.includes(
      "two different agents"
    )
  ) {
    return new ClarityError(
      "INVALID_COMPARISON",
      message,
      400,
      {
        cause: error
      }
    );
  }

  return new ClarityError(
    "INTERNAL_SERVER_ERROR",
    "An unexpected internal error occurred.",
    500,
    {
      cause: error
    }
  );
}
