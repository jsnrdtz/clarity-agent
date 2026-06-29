import assert from "node:assert/strict";

import {
  mkdtemp,
  readFile,
  readdir,
  rm
} from "node:fs/promises";

import {
  tmpdir
} from "node:os";

import {
  join
} from "node:path";

import test from "node:test";

import {
  generateBankrCandidateImportReport,
  saveBankrCandidateImportReport
} from "./bankr-candidate-import.js";

import type {
  BankrAgentProfileDetail,
  BankrAgentProfileSummary
} from "./bankr-client.js";

function createSummary(
  id: string,
  slug: string
): BankrAgentProfileSummary {
  return {
    id,
    slug
  } as BankrAgentProfileSummary;
}

function createDetail(
  overrides:
    Partial<
      BankrAgentProfileDetail
    > = {}
): BankrAgentProfileDetail {
  return {
    id:
      "profile-1",

    slug:
      "example-agent",

    projectName:
      "Example Agent",

    description:
      "Official repository: https://github.com/ExampleOrg/Agent",

    profileImageUrl:
      "https://example.com/image.png",

    projectImages:
      [],

    tokenAddress:
      `0x${"ab".repeat(20)}`,

    tokenChainId:
      "base",

    tokenSymbol:
      "EXAMPLE",

    tokenName:
      "Example Token",

    marketCapUsd:
      10_000,

    weeklyRevenueWeth:
      "0.25",

    twitterUsername:
      "example_agent",

    website:
      "https://github.com/ExampleOrg/Agent",

    productsCount:
      0,

    createdAt:
      "2026-06-29T00:00:00.000Z",

    teamMembers:
      [],

    products:
      [],

    revenueSources:
      [],

    projectUpdates:
      [],

    approved:
      true,

    ...overrides
  };
}

test(
  "continues after one Bankr profile detail fails",
  async () => {
    const report =
      await generateBankrCandidateImportReport(
        {
          listProfiles:
            async () => [
              createSummary(
                "profile-1",
                "example-agent"
              ),

              createSummary(
                "profile-2",
                "broken-agent"
              )
            ],

          getProfile:
            async (
              identifier
            ) => {
              if (
                identifier ===
                "broken-agent"
              ) {
                throw Object.assign(
                  new Error(
                    "Bankr request failed."
                  ),

                  {
                    code:
                      "BANKR_HTTP_ERROR",

                    retryable:
                      true
                  }
                );
              }

              return createDetail();
            },

          now:
            () =>
              "2026-06-29T12:00:00.000Z"
        }
      );

    assert.equal(
      report.schemaVersion,
      "1.0"
    );

    assert.equal(
      report.profilesListed,
      2
    );

    assert.equal(
      report.detailsLoaded,
      1
    );

    assert.equal(
      report.candidates.length,
      1
    );

    assert.deepEqual(
      report.failures,
      [
        {
          bankrProfileId:
            "profile-2",

          bankrSlug:
            "broken-agent",

          code:
            "BANKR_HTTP_ERROR",

          message:
            "Bankr request failed.",

          retryable:
            true
        }
      ]
    );

    assert.equal(
      report
        .githubEvidence
        .candidatesWithGitHub,
      1
    );

    assert.equal(
      report
        .githubEvidence
        .relationships
        .primary,
      1
    );
  }
);

test(
  "saves the Bankr candidate report atomically",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "clarity-bankr-"
        )
      );

    try {
      const report =
        await generateBankrCandidateImportReport(
          {
            listProfiles:
              async () => [
                createSummary(
                  "profile-1",
                  "example-agent"
                )
              ],

            getProfile:
              async () =>
                createDetail(),

            now:
              () =>
                "2026-06-29T12:00:00.000Z"
          }
        );

      const outputPath =
        join(
          directory,
          "nested",
          "bankr.json"
        );

      await saveBankrCandidateImportReport(
        report,
        outputPath
      );

      const parsed =
        JSON.parse(
          await readFile(
            outputPath,
            "utf8"
          )
        ) as {
          schemaVersion?: string;
          candidates?: unknown[];
        };

      assert.equal(
        parsed.schemaVersion,
        "1.0"
      );

      assert.equal(
        parsed.candidates?.length,
        1
      );

      const files =
        await readdir(
          join(
            directory,
            "nested"
          )
        );

      assert.deepEqual(
        files,
        [
          "bankr.json"
        ]
      );
    } finally {
      await rm(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
