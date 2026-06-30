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

test(
  "enriches a Bankr candidate from its official website",
  async () => {
    const report =
      await generateBankrCandidateImportReport(
        {
          listProfiles:
            async () => [
              createSummary(
                "profile-website",
                "website-agent"
              )
            ],

          getProfile:
            async () =>
              createDetail(
                {
                  id:
                    "profile-website",

                  slug:
                    "website-agent",

                  description:
                    "No repository is listed here.",

                  website:
                    "https://agent.example"
                }
              ),

          discoverWebsite:
            async (
              websiteUrl
            ) => ({
              requestedUrl:
                websiteUrl,

              finalUrl:
                websiteUrl,

              redirects:
                0,

              bytesRead:
                300,

              repositories: [
                {
                  owner:
                    "ExampleOrg",

                  repository:
                    "WebsiteAgent",

                  url:
                    "https://github.com/ExampleOrg/WebsiteAgent",

                  sources: [
                    "website-page"
                  ],

                  relationship:
                    "primary",

                  confidence:
                    "high",

                  reasons: [
                    "Official website source."
                  ]
                }
              ],

              ownerUrls: [
                "https://github.com/ExampleOrg"
              ]
            }),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    assert.equal(
      report
        .websiteDiscovery
        .attempted,
      1
    );

    assert.equal(
      report
        .websiteDiscovery
        .found,
      1
    );

    assert.equal(
      report
        .githubEvidence
        .candidatesWithGitHub,
      1
    );

    assert.deepEqual(
      report
        .candidates[0]
        ?.githubRepositories
        .map(
          (repository) =>
            repository.url
        ),
      [
        "https://github.com/ExampleOrg/WebsiteAgent"
      ]
    );

    assert.equal(
      report
        .candidates[0]
        ?.warnings
        .includes(
          "no-github-repository"
        ),
      false
    );
  }
);

test(
  "continues after an official website scan fails",
  async () => {
    const report =
      await generateBankrCandidateImportReport(
        {
          listProfiles:
            async () => [
              createSummary(
                "profile-broken-site",
                "broken-site-agent"
              )
            ],

          getProfile:
            async () =>
              createDetail(
                {
                  id:
                    "profile-broken-site",

                  slug:
                    "broken-site-agent",

                  description:
                    "No GitHub link.",

                  website:
                    "https://broken.example"
                }
              ),

          discoverWebsite:
            async () => {
              throw Object.assign(
                new Error(
                  "Website timed out."
                ),
                {
                  code:
                    "WEBSITE_TIMEOUT",

                  retryable:
                    true
                }
              );
            },

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    assert.equal(
      report
        .websiteDiscovery
        .failed,
      1
    );

    assert.equal(
      report
        .candidates
        .length,
      1
    );

    assert.equal(
      report
        .candidates[0]
        ?.warnings
        .includes(
          "no-github-repository"
        ),
      true
    );

    assert.equal(
      report
        .websiteDiscovery
        .results[0]
        ?.error
        ?.code,
      "WEBSITE_TIMEOUT"
    );
  }
);

test(
  "skips GitHub owner discovery when authenticated access is disabled",
  async () => {
    let ownerDiscoveryCalls =
      0;

    const report =
      await generateBankrCandidateImportReport(
        {
          listProfiles:
            async () => [
              createSummary(
                "profile-owner-only",
                "owner-only-agent"
              )
            ],

          getProfile:
            async () =>
              createDetail(
                {
                  id:
                    "profile-owner-only",

                  slug:
                    "owner-only-agent",

                  projectName:
                    "Owner Only Agent",

                  description:
                    "No direct repository link.",

                  website:
                    "https://agent.example"
                }
              ),

          discoverWebsite:
            async (
              websiteUrl
            ) => ({
              requestedUrl:
                websiteUrl,

              finalUrl:
                websiteUrl,

              redirects:
                0,

              bytesRead:
                200,

              repositories:
                [],

              ownerUrls: [
                "https://github.com/example-agent"
              ]
            }),

          discoverOwner:
            async () => {
              ownerDiscoveryCalls +=
                1;

              throw new Error(
                "Owner discovery must not run."
              );
            },

          ownerDiscoveryEnabled:
            false,

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    assert.equal(
      ownerDiscoveryCalls,
      0
    );

    assert.equal(
      report
        .ownerDiscovery
        .enabled,
      false
    );

    assert.equal(
      report
        .ownerDiscovery
        .skippedNoToken,
      1
    );

    assert.equal(
      report
        .ownerDiscovery
        .attempted,
      0
    );
  }
);
