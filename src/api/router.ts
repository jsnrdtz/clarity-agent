import {
  searchRegisteredAgents
} from "../services/agent-search.js";

import {
  isPublicSitePath,
  servePublicSite
} from "../services/public-site.js";

import {
  openApiDocument
} from "./openapi.js";

import {
  toClarityError
} from "../errors/clarity-error.js";

import {
  authenticateAdminRefresh,
  runAdminRefresh
} from "../services/admin-refresh.js";

import {
  authenticateCandidateUpload,
  loadPublishedCandidateReport,
  readCandidateReportRequest,
  savePublishedCandidateReport
} from "../services/bankr-candidate-storage.js";

import {
  authenticateCandidateReview,
  createPublicCandidateReviewView,
  getCandidateReviewView,
  readCandidateReviewRequest,
  updateCandidateReview
} from "../services/candidate-review.js";

import {
  applyRequestRateLimit,
  DEFAULT_API_RATE_LIMIT_POLICIES,
  type ApiRateLimitPolicies
} from "./request-rate-limit.js";

import {
  createRateLimiter,
  type RateLimiter
} from "../services/rate-limit.js";

import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  listRegisteredAgents
} from "../data/agent-registry.js";

import {
  resolveRecentAgentEvaluation
} from "../services/evaluation-snapshot.js";

import {
  buildAgentComparison,
  buildAgentRanking
} from "../services/agent-ranking.js";

export type ApiDependencies = {
  runAdminRefresh:
    typeof runAdminRefresh;

  rateLimiter:
    RateLimiter;

  rateLimitPolicies:
    ApiRateLimitPolicies;

  trustProxy:
    boolean;
};

const defaultRateLimiter =
  createRateLimiter();

function getDefaultApiDependencies():
ApiDependencies {
  return {
    runAdminRefresh,

    rateLimiter:
      defaultRateLimiter,

    rateLimitPolicies:
      DEFAULT_API_RATE_LIMIT_POLICIES,

    trustProxy:
      process.env
        .CLARITY_TRUST_PROXY ===
      "true"
  };
}

function resolveApiDependencies(
  overrides:
    Partial<ApiDependencies>
): ApiDependencies {
  return {
    ...getDefaultApiDependencies(),
    ...overrides
  };
}

function setCommonHeaders(
  response: ServerResponse
): void {
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  response.setHeader(
    "Access-Control-Expose-Headers",
    [
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset"
    ].join(", ")
  );

  response.setHeader(
    "Cache-Control",
    "no-store"
  );
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  setCommonHeaders(response);

  response.statusCode =
    statusCode;

  response.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  response.end(
    JSON.stringify(
      body,
      null,
      2
    )
  );
}

function getRequestUrl(
  request: IncomingMessage
): URL {
  const host =
    request.headers.host ??
    "localhost";

  return new URL(
    request.url ?? "/",
    `http://${host}`
  );
}

function decodePathValue(
  value: string
): string {
  return decodeURIComponent(value);
}

function isKnownGetPath(
  pathname: string
): boolean {
  return (
    isPublicSitePath(pathname) ||
    pathname === "/openapi.json" ||
    pathname === "/health" ||
    pathname === "/api/v1/agents" ||
    pathname === "/api/v1/candidates/bankr" ||
    pathname === "/api/v1/candidates/bankr/reviews" ||
    pathname === "/api/v1/search" ||
    pathname === "/api/v1/ranking" ||
    /^\/api\/v1\/compare\/[^/]+\/[^/]+$/.test(
      pathname
    ) ||
    /^\/api\/v1\/evaluate\/[^/]+$/.test(
      pathname
    )
  );
}

function sendMethodNotAllowed(
  response: ServerResponse,
  allowedMethods: string[]
): void {
  response.setHeader(
    "Allow",
    [
      ...allowedMethods,
      "OPTIONS"
    ].join(", ")
  );

  sendJson(
    response,
    405,
    {
      error: {
        code:
          "METHOD_NOT_ALLOWED",

        message:
          "HTTP method is not supported for this route."
      }
    }
  );
}

