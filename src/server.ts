import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";

import {
  buildAgentEvaluation
} from "./services/agent-evaluation.js";

import {
  listRegisteredAgents
} from "./data/agent-registry.js";

const DEFAULT_PORT = 3000;

function getPort(): number {
  const rawPort =
    process.env.PORT;

  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort =
    Number(rawPort);

  if (
    !Number.isInteger(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65535
  ) {
    throw new Error(
      `Invalid PORT value: "${rawPort}"`
    );
  }

  return parsedPort;
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

function sendNotFound(
  response: ServerResponse
): void {
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

function getAgentSlugFromPath(
  pathname: string
): string | null {
  const match =
    pathname.match(
      /^\/api\/v1\/evaluate\/([^/]+)$/
    );

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(
    match[1]
  );
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method === "OPTIONS") {
    setCommonHeaders(response);

    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(
      response,
      405,
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message:
            "Only GET requests are supported."
        }
      }
    );

    return;
  }

  const pathname =
    getPathname(request);

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

  const agentSlug =
    getAgentSlugFromPath(
      pathname
    );

  if (agentSlug) {
    try {
      const evaluation =
        await buildAgentEvaluation(
          agentSlug
        );

      sendJson(
        response,
        200,
        evaluation
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown evaluation error.";

      const isMissingAgent =
        message.includes(
          "is not registered"
        );

      sendJson(
        response,
        isMissingAgent
          ? 404
          : 500,
        {
          error: {
            code:
              isMissingAgent
                ? "AGENT_NOT_FOUND"
                : "EVALUATION_FAILED",

            message
          }
        }
      );
    }

    return;
  }

  sendNotFound(response);
}

const port =
  getPort();

const server =
  createServer(
    (request, response) => {
      handleRequest(
        request,
        response
      ).catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected server error.";

        sendJson(
          response,
          500,
          {
            error: {
              code:
                "INTERNAL_SERVER_ERROR",

              message
            }
          }
        );
      });
    }
  );

server.listen(
  port,
  () => {
    console.log(
      `Clarity API running at http://localhost:${port}`
    );

    console.log(
      `Health: http://localhost:${port}/health`
    );

    console.log(
      `Agents: http://localhost:${port}/api/v1/agents`
    );

    console.log(
      `Evaluate: http://localhost:${port}/api/v1/evaluate/aeon`
    );
  }
);
