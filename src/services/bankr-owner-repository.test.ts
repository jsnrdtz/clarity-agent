import assert from "node:assert/strict";
import test from "node:test";

import {
  parseGitHubOwnerUrl,
  rankBankrOwnerRepositories
} from "./bankr-owner-repository.js";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

import type {
  GitHubOwnerDiscovery
} from "./github-discovery.js";

function createCandidate():
BankrCandidate {
  return {
    source:
      "bankr",

    bankrProfileId:
      "profile-1",

    bankrSlug:
      "polygraph",

    name:
      "Polygraph",

    description:
      "Agent intelligence.",

    token: {
      chainId:
        "base",

      address:
        `0x${"ab".repeat(20)}`,

      identity:
        `base:0x${"ab".repeat(20)}`,

      symbol:
        "POLY",

      name:
        "Polygraph"
    },

    twitterUsername:
      "polygraphso",

    website:
      "https://www.polygraph.so",

    marketCapUsd:
      10_000,

    weeklyRevenueWeth:
      null,

    createdAt:
      "2026-06-30T00:00:00.000Z",

    githubRepositories:
      [],

    warnings: [
      "no-github-repository"
    ]
  };
}

function createDiscovery():
GitHubOwnerDiscovery {
  return {
    owner:
      "polygraphso",

    ownerType:
      "Organization",

    profileUrl:
      "https://github.com/polygraphso",

    repositoriesFound:
      2,

    repositoriesCapped:
      false,

    candidates: [
      {
        owner:
          "polygraphso",

        name:
          "polygraph",

        fullName:
          "polygraphso/polygraph",

        description:
          "Polygraph agent infrastructure.",

        url:
          "https://github.com/polygraphso/polygraph",

        homepage:
          "https://www.polygraph.so",

        language:
          "TypeScript",

        stars:
          10,

        forks:
          1,

        openIssues:
          0,

        pushedAt:
          new Date().toISOString(),

        daysSincePush:
          0,

        fork:
          false,

        archived:
          false,

        disabled:
          false,

        role:
          "unknown",

        roleReason:
          "Not enough metadata.",

        excluded:
          false,

        exclusionReason:
          null
      },

      {
        owner:
          "polygraphso",

        name:
          "unrelated-tools",

        fullName:
          "polygraphso/unrelated-tools",

        description:
          "Generic utilities.",

        url:
          "https://github.com/polygraphso/unrelated-tools",

        homepage:
          null,

        language:
          "TypeScript",

        stars:
          0,

        forks:
          0,

        openIssues:
          0,

        pushedAt:
          null,

        daysSincePush:
          null,

        fork:
          false,

        archived:
          false,

        disabled:
          false,

        role:
          "unknown",

        roleReason:
          "Not enough metadata.",

        excluded:
          false,

        exclusionReason:
          null
      }
    ],

    excluded:
      [],

    collectedAt:
      "2026-06-30T00:00:00.000Z"
  };
}

test(
  "rejects asset URLs as GitHub owners",
  () => {
    assert.equal(
      parseGitHubOwnerUrl(
        "https://github.com/aleisterai.png"
      ),
      null
    );
  }
);

test(
  "ranks an exact project repository as probable",
  () => {
    const matches =
      rankBankrOwnerRepositories(
        createCandidate(),
        createDiscovery()
      );

    assert.equal(
      matches[0]?.repository,
      "polygraph"
    );

    assert.equal(
      matches[0]?.probable,
      true
    );

    assert.ok(
      (
        matches[0]?.score ??
        0
      ) >= 60
    );
  }
);

test(
  "does not mark a website repository as probable",
  () => {
    const discovery =
      createDiscovery();

    const repository =
      discovery.candidates[0];

    assert.ok(
      repository
    );

    repository.role =
      "website";

    repository.roleReason =
      "Repository contains the project website.";

    const matches =
      rankBankrOwnerRepositories(
        createCandidate(),
        discovery
      );

    assert.equal(
      matches[0]?.repository,
      "polygraph"
    );

    assert.equal(
      matches[0]?.probable,
      false
    );

    assert.ok(
      (
        matches[0]?.score ??
        100
      ) < 60
    );
  }
);