function sendError(
  response: ServerResponse,
  error: unknown
): void {
  const normalized =
    toClarityError(error);

  if (
    normalized.code ===
    "INTERNAL_SERVER_ERROR"
  ) {
    console.error(
      "Unhandled API error:",
      error
    );
  }

  if (
    normalized.code ===
      "REFRESH_AUTHENTICATION_FAILED" ||
    normalized.code ===
      "CANDIDATE_UPLOAD_AUTHENTICATION_FAILED" ||
    normalized.code ===
      "CANDIDATE_REVIEW_AUTHENTICATION_FAILED"
  ) {
    response.setHeader(
      "WWW-Authenticate",
      "Bearer"
    );
  }

  if (
    normalized.code ===
    "RATE_LIMIT_EXCEEDED"
  ) {
    const retryAfterSeconds =
      normalized.details
        ?.retryAfterSeconds;

    if (
      typeof retryAfterSeconds ===
        "number" &&
      Number.isFinite(
        retryAfterSeconds
      )
    ) {
      response.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            Math.ceil(
              retryAfterSeconds
            )
          )
        )
      );
    }
  }

  sendJson(
    response,
    normalized.statusCode,
    {
      error: {
        code:
          normalized.code,

        message:
          normalized.message,

        retryable:
          normalized.retryable,

        ...(normalized.details
          ? {
              details:
                normalized.details
            }
          : {})
      }
    }
  );
}

async function routeGetRequest(
  pathname: string,
  searchParams: URLSearchParams,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (
    await servePublicSite(
      pathname,
      response
    )
  ) {
    return;
  }

  if (pathname === "/openapi.json") {
    sendJson(
      response,
      200,
      openApiDocument
    );

    return;
  }

  if (pathname === "/health") {
    sendJson(
      response,
      200,
      {
        status: "ok",
        service: "clarity-agent-api",
        version: "1.0",
        timestamp:
          new Date().toISOString()
      }
    );

    return;
  }

  if (pathname === "/api/v1/agents") {
    const agents =
      listRegisteredAgents().map(
        (agent) => ({
          slug:
            agent.slug,

          name:
            agent.name,

          github: {
            owner:
              agent.github.owner,

            repository:
              agent.github.repository,

            scope:
              agent.github.scope
          },

          evaluationUrl:
            `/api/v1/evaluate/${agent.slug}`
        })
      );

    sendJson(
      response,
      200,
      {
        schemaVersion: "1.0",
        count:
          agents.length,
        agents
      }
    );

    return;
  }

  if (
    pathname ===
    "/api/v1/candidates/bankr"
  ) {
    const report =
      await loadPublishedCandidateReport();

    sendJson(
      response,
      200,
      report
    );

    return;
  }

  if (
    pathname ===
    "/api/v1/candidates/bankr/reviews"
  ) {
    const report =
      await loadPublishedCandidateReport();

    const review =
      await getCandidateReviewView(
        report
      );

    sendJson(
      response,
      200,
      createPublicCandidateReviewView(
        review
      )
    );

    return;
  }

  if (
    pathname ===
    "/api/v1/admin/candidates/bankr/reviews"
  ) {
    authenticateCandidateReview(
      request.headers.authorization
    );

    const report =
      await loadPublishedCandidateReport();

    const review =
      await getCandidateReviewView(
        report
      );

    sendJson(
      response,
      200,
      review
    );

    return;
  }

  if (pathname === "/api/v1/search") {
    const query =
      searchParams.get("q") ??
      "";

    const search =
      searchRegisteredAgents(
        query
      );

    sendJson(
      response,
      200,
      search
    );

    return;
  }

  if (pathname === "/api/v1/ranking") {
    const ranking =
      await buildAgentRanking();

    sendJson(
      response,
      200,
      ranking
    );

    return;
  }

  const comparisonMatch =
    pathname.match(
      /^\/api\/v1\/compare\/([^/]+)\/([^/]+)$/
    );

  if (
    comparisonMatch?.[1] &&
    comparisonMatch[2]
  ) {
    const comparison =
      await buildAgentComparison(
        decodePathValue(
          comparisonMatch[1]
        ),

        decodePathValue(
          comparisonMatch[2]
        )
      );

    sendJson(
      response,
      200,
      comparison
    );

    return;
  }

  const evaluationMatch =
    pathname.match(
      /^\/api\/v1\/evaluate\/([^/]+)$/
    );

  if (evaluationMatch?.[1]) {
    const resolved =
      await resolveRecentAgentEvaluation(
        decodePathValue(
          evaluationMatch[1]
        )
      );

    sendJson(
      response,
      200,
      {
        ...resolved.evaluation,
        delivery:
          resolved.delivery
      }
    );

    return;
  }

  sendJson(
    response,
    404,
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found."
      }
    }
  );
}

