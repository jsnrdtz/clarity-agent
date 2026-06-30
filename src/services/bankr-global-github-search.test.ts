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
