import assert from "node:assert/strict";
import test from "node:test";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

import {
  buildBankrGlobalGitHubQueries,
  discoverBankrCandidateGlobalGitHub,
  rankBankrGlobalGitHubRepositories
} from "./bankr-global-github-search.js";

import type {
  BankrGlobalGitHubSearchRepository
} from "./bankr-global-github-search.js";

function createCandidate(
  overrides:
    Partial<
      BankrCandidate
    > = {}
): BankrCandidate {
  return {
    source:
      "bankr",

    bankrProfileId:
      "profile-orlix",

    bankrSlug:
      "orlix-ai",

    name:
      "Orlix AI",

    description:
      "Personal AI operating system.",

    token: {
      chainId:
        "base",

      address:
        `0x${"ab".repeat(20)}`,

      identity:
        `base:0x${"ab".repeat(20)}`,

      symbol:
        "ORLIX",

      name:
        "Orlix"
    },

    twitterUsername:
      "orlix_ai",

    website:
      "https://orlix.ai",

    marketCapUsd:
      10_000,

    weeklyRevenueWeth:
      null,

    createdAt:
      "2026-06-01T00:00:00.000Z",

    githubRepositories:
      [],

    warnings: [
      "no-github-repository"
    ],

    ...overrides
  };
}

function createRepository(
  overrides:
    Partial<
      BankrGlobalGitHubSearchRepository
    > = {}
): BankrGlobalGitHubSearchRepository {
  return {
    owner:
      "tylerbroqs",

    repository:
      "orlixai",

    fullName:
      "tylerbroqs/orlixai",

    url:
      "https://github.com/tylerbroqs/orlixai",

    description:
      "Personal AI Operating System.",

    homepage:
      "https://orlix.ai",

    language:
      "TypeScript",

    stars:
      8,

    forks:
      1,

    openIssues:
      0,

    pushedAt:
      new Date()
        .toISOString(),

    fork:
      false,

    archived:
      false,

    disabled:
      false,

    ...overrides
  };
}

test(
  "builds project name, compact slug, and official domain searches",
  () => {
    const queries =
      buildBankrGlobalGitHubQueries(
        createCandidate()
      );

    assert.deepEqual(
      queries.map(
        (query) =>
          query.source
      ),
      [
        "project-name",
        "compact-slug",
        "official-domain"
      ]
    );

    assert.match(
      queries[0]
        ?.query ??
        "",
      /"Orlix AI"/
    );

    assert.match(
      queries[1]
        ?.query ??
        "",
      /orlixai/
    );

    assert.match(
      queries[2]
        ?.query ??
        "",
      /orlix\.ai/
    );
  }
);

test(
  "ranks an exact repository with the official homepage as probable",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(),

        [
          {
            repository:
              createRepository(),

            matchedBy: [
              "project-name",
              "compact-slug",
              "official-domain"
            ]
          }
        ]
      );

    assert.equal(
      matches.length,
      1
    );

    assert.equal(
      matches[0]
        ?.status,
      "probable"
    );

    assert.equal(
      matches[0]
        ?.probable,
      true
    );

    assert.equal(
      matches[0]
        ?.role,
      "primary-candidate"
    );

    assert.equal(
      matches[0]
        ?.score,
      100
    );
  }
);

test(
  "penalizes a component repository",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(),

        [
          {
            repository:
              createRepository(
                {
                  repository:
                    "orlixai-sdk",

                  fullName:
                    "tylerbroqs/orlixai-sdk",

                  url:
                    "https://github.com/tylerbroqs/orlixai-sdk",

                  description:
                    "TypeScript SDK and client library for Orlix AI.",

                  homepage:
                    null,

                  stars:
                    0
                }
              ),

            matchedBy: [
              "project-name"
            ]
          }
        ]
      );

    assert.equal(
      matches[0]
        ?.role,
      "component"
    );

    assert.notEqual(
      matches[0]
        ?.status,
      "probable"
    );

    assert.ok(
      (
        matches[0]
          ?.score ??
        100
      ) < 80
    );
  }
);

test(
  "penalizes website repositories",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(),

        [
          {
            repository:
              createRepository(
                {
                  repository:
                    "orlix-site",

                  fullName:
                    "tylerbroqs/orlix-site",

                  url:
                    "https://github.com/tylerbroqs/orlix-site",

                  description:
                    "Official Orlix landing page and website.",

                  stars:
                    0
                }
              ),

            matchedBy: [
              "project-name",
              "official-domain"
            ]
          }
        ]
      );

    assert.equal(
      matches[0]
        ?.role,
      "website"
    );

    assert.notEqual(
      matches[0]
        ?.status,
      "probable"
    );
  }
);

