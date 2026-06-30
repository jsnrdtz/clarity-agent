import assert from "node:assert/strict";
import test from "node:test";

import {
  agentRegistry,
  findRegisteredAgent
} from "../data/agent-registry.js";

test(
  "registry contains unique agent slugs",
  () => {
    const slugs = agentRegistry.map(
      (agent) => agent.slug
    );

    assert.equal(
      new Set(slugs).size,
      slugs.length
    );
  }
);

test(
  "registry aliases do not conflict",
  () => {
    const aliases = agentRegistry.flatMap(
      (agent) =>
        agent.aliases.map(
          (alias) =>
            alias.trim().toLowerCase()
        )
    );

    assert.equal(
      new Set(aliases).size,
      aliases.length
    );
  }
);

test(
  "registers Gitlawb with OpenClaude anchor",
  () => {
    const agent =
      findRegisteredAgent("gitlawb");

    assert.ok(agent);
    assert.equal(
      agent.github.owner,
      "Gitlawb"
    );
    assert.equal(
      agent.github.repository,
      "openclaude"
    );
    assert.equal(
      agent.github.scope,
      "primary"
    );

    assert.equal(
      findRegisteredAgent(
        "openclaude"
      )?.slug,
      "gitlawb"
    );
  }
);

test(
  "registers Ethy with arena anchor",
  () => {
    const agent =
      findRegisteredAgent("ethy");

    assert.ok(agent);
    assert.equal(
      agent.github.owner,
      "EthyAI"
    );
    assert.equal(
      agent.github.repository,
      "agent-intelligence-arena"
    );
    assert.equal(
      agent.github.scope,
      "primary"
    );

    assert.equal(
      findRegisteredAgent(
        "agent-intelligence-arena"
      )?.slug,
      "ethy"
    );
  }
);


test(
  "registers Orlix with its primary product repository",
  () => {
    const agent =
      findRegisteredAgent(
        "orlix-ai"
      );

    assert.ok(agent);

    assert.equal(
      agent.github.owner,
      "tylerbroqs"
    );

    assert.equal(
      agent.github.repository,
      "orlixai"
    );

    assert.equal(
      agent.github.scope,
      "primary"
    );

    assert.equal(
      findRegisteredAgent(
        "orlix"
      )?.slug,
      "orlix-ai"
    );

    assert.equal(
      findRegisteredAgent(
        "tylerbroqs/orlixai"
      )?.slug,
      "orlix-ai"
    );
  }
);
