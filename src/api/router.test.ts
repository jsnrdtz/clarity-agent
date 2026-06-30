import assert from "node:assert/strict";

import {
  createServer,
  type Server
} from "node:http";

import type {
  AddressInfo
} from "node:net";

import test, {
  after,
  before,
  beforeEach
} from "node:test";

import {
  handleApiRequest
} from "./router.js";

import {
  DEFAULT_API_RATE_LIMIT_POLICIES,
  type ApiRateLimitPolicies
} from "./request-rate-limit.js";

import {
  createRateLimiter
} from "../services/rate-limit.js";

import type {
  AgentRefreshReport
} from "../services/agent-refresh.js";

let server:
  Server | undefined;

let baseUrl = "";

const VALID_REFRESH_TOKEN =
  "0123456789abcdef0123456789abcdef";

let adminRefreshCalls =
  0;

const TEST_NOW =
  1_750_000_000_000;

const testRateLimiter =
  createRateLimiter(
    {
      now:
        () => TEST_NOW
    }
  );

function createTestRateLimitPolicies():
ApiRateLimitPolicies {
  return {
    evaluate: {
      ...DEFAULT_API_RATE_LIMIT_POLICIES
        .evaluate
    },

    compare: {
      ...DEFAULT_API_RATE_LIMIT_POLICIES
        .compare
    },

    ranking: {
      ...DEFAULT_API_RATE_LIMIT_POLICIES
        .ranking
    }
  };
}

let testRateLimitPolicies =
  createTestRateLimitPolicies();

let testTrustProxy =
  true;

const testRefreshReport:
AgentRefreshReport = {
  schemaVersion: "1.0",

  startedAt:
    "2026-06-28T00:00:00.000Z",

  completedAt:
    "2026-06-28T00:00:01.000Z",

  durationMs:
    1000,

  totals: {
    registered: 4,
    refreshed: 4,
    failed: 0
  },

  results: []
};

function setTestRefreshToken(
  token: string | undefined
): () => void {
  const previousToken =
    process.env
      .CLARITY_REFRESH_TOKEN;

  if (token === undefined) {
    delete process.env
      .CLARITY_REFRESH_TOKEN;
  } else {
    process.env
      .CLARITY_REFRESH_TOKEN =
        token;
  }

  return () => {
    if (
      previousToken === undefined
    ) {
      delete process.env
        .CLARITY_REFRESH_TOKEN;
    } else {
      process.env
        .CLARITY_REFRESH_TOKEN =
          previousToken;
    }
  };
}

beforeEach(
  () => {
    testRateLimiter.clear();

    testRateLimitPolicies =
      createTestRateLimitPolicies();

    testTrustProxy =
      true;
  }
);

before(
  async () => {
    server =
      createServer(
        (request, response) => {
          void handleApiRequest(
            request,
            response,
            {
              runAdminRefresh:
                async () => {
                  adminRefreshCalls +=
                    1;

                  return testRefreshReport;
                },

              rateLimiter:
                testRateLimiter,

              rateLimitPolicies:
                testRateLimitPolicies,

              trustProxy:
                testTrustProxy
            }
          );
        }
      );

    await new Promise<void>(
      (resolve, reject) => {
        server?.once(
          "error",
          reject
        );

        server?.listen(
          0,
          "127.0.0.1",
          () => {
            resolve();
          }
        );
      }
    );

    const address =
      server.address();

    if (
      !address ||
      typeof address === "string"
    ) {
      throw new Error(
        "Test server did not receive a TCP address."
      );
    }

    const port =
      (
        address as AddressInfo
      ).port;

    baseUrl =
      `http://127.0.0.1:${port}`;
  }
);

after(
  async () => {
    if (!server) {
      return;
    }

    await new Promise<void>(
      (resolve, reject) => {
        server?.close(
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          }
        );
      }
    );
  }
);