test(
  "deduplicates repositories found by multiple search queries",
  async () => {
    const calls:
      string[] =
      [];

    const repository =
      createRepository();

    const discovery =
      await discoverBankrCandidateGlobalGitHub(
        createCandidate(),

        async (
          query
        ) => {
          calls.push(
            query
          );

          return [
            repository
          ];
        }
      );

    assert.equal(
      calls.length,
      3
    );

    assert.equal(
      discovery.repositoriesFound,
      1
    );

    assert.equal(
      discovery.candidates.length,
      1
    );

    assert.deepEqual(
      discovery
        .candidates[0]
        ?.matchedBy,
      [
        "compact-slug",
        "official-domain",
        "project-name"
      ]
    );
  }
);

test(
  "does not create an official-domain query for a GitHub website",
  () => {
    const queries =
      buildBankrGlobalGitHubQueries(
        createCandidate(
          {
            website:
              "https://github.com/example/project"
          }
        )
      );

    assert.equal(
      queries.some(
        (query) =>
          query.source ===
            "official-domain"
      ),
      false
    );
  }
);

test(
  "does not promote an exact-name search-only match to probable",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(
          {
            name:
              "Echo",

            bankrSlug:
              "echo",

            website:
              "https://builtbyecho.xyz"
          }
        ),

        [
          {
            repository:
              createRepository(
                {
                  owner:
                    "snowykte0426",

                  repository:
                    "echo",

                  fullName:
                    "snowykte0426/echo",

                  url:
                    "https://github.com/snowykte0426/echo",

                  description:
                    "Echo: 2D RPG",

                  homepage:
                    null,

                  stars:
                    1
                }
              ),

            matchedBy: [
              "project-name"
            ]
          }
        ]
      );

    assert.equal(
      matches[0]
        ?.status,
      "weak"
    );

    assert.equal(
      matches[0]
        ?.role,
      "unknown"
    );

    assert.equal(
      matches[0]
        ?.probable,
      false
    );
  }
);

test(
  "treats an exact owner and repository identity as strong evidence",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(
          {
            name:
              "Claw Harbor",

            bankrSlug:
              "claw-harbor",

            website:
              null
          }
        ),

        [
          {
            repository:
              createRepository(
                {
                  owner:
                    "clawharbor",

                  repository:
                    "clawharbor",

                  fullName:
                    "clawharbor/clawharbor",

                  url:
                    "https://github.com/clawharbor/clawharbor",

                  description:
                    null,

                  homepage:
                    null,

                  stars:
                    15
                }
              ),

            matchedBy: [
              "compact-slug"
            ]
          }
        ]
      );

    assert.equal(
      matches[0]
        ?.role,
      "primary-candidate"
    );

    assert.equal(
      matches[0]
        ?.status,
      "probable"
    );

    assert.equal(
      matches[0]
        ?.probable,
      true
    );
  }
);

test(
  "downgrades ambiguous repositories with similar scores",
  () => {
    const candidate =
      createCandidate(
        {
          name:
            "ForgeOracle",

          bankrSlug:
            "forgeoracle",

          website:
            "https://mythosforge.xyz"
        }
      );

    const matches =
      rankBankrGlobalGitHubRepositories(
        candidate,

        [
          "owner-one",
          "owner-two",
          "owner-three"
        ].map(
          (owner) => ({
            repository:
              createRepository(
                {
                  owner,

                  repository:
                    "forgeoracle",

                  fullName:
                    `${owner}/forgeoracle`,

                  url:
                    `https://github.com/${owner}/forgeoracle`,

                  description:
                    "ForgeOracle dApp on a test network.",

                  homepage:
                    null,

                  stars:
                    0
                }
              ),

            matchedBy: [
              "project-name",
              "compact-slug"
            ]
          })
        )
      );

    assert.equal(
      matches.length,
      3
    );

    assert.equal(
      matches.every(
        (match) =>
          match.status ===
            "weak"
      ),
      true
    );

    assert.match(
      matches[0]
        ?.reasons
        .join(
          " "
        ) ??
        "",

      /ambiguity/u
    );
  }
);

test(
  "never marks a component as probable even with official evidence",
  () => {
    const matches =
      rankBankrGlobalGitHubRepositories(
        createCandidate(
          {
            name:
              "molty.cash",

            bankrSlug:
              "moltycash",

            website:
              "https://molty.cash"
          }
        ),

        [
          {
            repository:
              createRepository(
                {
                  owner:
                    "moltycash",

                  repository:
                    "moltycash-cli",

                  fullName:
                    "moltycash/moltycash-cli",

                  url:
                    "https://github.com/moltycash/moltycash-cli",

                  description:
                    null,

                  homepage:
                    "https://molty.cash",

                  stars:
                    1
                }
              ),

            matchedBy: [
              "project-name",
              "compact-slug",
              "official-domain"
            ]
          }
        ]
      );

    assert.equal(
      matches[0]
        ?.role,
      "component"
    );

    assert.equal(
      matches[0]
        ?.status,
      "review"
    );

    assert.equal(
      matches[0]
        ?.probable,
      false
    );
  }
);