async function routePostRequest(
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ApiDependencies
): Promise<void> {
  if (
    pathname ===
    "/api/v1/admin/candidates/bankr/reviews"
  ) {
    authenticateCandidateReview(
      request.headers.authorization
    );

    const report =
      await loadPublishedCandidateReport();

    const input =
      await readCandidateReviewRequest(
        request
      );

    const review =
      await updateCandidateReview(
        report,
        input
      );

    sendJson(
      response,
      200,
      review
    );

    return;
  }

  if (
    pathname ===
    "/api/v1/admin/candidates/bankr"
  ) {
    authenticateCandidateUpload(
      request.headers.authorization
    );

    const report =
      await readCandidateReportRequest(
        request
      );

    const outputPath =
      await savePublishedCandidateReport(
        report
      );

    sendJson(
      response,
      200,
      {
        schemaVersion:
          "1.0",

        stored:
          true,

        generatedAt:
          report.generatedAt,

        candidates:
          report.candidates.length,

        outputPath
      }
    );

    return;
  }

  if (
    pathname ===
    "/api/v1/admin/refresh"
  ) {
    authenticateAdminRefresh(
      request.headers.authorization
    );

    const report =
      await dependencies
        .runAdminRefresh();

    sendJson(
      response,
      200,
      report
    );

    return;
  }

  sendJson(
    response,
    404,
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found."
      }
    }
  );
}

export async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencyOverrides:
    Partial<ApiDependencies> = {}
): Promise<void> {
  const dependencies =
    resolveApiDependencies(
      dependencyOverrides
    );

  try {
    if (request.method === "OPTIONS") {
      setCommonHeaders(response);

      response.statusCode = 204;
      response.end();
      return;
    }

    const requestUrl =
      getRequestUrl(request);

    if (request.method === "GET") {
      if (
        requestUrl.pathname ===
          "/api/v1/admin/refresh" ||
        requestUrl.pathname ===
          "/api/v1/admin/candidates/bankr"
      ) {
        sendMethodNotAllowed(
          response,
          [
            "POST"
          ]
        );

        return;
      }

      applyRequestRateLimit(
        {
          request,
          response,

          pathname:
            requestUrl.pathname,

          limiter:
            dependencies
              .rateLimiter,

          policies:
            dependencies
              .rateLimitPolicies,

          trustProxy:
            dependencies
              .trustProxy
        }
      );

      await routeGetRequest(
        requestUrl.pathname,
        requestUrl.searchParams,
        request,
        response
      );

      return;
    }

    if (request.method === "POST") {
      if (
        isKnownGetPath(
          requestUrl.pathname
        )
      ) {
        sendMethodNotAllowed(
          response,
          [
            "GET"
          ]
        );

        return;
      }

      await routePostRequest(
        requestUrl.pathname,
        request,
        response,
        dependencies
      );

      return;
    }

    sendMethodNotAllowed(
      response,
      [
        "GET",
        "POST"
      ]
    );
  } catch (error) {
    sendError(
      response,
      error
    );
  }
}
