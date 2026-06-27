import {
  createServer
} from "node:http";

import {
  handleApiRequest
} from "./api/router.js";

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

const port =
  getPort();

const server =
  createServer(
    (request, response) => {
      void handleApiRequest(
        request,
        response
      );
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
  }
);
