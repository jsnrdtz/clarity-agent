import assert from "node:assert/strict";

import {
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";

import {
  tmpdir
} from "node:os";

import {
  join
} from "node:path";

import test from "node:test";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

import type {
  BankrGlobalGitHubRepositoryMatch
} from "./bankr-global-github-search.js";

import {
  buildAutomaticAgentRegistry,
  saveAutomaticAgentRegistry
} from "./automatic-agent-registry.js";

import type {
  AutomaticAgentRegistryInput
} from "./automatic-agent-registry.js";

function createCandidate(
  overrides:
    Partial<
      BankrCandidate
    > = {}
): BankrCandidate {
  const address =
    `0x${"ab".repeat(20)}`;

  return {
    source:
      "bankr",

    bankrProfileId:
      "profile-1",

    bankrSlug:
      "example-agent",

    name:
      "Example Agent",

    description:
      "Example autonomous agent.",

    token: {
      chainId:
        "base",

      address,

      identity:
        `base:${address}`,

      symbol:
        "EXAMPLE",

      name:
        "Example Agent"
    },

    twitterUsername:
      "exampleagent",

    website:
      "https://example.xyz",

    marketCapUsd:
      100_000,

    weeklyRevenueWeth:
      "1.25",

    createdAt:
      "2026-01-01T00:00:00.000Z",

    githubRepositories:
      [],

    warnings:
      [],

    ...overrides
  };
}

function createInput(
  candidate:
    BankrCandidate,

  overrides:
    Partial<
      AutomaticAgentRegistryInput
    > = {}
): AutomaticAgentRegistryInput {
  return {
    generatedAt:
      "2026-06-30T00:00:00.000Z",

    candidates: [
      candidate
    ],

    ownerDiscovery: {
      results:
        []
    },

    globalGitHubDiscovery: {
      results:
        []
    },

    ...overrides
  };
}

test(
  "verifies direct high-confidence primary GitHub evidence",
  () => {
    const candidate =
      createCandidate(
        {
          githubRepositories: [
            {
              owner:
                "ExampleOrg",

              repository:
                "example-agent",

              url:
                "https://github.com/ExampleOrg/example-agent",

              sources: [
                "website-page"
              ],

              relationship:
                "primary",

              confidence:
                "high",

              reasons: [
                "Official website links directly to the repository."
              ]
            }
          ]
        }
      );

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.status,
      "verified"
    );

    assert.equal(
      agent.github.selected
        ?.fullName,
      "ExampleOrg/example-agent"
    );

    assert.equal(
      agent.github.selected
        ?.scope,
      "primary"
    );

    assert.equal(
      agent.eligibility.agentScore,
      true
    );

    assert.equal(
      registry.summary
        .agentScoreEligible,
      1
    );
  }
);

test(
  "verifies one strong global GitHub identity match",
  () => {
    const candidate =
      createCandidate();

    const match = {
      owner:
        "exampleagent",

      repository:
        "exampleagent",

      fullName:
        "exampleagent/exampleagent",

      url:
        "https://github.com/exampleagent/exampleagent",

      role:
        "primary-candidate",

      score:
        85,

      status:
        "probable",

      probable:
        true,

      matchedBy: [
        "compact-slug"
      ],

      reasons: [
        "Repository and owner both exactly match the project identity."
      ]
    } as BankrGlobalGitHubRepositoryMatch;

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate,
          {
            globalGitHubDiscovery: {
              results: [
                {
                  bankrProfileId:
                    candidate.bankrProfileId,

                  candidates: [
                    match
                  ]
                }
              ]
            }
          }
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.status,
      "verified"
    );

    assert.equal(
      agent.github.selected
        ?.source,
      "global-search"
    );

    assert.equal(
      agent.eligibility.agentScore,
      true
    );
  }
);

test(
  "keeps ambiguous GitHub identities unresolved",
  () => {
    const candidate =
      createCandidate();

    const matches =
      [
        {
          owner:
            "owner-one",

          repository:
            "example-agent",

          fullName:
            "owner-one/example-agent",

          url:
            "https://github.com/owner-one/example-agent",

          role:
            "primary-candidate",

          score:
            65,

          status:
            "review",

          probable:
            false,

          matchedBy: [
            "project-name"
          ],

          reasons: [
            "Exact repository name match."
          ]
        },

        {
          owner:
            "owner-two",

          repository:
            "example-agent",

          fullName:
            "owner-two/example-agent",

          url:
            "https://github.com/owner-two/example-agent",

          role:
            "primary-candidate",

          score:
            60,

          status:
            "review",

          probable:
            false,

          matchedBy: [
            "project-name"
          ],

          reasons: [
            "Exact repository name match."
          ]
        }
      ] as BankrGlobalGitHubRepositoryMatch[];

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate,
          {
            globalGitHubDiscovery: {
              results: [
                {
                  bankrProfileId:
                    candidate.bankrProfileId,

                  candidates:
                    matches
                }
              ]
            }
          }
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.status,
      "unresolved"
    );

    assert.equal(
      agent.github.conflict,
      true
    );

    assert.equal(
      agent.github.selected,
      null
    );

    assert.equal(
      agent.eligibility.agentScore,
      false
    );
  }
);

