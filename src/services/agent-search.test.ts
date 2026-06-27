import assert from "node:assert/strict";
import test from "node:test";

import {
  searchRegisteredAgents
} from "./agent-search.js";

test(
  "finds an agent by exact slug",
  () => {
    const result =
      searchRegisteredAgents(
        "aeon"
      );

    assert.equal(
      result.count,
      1
    );

    assert.equal(
      result.results[0]
        ?.agent.slug,
      "aeon"
    );

    assert.equal(
      result.results[0]
        ?.match.type,
      "exact-slug"
    );

    assert.equal(
      result.results[0]
        ?.match.relevance,
      100
    );
  }
);

test(
  "finds an agent by exact alias",
  () => {
    const result =
      searchRegisteredAgents(
        "aeon ai"
      );

    assert.equal(
      result.results[0]
        ?.agent.slug,
      "aeon"
    );

    assert.equal(
      result.results[0]
        ?.match.type,
      "exact-alias"
    );
  }
);

test(
  "finds an agent by alias prefix",
  () => {
    const result =
      searchRegisteredAgents(
        "privacy"
      );

    assert.equal(
      result.results[0]
        ?.agent.slug,
      "prxvt"
    );

    assert.equal(
      result.results[0]
        ?.match.type,
      "prefix"
    );
  }
);

test(
  "returns an empty result for an unknown agent",
  () => {
    const result =
      searchRegisteredAgents(
        "unknown project"
      );

    assert.equal(
      result.count,
      0
    );

    assert.deepEqual(
      result.results,
      []
    );
  }
);

test(
  "rejects an empty or one-character query",
  () => {
    assert.throws(
      () =>
        searchRegisteredAgents(
          ""
        ),

      /at least 2 characters/
    );

    assert.throws(
      () =>
        searchRegisteredAgents(
          "a"
        ),

      /at least 2 characters/
    );
  }
);

test(
  "finds Gitlawb by OpenClaude alias",
  () => {
    const result =
      searchRegisteredAgents(
        "openclaude"
      );

    assert.equal(
      result.count,
      1
    );

    assert.equal(
      result.results[0]
        ?.agent.slug,
      "gitlawb"
    );

    assert.equal(
      result.results[0]
        ?.match.type,
      "exact-alias"
    );
  }
);

test(
  "finds Ethy by arena alias",
  () => {
    const result =
      searchRegisteredAgents(
        "agent intelligence arena"
      );

    assert.equal(
      result.count,
      1
    );

    assert.equal(
      result.results[0]
        ?.agent.slug,
      "ethy"
    );

    assert.equal(
      result.results[0]
        ?.match.type,
      "exact-alias"
    );
  }
);
