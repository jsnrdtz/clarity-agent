import assert from "node:assert/strict";
import test from "node:test";

import {
  ClarityError,
  toClarityError
} from "../errors/clarity-error.js";

import {
  normalizeGitHubError
} from "./github-error.js";

function createGitHubError(
  status: number,
  message: string,
  headers:
    Record<string, string> = {}
): Error & {
  status: number;

  response: {
    headers:
      Record<string, string>;
  };
} {
  return Object.assign(
    new Error(message),
    {
      status,

      response: {
        headers
      }
    }
  );
}

test(
  "maps missing GitHub owner",
  () => {
    const error =
      normalizeGitHubError(
        createGitHubError(
          404,
          "Not Found"
        ),
        {
          resource: "owner",
          owner: "missing-owner"
        }
      );

    assert.equal(
      error.code,
      "GITHUB_OWNER_NOT_FOUND"
    );

    assert.equal(
      error.statusCode,
      404
    );

    assert.equal(
      error.retryable,
      false
    );
  }
);

test(
  "maps missing GitHub repository",
  () => {
    const error =
      normalizeGitHubError(
        createGitHubError(
          404,
          "Not Found"
        ),
        {
          resource: "repository",
          owner: "clarity",
          repository: "missing"
        }
      );

    assert.equal(
      error.code,
      "GITHUB_REPOSITORY_NOT_FOUND"
    );

    assert.match(
      error.message,
      /clarity\/missing/
    );
  }
);

test(
  "maps GitHub rate limits and reset time",
  () => {
    const error =
      normalizeGitHubError(
        createGitHubError(
          403,
          "API rate limit exceeded",
          {
            "x-ratelimit-remaining":
              "0",

            "x-ratelimit-reset":
              "1700000000"
          }
        ),
        {
          resource: "request"
        }
      );

    assert.equal(
      error.code,
      "GITHUB_RATE_LIMITED"
    );

    assert.equal(
      error.statusCode,
      429
    );

    assert.equal(
      error.retryable,
      true
    );

    assert.equal(
      error.details?.resetAt,
      "2023-11-14T22:13:20.000Z"
    );
  }
);

test(
  "maps GitHub authentication failure",
  () => {
    const error =
      normalizeGitHubError(
        createGitHubError(
          401,
          "Bad credentials"
        ),
        {
          resource: "request"
        }
      );

    assert.equal(
      error.code,
      "GITHUB_AUTHENTICATION_FAILED"
    );

    assert.equal(
      error.statusCode,
      503
    );
  }
);

test(
  "maps upstream GitHub failure",
  () => {
    const error =
      normalizeGitHubError(
        createGitHubError(
          500,
          "GitHub internal error"
        ),
        {
          resource: "request"
        }
      );

    assert.equal(
      error.code,
      "GITHUB_UNAVAILABLE"
    );

    assert.equal(
      error.statusCode,
      503
    );

    assert.equal(
      error.retryable,
      true
    );
  }
);

test(
  "preserves an existing Clarity error",
  () => {
    const original =
      new ClarityError(
        "GITHUB_UNAVAILABLE",
        "Unavailable",
        503,
        {
          retryable: true
        }
      );

    const normalized =
      normalizeGitHubError(
        original,
        {
          resource: "request"
        }
      );

    assert.strictEqual(
      normalized,
      original
    );
  }
);

test(
  "preserves typed application errors",
  () => {
    const missingAgent =
      new ClarityError(
        "AGENT_NOT_FOUND",
        'Agent "unknown" is not registered.',
        404
      );

    const invalidComparison =
      new ClarityError(
        "INVALID_COMPARISON",
        "Comparison requires two different agents.",
        400
      );

    assert.strictEqual(
      toClarityError(
        missingAgent
      ),
      missingAgent
    );

    assert.strictEqual(
      toClarityError(
        invalidComparison
      ),
      invalidComparison
    );
  }
);

test(
  "hides unexpected internal error details",
  () => {
    const error =
      toClarityError(
        new Error(
          "Secret implementation detail"
        )
      );

    assert.equal(
      error.code,
      "INTERNAL_SERVER_ERROR"
    );

    assert.equal(
      error.message,
      "An unexpected internal error occurred."
    );

    assert.equal(
      error.statusCode,
      500
    );
  }
);
