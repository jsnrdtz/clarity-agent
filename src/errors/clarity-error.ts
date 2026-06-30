export type ClarityErrorCode =
  | "AGENT_NOT_FOUND"
  | "INVALID_COMPARISON"
  | "INVALID_SEARCH_QUERY"
  | "REFRESH_AUTHENTICATION_FAILED"
  | "REFRESH_NOT_CONFIGURED"
  | "REFRESH_ALREADY_RUNNING"
  | "CANDIDATE_UPLOAD_NOT_CONFIGURED"
  | "CANDIDATE_UPLOAD_AUTHENTICATION_FAILED"
  | "CANDIDATE_REPORT_INVALID"
  | "CANDIDATE_REPORT_TOO_LARGE"
  | "CANDIDATE_REPORT_NOT_FOUND"
  | "CANDIDATE_REVIEW_NOT_CONFIGURED"
  | "CANDIDATE_REVIEW_AUTHENTICATION_FAILED"
  | "CANDIDATE_REVIEW_INVALID"
  | "CANDIDATE_REVIEW_STATE_INVALID"
  | "CANDIDATE_REVIEW_TARGET_NOT_FOUND"
  | "RATE_LIMIT_EXCEEDED"
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

export function toClarityError(
  error: unknown
): ClarityError {
  if (isClarityError(error)) {
    return error;
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
