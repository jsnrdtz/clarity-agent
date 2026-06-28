import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  ClarityError
} from "../errors/clarity-error.js";

import type {
  RateLimiter,
  RateLimitPolicy
} from "../services/rate-limit.js";

export type ApiRateLimitScope =
  | "evaluate"
  | "compare"
  | "ranking";

export type ApiRateLimitPolicies =
  Record<
    ApiRateLimitScope,
    RateLimitPolicy
  >;

export const
DEFAULT_API_RATE_LIMIT_POLICIES:
ApiRateLimitPolicies = {
  evaluate: {
    limit: 10,
    windowMs: 10 * 60 * 1000
  },

  compare: {
    limit: 30,
    windowMs: 10 * 60 * 1000
  },

  ranking: {
    limit: 60,
    windowMs: 10 * 60 * 1000
  }
};

export type ApplyRequestRateLimitOptions = {
  request: IncomingMessage;
  response: ServerResponse;
  pathname: string;
  limiter: RateLimiter;
  policies: ApiRateLimitPolicies;
  trustProxy: boolean;
};

function getRateLimitScope(
  pathname: string
): ApiRateLimitScope | null {
  if (
    pathname ===
    "/api/v1/ranking"
  ) {
    return "ranking";
  }

  if (
    /^\/api\/v1\/compare\/[^/]+\/[^/]+$/.test(
      pathname
    )
  ) {
    return "compare";
  }

  if (
    /^\/api\/v1\/evaluate\/[^/]+$/.test(
      pathname
    )
  ) {
    return "evaluate";
  }

  return null;
}

function getHeaderValue(
  headers: IncomingHttpHeaders,
  name: string
): string | undefined {
  const value =
    headers[name];

  if (
    Array.isArray(value)
  ) {
    return value[0];
  }

  return value;
}

function normalizeClientAddress(
  value: string | undefined
): string | null {
  const normalized =
    value
      ?.trim()
      .slice(
        0,
        128
      );

  return normalized
    ? normalized
    : null;
}

function getForwardedClientAddress(
  request: IncomingMessage
): string | null {
  const forwardedFor =
    getHeaderValue(
      request.headers,
      "x-forwarded-for"
    );

  const firstForwardedAddress =
    forwardedFor
      ?.split(",")
      .map(
        (value) =>
          value.trim()
      )
      .find(
        Boolean
      );

  const normalizedForwardedAddress =
    normalizeClientAddress(
      firstForwardedAddress
    );

  if (
    normalizedForwardedAddress
  ) {
    return normalizedForwardedAddress;
  }

  return normalizeClientAddress(
    getHeaderValue(
      request.headers,
      "x-real-ip"
    )
  );
}

function getClientAddress(
  request: IncomingMessage,
  trustProxy: boolean
): string {
  if (trustProxy) {
    const forwardedAddress =
      getForwardedClientAddress(
        request
      );

    if (forwardedAddress) {
      return forwardedAddress;
    }
  }

  return (
    normalizeClientAddress(
      request.socket
        .remoteAddress
    ) ??
    "unknown"
  );
}

function setRateLimitHeaders(
  response: ServerResponse,
  limit: number,
  remaining: number,
  resetAt: number
): void {
  response.setHeader(
    "X-RateLimit-Limit",
    String(limit)
  );

  response.setHeader(
    "X-RateLimit-Remaining",
    String(remaining)
  );

  response.setHeader(
    "X-RateLimit-Reset",
    String(
      Math.ceil(
        resetAt /
        1000
      )
    )
  );
}

export function applyRequestRateLimit(
  options:
    ApplyRequestRateLimitOptions
): void {
  const scope =
    getRateLimitScope(
      options.pathname
    );

  if (!scope) {
    return;
  }

  const clientAddress =
    getClientAddress(
      options.request,
      options.trustProxy
    );

  const decision =
    options.limiter.consume(
      `${scope}:${clientAddress}`,
      options.policies[
        scope
      ]
    );

  setRateLimitHeaders(
    options.response,
    decision.limit,
    decision.remaining,
    decision.resetAt
  );

  if (decision.allowed) {
    return;
  }

  options.response.setHeader(
    "Retry-After",
    String(
      decision
        .retryAfterSeconds
    )
  );

  throw new ClarityError(
    "RATE_LIMIT_EXCEEDED",
    "Too many requests for this API route.",
    429,
    {
      retryable: true,

      details: {
        scope,

        limit:
          decision.limit,

        remaining:
          decision.remaining,

        resetAt:
          new Date(
            decision.resetAt
          ).toISOString(),

        retryAfterSeconds:
          decision
            .retryAfterSeconds
      }
    }
  );
}