async function getJson(
  pathname: string,
  options?: RequestInit
): Promise<{
  response: Response;
  body: Record<string, unknown>;
}> {
  const response =
    await fetch(
      `${baseUrl}${pathname}`,
      options
    );

  const body =
    await response.json() as
      Record<string, unknown>;

  return {
    response,
    body
  };
}

test(
  "returns API health information",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/health"
      );

    assert.equal(
      response.status,
      200
    );

    assert.match(
      response.headers.get(
        "content-type"
      ) ?? "",
      /application\/json/
    );

    assert.equal(
      body.status,
      "ok"
    );

    assert.equal(
      body.service,
      "clarity-agent-api"
    );

    assert.equal(
      body.version,
      "1.0"
    );

    assert.equal(
      typeof body.timestamp,
      "string"
    );
  }
);

test(
  "returns registered agents without GitHub requests",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/agents"
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.schemaVersion,
      "1.0"
    );

    assert.ok(
      Array.isArray(
        body.agents
      )
    );

    const agents =
      body.agents as Array<{
        slug: string;
        evaluationUrl: string;
      }>;

    assert.equal(
      body.count,
      agents.length
    );

    assert.ok(
      agents.some(
        (agent) =>
          agent.slug === "aeon"
      )
    );

    assert.ok(
      agents.some(
        (agent) =>
          agent.slug === "prxvt"
      )
    );

    assert.ok(
      agents.every(
        (agent) =>
          agent.evaluationUrl ===
          `/api/v1/evaluate/${agent.slug}`
      )
    );
  }
);

test(
  "returns 404 for an unknown route",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/unknown"
      );

    assert.equal(
      response.status,
      404
    );

    const error =
      body.error as {
        code: string;
        message: string;
      };

    assert.equal(
      error.code,
      "NOT_FOUND"
    );

    assert.equal(
      error.message,
      "Route not found."
    );
  }
);

test(
  "returns 404 for an unknown agent",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent"
      );

    assert.equal(
      response.status,
      404
    );

    const error =
      body.error as {
        code: string;
        message: string;
      };

    assert.equal(
      error.code,
      "AGENT_NOT_FOUND"
    );

    assert.match(
      error.message,
      /not registered/
    );
  }
);

test(
  "rejects comparison of the same agent",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/compare/aeon/aeon"
      );

    assert.equal(
      response.status,
      400
    );

    const error =
      body.error as {
        code: string;
        message: string;
      };

    assert.equal(
      error.code,
      "INVALID_COMPARISON"
    );

    assert.match(
      error.message,
      /two different agents/
    );
  }
);

test(
  "rejects unsupported HTTP methods",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/health",
        {
          method: "POST"
        }
      );

    assert.equal(
      response.status,
      405
    );

    assert.equal(
      response.headers.get(
        "allow"
      ),
      "GET, OPTIONS"
    );

    const error =
      body.error as {
        code: string;
      };

    assert.equal(
      error.code,
      "METHOD_NOT_ALLOWED"
    );
  }
);

