import assert from "node:assert/strict";
import test from "node:test";

import {
  listRegisteredAgents
} from "../data/agent-registry.js";

import {
  normalizeAgentSearchValue,
  searchRegisteredAgents
} from "./agent-search.js";

test(
  "stores search aliases in the agent registry",
  () => {
    const agents =
      listRegisteredAgents();

    for (const agent of agents) {
      assert.ok(
        Array.isArray(
          agent.searchAliases
        )
      );

      assert.ok(
        agent.searchAliases.length >
          0
      );
    }
  }
);

test(
  "does not assign the same normalized alias to different agents",
  () => {
    const aliases =
      new Map<
        string,
        string
      >();

    for (
      const agent of
      listRegisteredAgents()
    ) {
      const agentAliases = [
        ...agent.aliases,
        ...agent.searchAliases
      ];

      for (
        const alias of
        agentAliases
      ) {
        const normalized =
          normalizeAgentSearchValue(
            alias
          );

        const existingSlug =
          aliases.get(
            normalized
          );

        assert.ok(
          !existingSlug ||
            existingSlug ===
              agent.slug,

          `Alias "${alias}" conflicts between "${existingSlug}" and "${agent.slug}".`
        );

        aliases.set(
          normalized,
          agent.slug
        );
      }
    }
  }
);

test(
  "searches using registry search aliases",
  () => {
    const result =
      searchRegisteredAgents(
        "coding agent"
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
