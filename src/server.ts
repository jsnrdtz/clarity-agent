import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";

import {
  handleApiRequest
} from "./api/router.js";

const DEFAULT_PORT =
  3000;

const SHUTDOWN_TIMEOUT_MS =
  10_000;

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
    parsedPort > 65_535
  ) {
    throw new Error(
      `Invalid PORT value: "${rawPort}"`
    );
  }

  return parsedPort;
}

function getRequestPath(
  request: IncomingMessage
): string {
  return request.url ?? "/";
}

function attachRequestLogger(
  request: IncomingMessage,
  response: ServerResponse
): void {
  const startedAt =
    process.hrtime.bigint();

  response.once(
    "finish",
    () => {
      const finishedAt =
        process.hrtime.bigint();

      const durationMilliseconds =
        Number(
          finishedAt -
          startedAt
        ) /
        1_000_000;

      console.log(
        [
          new Date().toISOString(),
          request.method ?? "UNKNOWN",
          getRequestPath(request),
          response.statusCode,
          `${durationMilliseconds.toFixed(1)}ms`
        ].join(" ")
      );
    }
  );
}

const port =
  getPort();

const server =
  createServer(
    (request, response) => {
      attachRequestLogger(
        request,
        response
      );

      void handleApiRequest(
        request,
        response
      );
    }
  );

let shuttingDown =
  false;

function shutdown(
  signal: NodeJS.Signals
): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown =
    true;

  console.log(
    `${signal} received. Shutting down Clarity API...`
  );

  const forceShutdownTimer =
    setTimeout(
      () => {
        console.error(
          "Graceful shutdown timed out. Closing active connections."
        );

        server.closeAllConnections();

        process.exitCode =
          1;
      },

      SHUTDOWN_TIMEOUT_MS
    );

  forceShutdownTimer.unref();

  server.close(
    (error) => {
      clearTimeout(
        forceShutdownTimer
      );

      if (error) {
        console.error(
          "Clarity API shutdown failed:",
          error
        );

        process.exitCode =
          1;

        return;
      }

      console.log(
        "Clarity API stopped."
      );
    }
  );
}

process.once(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);

process.once(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
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
      `Ranking: http://localhost:${port}/api/v1/ranking`
    );

    console.log(
      `Evaluate: http://localhost:${port}/api/v1/evaluate/aeon`
    );

    console.log(
      `Compare: http://localhost:${port}/api/v1/compare/aeon/prxvt`
    );

    if (!process.env.GITHUB_TOKEN) {
      console.warn(
        "Warning: GITHUB_TOKEN is not configured. GitHub API limits will be significantly lower."
      );
    }
  }
);