test(
  "handles CORS preflight requests",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/v1/ranking`,
        {
          method: "OPTIONS"
        }
      );

    assert.equal(
      response.status,
      204
    );

    assert.equal(
      response.headers.get(
        "access-control-allow-origin"
      ),
      "*"
    );

    assert.equal(
      response.headers.get(
        "access-control-allow-methods"
      ),
      "GET, POST, OPTIONS"
    );

    assert.equal(
      response.headers.get(
        "access-control-allow-headers"
      ),
      "Content-Type, Authorization"
    );

    assert.equal(
      await response.text(),
      ""
    );
  }
);

test(
  "serves the OpenAPI document",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/openapi.json"
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.openapi,
      "3.1.0"
    );

    const paths =
      body.paths as
        Record<string, unknown>;

    assert.ok(
      paths[
        "/api/v1/evaluate/{agent}"
      ]
    );

    assert.ok(
      paths[
        "/api/v1/compare/{left}/{right}"
      ]
    );
  }
);


test(
  "searches registered agents by alias",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/search?q=privacy"
      );

    assert.equal(
      response.status,
      200
    );

    assert.equal(
      body.count,
      1
    );

    const results =
      body.results as Array<{
        agent: {
          slug: string;
        };
      }>;

    assert.equal(
      results[0]?.agent.slug,
      "prxvt"
    );
  }
);

test(
  "rejects a missing search query",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/search"
      );

    assert.equal(
      response.status,
      400
    );

    const error =
      body.error as {
        code: string;
        retryable: boolean;
      };

    assert.equal(
      error.code,
      "INVALID_SEARCH_QUERY"
    );

    assert.equal(
      error.retryable,
      false
    );
  }
);

test(
  "rejects admin refresh when it is not configured",
  async () => {
    const restoreToken =
      setTestRefreshToken(
        undefined
      );

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/admin/refresh",
          {
            method: "POST"
          }
        );

      assert.equal(
        response.status,
        503
      );

      const error =
        body.error as {
          code: string;
        };

      assert.equal(
        error.code,
        "REFRESH_NOT_CONFIGURED"
      );
    } finally {
      restoreToken();
    }
  }
);

test(
  "requires Bearer authentication for admin refresh",
  async () => {
    const restoreToken =
      setTestRefreshToken(
        VALID_REFRESH_TOKEN
      );

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/admin/refresh",
          {
            method: "POST"
          }
        );

      assert.equal(
        response.status,
        401
      );

      assert.equal(
        response.headers.get(
          "www-authenticate"
        ),
        "Bearer"
      );

      const error =
        body.error as {
          code: string;
        };

      assert.equal(
        error.code,
        "REFRESH_AUTHENTICATION_FAILED"
      );
    } finally {
      restoreToken();
    }
  }
);

test(
  "rejects an invalid admin refresh token",
  async () => {
    const restoreToken =
      setTestRefreshToken(
        VALID_REFRESH_TOKEN
      );

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/admin/refresh",
          {
            method: "POST",

            headers: {
              Authorization:
                "Bearer invalid-token"
            }
          }
        );

      assert.equal(
        response.status,
        401
      );

      const error =
        body.error as {
          code: string;
        };

      assert.equal(
        error.code,
        "REFRESH_AUTHENTICATION_FAILED"
      );
    } finally {
      restoreToken();
    }
  }
);

test(
  "runs an authenticated admin refresh",
  async () => {
    const restoreToken =
      setTestRefreshToken(
        VALID_REFRESH_TOKEN
      );

    adminRefreshCalls =
      0;

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/admin/refresh",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${VALID_REFRESH_TOKEN}`
            }
          }
        );

      assert.equal(
        response.status,
        200
      );

      assert.equal(
        adminRefreshCalls,
        1
      );

      assert.deepEqual(
        body.totals,
        {
          registered: 4,
          refreshed: 4,
          failed: 0
        }
      );
    } finally {
      restoreToken();
    }
  }
);

test(
  "rejects GET requests to the admin refresh endpoint",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/admin/refresh"
      );

    assert.equal(
      response.status,
      405
    );

    assert.equal(
      response.headers.get(
        "allow"
      ),
      "POST, OPTIONS"
    );

    const error =
      body.error as {
        code: string;
      };

    assert.equal(
      error.code,
      "METHOD_NOT_ALLOWED"
    );
  }
);