test(
  "keeps a verified component out of Agent Score",
  () => {
    const candidate =
      createCandidate(
        {
          githubRepositories: [
            {
              owner:
                "ExampleOrg",

              repository:
                "example-sdk",

              url:
                "https://github.com/ExampleOrg/example-sdk",

              sources: [
                "product-url"
              ],

              relationship:
                "component",

              confidence:
                "high",

              reasons: [
                "Official product page links to the SDK."
              ]
            }
          ]
        }
      );

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.status,
      "verified"
    );

    assert.equal(
      agent.github.selected
        ?.scope,
      "component"
    );

    assert.equal(
      agent.eligibility.agentScore,
      false
    );

    assert.equal(
      agent.eligibility.tokenScore,
      true
    );
  }
);

test(
  "saves the automatic registry atomically",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "clarity-registry-"
        )
      );

    const outputPath =
      join(
        directory,
        "bankr-agents.json"
      );

    try {
      const registry =
        buildAutomaticAgentRegistry(
          createInput(
            createCandidate()
          )
        );

      const savedPath =
        await saveAutomaticAgentRegistry(
          registry,
          outputPath
        );

      assert.equal(
        savedPath,
        outputPath
      );

      const stored =
        JSON.parse(
          await readFile(
            outputPath,
            "utf8"
          )
        );

      assert.equal(
        stored.schemaVersion,
        "1.0"
      );

      assert.equal(
        stored.summary.total,
        1
      );

      assert.equal(
        stored.agents[0]
          .token
          .chainId,
        "base"
      );
    } finally {
      await rm(
        directory,
        {
          recursive:
            true,

          force:
            true
        }
      );
    }
  }
);

test(
  "demotes component-like direct repositories that were labelled primary",
  () => {
    const candidate =
      createCandidate(
        {
          githubRepositories: [
            {
              owner:
                "ExampleOrg",

              repository:
                "example-agent-skill",

              url:
                "https://github.com/ExampleOrg/example-agent-skill",

              sources: [
                "product-url"
              ],

              relationship:
                "primary",

              confidence:
                "high",

              reasons: [
                "The project links to this repository."
              ]
            }
          ]
        }
      );

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.selected
        ?.scope,
      "component"
    );

    assert.equal(
      agent.eligibility.agentScore,
      false
    );
  }
);

test(
  "prefers one exact project repository over similarly scored alternatives",
  () => {
    const candidate =
      createCandidate();

    const matches =
      [
        {
          owner:
            "example-agent",

          repository:
            "example-agent",

          fullName:
            "example-agent/example-agent",

          url:
            "https://github.com/example-agent/example-agent",

          role:
            "primary-candidate",

          score:
            65,

          status:
            "review",

          probable:
            false,

          matchedBy: [
            "project-name"
          ],

          reasons: [
            "Exact project identity."
          ]
        },

        {
          owner:
            "another-owner",

          repository:
            "example-agent-labs",

          fullName:
            "another-owner/example-agent-labs",

          url:
            "https://github.com/another-owner/example-agent-labs",

          role:
            "primary-candidate",

          score:
            70,

          status:
            "review",

          probable:
            false,

          matchedBy: [
            "project-name"
          ],

          reasons: [
            "Similar repository name."
          ]
        }
      ] as BankrGlobalGitHubRepositoryMatch[];

    const registry =
      buildAutomaticAgentRegistry(
        createInput(
          candidate,
          {
            globalGitHubDiscovery: {
              results: [
                {
                  bankrProfileId:
                    candidate.bankrProfileId,

                  candidates:
                    matches
                }
              ]
            }
          }
        )
      );

    const agent =
      registry.agents[0];

    assert.ok(agent);

    assert.equal(
      agent.github.conflict,
      false
    );

    assert.equal(
      agent.github.selected
        ?.fullName,
      "example-agent/example-agent"
    );
  }
);
