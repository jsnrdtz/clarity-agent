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
        "/api/v1/candidates/bankr",
        "/api/v1/candidates/bankr/reviews",
        "/api/v1/admin/candidates/bankr",
        "/api/v1/admin/candidates/bankr/reviews",
        "/api/v1/admin/refresh",
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
        "REFRESH_AUTHENTICATION_FAILED",
        "REFRESH_NOT_CONFIGURED",
        "REFRESH_ALREADY_RUNNING",
        "RATE_LIMIT_EXCEEDED",
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

test(
  "protects the administrative refresh endpoint",
  () => {
    const refreshOperation =
      openApiDocument
        .paths[
          "/api/v1/admin/refresh"
        ]
        .post;

    assert.deepEqual(
      refreshOperation.security,
      [
        {
          adminBearer: []
        }
      ]
    );

    assert.deepEqual(
      openApiDocument
        .components
        .securitySchemes
        .adminBearer,
      {
        type: "http",
        scheme: "bearer",
        description:
          "Administrative refresh token."
      }
    );
  }
);


test(
  "documents public request rate limits",
  () => {
    const operations = [
      openApiDocument
        .paths[
          "/api/v1/evaluate/{agent}"
        ]
        .get,

      openApiDocument
        .paths[
          "/api/v1/ranking"
        ]
        .get,

      openApiDocument
        .paths[
          "/api/v1/compare/{left}/{right}"
        ]
        .get
    ];

    const successHeaders = [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset"
    ].sort();

    const exceededHeaders = [
      ...successHeaders,
      "Retry-After"
    ].sort();

    for (
      const operation
      of operations
    ) {
      assert.ok(
        operation
          .responses[
            "429"
          ]
      );

      assert.deepEqual(
        Object.keys(
          operation
            .responses[
              "200"
            ]
            .headers
        ).sort(),

        successHeaders
      );

      assert.deepEqual(
        Object.keys(
          operation
            .responses[
              "429"
            ]
            .headers
        ).sort(),

        exceededHeaders
      );
    }
  }
);


test(
  "protects the candidate report upload endpoint",
  () => {
    const endpoint =
      openApiDocument.paths[
        "/api/v1/admin/candidates/bankr"
      ];

    assert.deepEqual(
      endpoint.post.security,
      [
        {
          candidateUploadBearer:
            []
        }
      ]
    );

    assert.ok(
      openApiDocument
        .components
        .securitySchemes
        .candidateUploadBearer
    );
  }
);


test(
  "protects candidate review administration",
  () => {
    const endpoint =
      openApiDocument.paths[
        "/api/v1/admin/candidates/bankr/reviews"
      ];

    assert.deepEqual(
      endpoint.get.security,
      [
        {
          candidateReviewBearer:
            []
        }
      ]
    );

    assert.deepEqual(
      endpoint.post.security,
      [
        {
          candidateReviewBearer:
            []
        }
      ]
    );

    assert.ok(
      openApiDocument
        .components
        .securitySchemes
        .candidateReviewBearer
    );
  }
);