test(
  "rate limits expensive routes by forwarded client address",
  async () => {
    testRateLimitPolicies
      .evaluate = {
        limit: 1,
        windowMs: 10_000
      };

    const headers = {
      "X-Forwarded-For":
        "203.0.113.10"
    };

    const first =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers
        }
      );

    assert.equal(
      first.response.status,
      404
    );

    assert.equal(
      first.response.headers.get(
        "x-ratelimit-limit"
      ),
      "1"
    );

    assert.equal(
      first.response.headers.get(
        "x-ratelimit-remaining"
      ),
      "0"
    );

    const second =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers
        }
      );

    assert.equal(
      second.response.status,
      429
    );

    assert.equal(
      second.response.headers.get(
        "retry-after"
      ),
      "10"
    );

    assert.equal(
      second.response.headers.get(
        "x-ratelimit-limit"
      ),
      "1"
    );

    assert.equal(
      second.response.headers.get(
        "x-ratelimit-remaining"
      ),
      "0"
    );

    const error =
      second.body.error as {
        code: string;
        retryable: boolean;

        details: {
          scope: string;
          limit: number;
          remaining: number;
          retryAfterSeconds: number;
        };
      };

    assert.equal(
      error.code,
      "RATE_LIMIT_EXCEEDED"
    );

    assert.equal(
      error.retryable,
      true
    );

    assert.deepEqual(
      error.details,
      {
        scope: "evaluate",
        limit: 1,
        remaining: 0,

        resetAt:
          new Date(
            TEST_NOW +
            10_000
          ).toISOString(),

        retryAfterSeconds:
          10
      }
    );
  }
);

test(
  "keeps forwarded clients in separate rate limit buckets",
  async () => {
    testRateLimitPolicies
      .evaluate = {
        limit: 1,
        windowMs: 10_000
      };

    const firstClient =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Forwarded-For":
              "203.0.113.20"
          }
        }
      );

    const secondClient =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Forwarded-For":
              "203.0.113.21"
          }
        }
      );

    assert.equal(
      firstClient.response.status,
      404
    );

    assert.equal(
      secondClient.response.status,
      404
    );
  }
);

test(
  "prefers the trusted real IP over forwarded-for",
  async () => {
    testRateLimitPolicies
      .evaluate = {
        limit: 1,
        windowMs: 10_000
      };

    const first =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Real-IP":
              "198.51.100.40",

            "X-Forwarded-For":
              "203.0.113.40"
          }
        }
      );

    const second =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Real-IP":
              "198.51.100.40",

            "X-Forwarded-For":
              "203.0.113.41"
          }
        }
      );

    assert.equal(
      first.response.status,
      404
    );

    assert.equal(
      second.response.status,
      429
    );
  }
);

test(
  "ignores forwarded addresses when proxy trust is disabled",
  async () => {
    testRateLimitPolicies
      .evaluate = {
        limit: 1,
        windowMs: 10_000
      };

    testTrustProxy =
      false;

    const first =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Forwarded-For":
              "203.0.113.30"
          }
        }
      );

    const second =
      await getJson(
        "/api/v1/evaluate/not-a-real-agent",
        {
          headers: {
            "X-Forwarded-For":
              "203.0.113.31"
          }
        }
      );

    assert.equal(
      first.response.status,
      404
    );

    assert.equal(
      second.response.status,
      429
    );
  }
);

test(
  "does not rate limit inexpensive public routes",
  async () => {
    const first =
      await getJson(
        "/health"
      );

    const second =
      await getJson(
        "/health"
      );

    assert.equal(
      first.response.status,
      200
    );

    assert.equal(
      second.response.status,
      200
    );

    assert.equal(
      second.response.headers.get(
        "x-ratelimit-limit"
      ),
      null
    );
  }
);


test(
  "serves the public Clarity homepage",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/`
      );

    const body =
      await response.text();

    assert.equal(
      response.status,
      200
    );

    assert.match(
      response.headers.get(
        "content-type"
      ) ?? "",
      /text\/html/
    );

    assert.match(
      body,
      /Intelligence for the/
    );

    assert.match(
      body,
      /AI agent economy/
    );

    assert.match(
      body,
      /id="rankingList"/
    );
  }
);

test(
  "serves public site assets",
  async () => {
    const [
      stylesheetResponse,
      scriptResponse
    ] = await Promise.all([
      fetch(
        `${baseUrl}/styles.css`
      ),

      fetch(
        `${baseUrl}/app.js`
      )
    ]);

    const [
      stylesheet,
      script
    ] = await Promise.all([
      stylesheetResponse.text(),
      scriptResponse.text()
    ]);

    assert.equal(
      stylesheetResponse.status,
      200
    );

    assert.match(
      stylesheetResponse.headers.get(
        "content-type"
      ) ?? "",
      /text\/css/
    );

    assert.match(
      stylesheet,
      /\.agent-card/
    );

    assert.equal(
      scriptResponse.status,
      200
    );

    assert.match(
      scriptResponse.headers.get(
        "content-type"
      ) ?? "",
      /javascript/
    );

    assert.match(
      script,
      /api\/v1\/ranking/
    );
  }
);

test(
  "serves permanent public agent pages",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/agents/aeon`
      );

    const body =
      await response.text();

    assert.equal(
      response.status,
      200
    );

    assert.match(
      response.headers.get(
        "content-type"
      ) ?? "",
      /text\/html/
    );

    assert.match(
      body,
      /id="agentPage"/
    );

    assert.match(
      body,
      /src="\/agent\.js"/
    );
  }
);

