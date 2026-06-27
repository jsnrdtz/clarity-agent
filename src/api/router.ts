import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

import {
  listRegisteredAgents
} from "../data/agent-registry.js";

import {
  buildAgentEvaluation
} from "../services/agent-evaluation.js";

import {
  buildAgentComparison,
  buildAgentRanking
} from "../services/agent-ranking.js";

function setCommonHeaders(
  response: ServerResponse
): void {
  response.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
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

function getPathname(
  request: IncomingMessage
): string {
  const host =
    request.headers.host ??
    "localhost";

  const url =
    new URL(
      request.url ?? "/",
      `http://${host}`
    );

  return url.pathname;
}

function decodePathValue(
  value: string
): string {
  return decodeURIComponent(value);
}

function sendError(
  response: ServerResponse,
  error: unknown
): void {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown API error.";

  if (
    message.includes(
      "is not registered"
    )
  ) {
    sendJson(
      response,
      404,
      {
        error: {
          code: "AGENT_NOT_FOUND",
          message
        }
      }
    );

    return;
  }

  if (
    message.includes(
      "two different agents"
    )
  ) {
    sendJson(
      response,
      400,
      {
        error: {
          code: "INVALID_COMPARISON",
          message
        }
      }
    );

    return;
  }

  sendJson(
    response,
    500,
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message
      }
    }
  );
}

async function routeGetRequest(
  pathname: string,
  response: ServerResponse
): Promise<void> {
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
    const evaluation =
      await buildAgentEvaluation(
        decodePathValue(
          evaluationMatch[1]
        )
      );

    sendJson(
      response,
      200,
      evaluation
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
  response: ServerResponse
): Promise<void> {
  try {
    if (request.method === "OPTIONS") {
      setCommonHeaders(response);

      response.statusCode = 204;
      response.end();
      return;
    }

    if (request.method !== "GET") {
      response.setHeader(
        "Allow",
        "GET, OPTIONS"
      );

      sendJson(
        response,
        405,
        {
          error: {
            code:
              "METHOD_NOT_ALLOWED",

            message:
              "Only GET requests are supported."
          }
        }
      );

      return;
    }

    const pathname =
      getPathname(request);

    await routeGetRequest(
      pathname,
      response
    );
  } catch (error) {
    sendError(
      response,
      error
    );
  }
}
