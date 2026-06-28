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
  before
} from "node:test";

import {
  handleApiRequest
} from "./router.js";

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
                }
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