test(
  "serves the public agent page script",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/agent.js`
      );

    const body =
      await response.text();

    assert.equal(
      response.status,
      200
    );

    assert.match(
      response.headers.get(
        "content-type"
      ) ?? "",
      /javascript/
    );

    assert.match(
      body,
      /api\/v1\/evaluate/
    );

    assert.match(
      body,
      /api\/v1\/ranking/
    );
  }
);

test(
  "rejects unsupported methods for public agent pages",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/agents/aeon`,
        {
          method:
            "POST"
        }
      );

    assert.equal(
      response.status,
      405
    );

    assert.equal(
      response.headers.get(
        "allow"
      ),
      "GET, OPTIONS"
    );
  }
);

function createCandidateReportFixture() {
  return {
    schemaVersion:
      "1.0",

    source:
      "bankr",

    generatedAt:
      "2026-06-30T00:00:00.000Z",

    profilesListed:
      1,

    detailsLoaded:
      1,

    failures:
      [],

    candidates: [
      {
        source:
          "bankr",

        bankrProfileId:
          "profile-1",

        bankrSlug:
          "example-agent",

        name:
          "Example Agent",

        description:
          "Example candidate.",

        website:
          "https://example.com",

        githubRepositories:
          [],

        warnings: [
          "no-github-repository"
        ]
      }
    ],

    warnings:
      [],

    conflicts: {
      profileIds:
        [],

      slugs:
        [],

      tokenIdentities:
        []
    },

    websiteDiscovery: {
      skippedExistingGitHub:
        0,

      skippedNoWebsite:
        0,

      skippedSocialWebsite:
        0,

      attempted:
        1,

      found:
        0,

      ownerOnly:
        0,

      notFound:
        1,

      failed:
        0,

      repositoriesFound:
        0,

      ownerPagesFound:
        0,

      results:
        []
    },

    ownerDiscovery: {
      enabled:
        true,

      skippedNoToken:
        0,

      attempted:
        0,

      probable:
        0,

      review:
        0,

      notFound:
        0,

      failed:
        0,

      candidatesFound:
        0,

      results:
        []
    },

    githubEvidence: {
      candidatesWithGitHub:
        0,

      candidatesWithoutGitHub:
        1,

      classifiedRepositories:
        0,

      uniqueRepositories:
        0,

      relationships: {
        primary:
          0,

        component:
          0,

        integration:
          0,

        dependency:
          0,

        example:
          0,

        unknown:
          0
      },

      confidences: {
        high:
          0,

        medium:
          0,

        low:
          0
      }
    }
  };
}

