import assert from "node:assert/strict";
import test from "node:test";

import {
  openApiDocument
} from "./openapi.js";

test(
  "declares the complete public API",
  () => {
    assert.equal(
      openApiDocument.openapi,
      "3.1.0"
    );

    assert.equal(
      openApiDocument.info.version,
      "1.0.0"
    );

    assert.deepEqual(
      Object.keys(
        openApiDocument.paths
      ).sort(),

      [
        "/health",
        "/openapi.json",
        "/api/v1/agents",
        "/api/v1/search",
        "/api/v1/evaluate/{agent}",
        "/api/v1/ranking",
        "/api/v1/compare/{left}/{right}"
      ].sort()
    );
  }
);

test(
  "declares stable error codes",
  () => {
    const errorSchema =
      openApiDocument
        .components
        .schemas
        .ErrorResponse;

    const errorProperties =
      errorSchema
        .properties
        .error
        .properties;

    assert.deepEqual(
      errorProperties.code.enum,
      [
        "AGENT_NOT_FOUND",
        "INVALID_COMPARISON",
        "INVALID_SEARCH_QUERY",
        "GITHUB_OWNER_NOT_FOUND",
        "GITHUB_REPOSITORY_NOT_FOUND",
        "GITHUB_RATE_LIMITED",
        "GITHUB_AUTHENTICATION_FAILED",
        "GITHUB_ACCESS_DENIED",
        "GITHUB_UNAVAILABLE",
        "INTERNAL_SERVER_ERROR"
      ]
    );
  }
);
