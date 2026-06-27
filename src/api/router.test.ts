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

let server:
  Server | undefined;

let baseUrl = "";

before(
  async () => {
    server =
      createServer(
        (request, response) => {
          void handleApiRequest(
            request,
            response
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
      "GET, OPTIONS"
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