function setCandidateUploadEnvironment(
  token:
    string |
    undefined,

  reportPath:
    string
): () => void {
  const previousToken =
    process.env
      .CLARITY_CANDIDATE_UPLOAD_TOKEN;

  const previousPath =
    process.env
      .CLARITY_BANKR_PUBLISHED_REPORT_PATH;

  if (
    token === undefined
  ) {
    delete process.env
      .CLARITY_CANDIDATE_UPLOAD_TOKEN;
  } else {
    process.env
      .CLARITY_CANDIDATE_UPLOAD_TOKEN =
        token;
  }

  process.env
    .CLARITY_BANKR_PUBLISHED_REPORT_PATH =
      reportPath;

  return () => {
    if (
      previousToken === undefined
    ) {
      delete process.env
        .CLARITY_CANDIDATE_UPLOAD_TOKEN;
    } else {
      process.env
        .CLARITY_CANDIDATE_UPLOAD_TOKEN =
          previousToken;
    }

    if (
      previousPath === undefined
    ) {
      delete process.env
        .CLARITY_BANKR_PUBLISHED_REPORT_PATH;
    } else {
      process.env
        .CLARITY_BANKR_PUBLISHED_REPORT_PATH =
          previousPath;
    }
  };
}

test(
  "serves the public Candidate Review page",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/candidates`
      );

    assert.equal(
      response.status,
      200
    );

    assert.match(
      await response.text(),
      /Candidate Review/
    );
  }
);

test(
  "publishes and returns a validated Bankr candidate report",
  async () => {
    const token =
      "abcdef0123456789abcdef0123456789";

    const reportPath =
      `/tmp/clarity-bankr-${process.pid}-${Date.now()}.json`;

    const restore =
      setCandidateUploadEnvironment(
        token,
        reportPath
      );

    try {
      const upload =
        await getJson(
          "/api/v1/admin/candidates/bankr",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                createCandidateReportFixture()
              )
          }
        );

      assert.equal(
        upload.response.status,
        200
      );

      assert.equal(
        upload.body.stored,
        true
      );

      const published =
        await getJson(
          "/api/v1/candidates/bankr"
        );

      assert.equal(
        published.response.status,
        200
      );

      assert.equal(
        published.body.source,
        "bankr"
      );

      assert.equal(
        (
          published.body
            .candidates as
              unknown[]
        ).length,
        1
      );
    } finally {
      restore();

      const {
        unlink
      } =
        await import(
          "node:fs/promises"
        );

      await unlink(
        reportPath
      ).catch(
        () => undefined
      );
    }
  }
);

test(
  "requires candidate upload Bearer authentication",
  async () => {
    const reportPath =
      `/tmp/clarity-bankr-auth-${process.pid}-${Date.now()}.json`;

    const restore =
      setCandidateUploadEnvironment(
        "abcdef0123456789abcdef0123456789",
        reportPath
      );

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/admin/candidates/bankr",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                createCandidateReportFixture()
              )
          }
        );

      assert.equal(
        response.status,
        401
      );

      assert.equal(
        response.headers.get(
          "www-authenticate"
        ),
        "Bearer"
      );

      assert.equal(
        (
          body.error as {
            code: string;
          }
        ).code,
        "CANDIDATE_UPLOAD_AUTHENTICATION_FAILED"
      );
    } finally {
      restore();
    }
  }
);

test(
  "returns 404 before a candidate report is published",
  async () => {
    const reportPath =
      `/tmp/clarity-bankr-missing-${process.pid}-${Date.now()}.json`;

    const restore =
      setCandidateUploadEnvironment(
        undefined,
        reportPath
      );

    try {
      const {
        response,
        body
      } =
        await getJson(
          "/api/v1/candidates/bankr"
        );

      assert.equal(
        response.status,
        404
      );

      assert.equal(
        (
          body.error as {
            code: string;
          }
        ).code,
        "CANDIDATE_REPORT_NOT_FOUND"
      );
    } finally {
      restore();
    }
  }
);

test(
  "rejects GET requests to the candidate upload endpoint",
  async () => {
    const {
      response,
      body
    } =
      await getJson(
        "/api/v1/admin/candidates/bankr"
      );

    assert.equal(
      response.status,
      405
    );

    assert.equal(
      response.headers.get(
        "allow"
      ),
      "POST, OPTIONS"
    );

    assert.equal(
      (
        body.error as {
          code: string;
        }
      ).code,
      "METHOD_NOT_ALLOWED"
    );
  }
);
