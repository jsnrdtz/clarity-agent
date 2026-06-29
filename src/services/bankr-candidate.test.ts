import assert from "node:assert/strict";
import test from "node:test";

import type {
  BankrAgentProfileDetail
} from "./bankr-client.js";

import {
  buildBankrCandidateReport,
  createBankrCandidate,
  extractBankrGitHubRepositories
} from "./bankr-candidate.js";

function createProfile(
  overrides:
    Partial<
      BankrAgentProfileDetail
    > = {}
): BankrAgentProfileDetail {
  return {
    id:
      "bankr-profile-1",

    slug:
      "example-agent",

    projectName:
      "Example Agent",

    description:
      "Example agent.",

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
      "https://example.com",

    productsCount:
      0,

    createdAt:
      "2026-06-28T00:00:00.000Z",

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
  "extracts and deduplicates GitHub repositories from Bankr evidence",
  () => {
    const profile =
      createProfile(
        {
          description:
            [
              "Source:",
              "https://github.com/ExampleOrg/MainRepo/issues/12",
              "Mirror github.com/exampleorg/mainrepo."
            ].join(" "),

          website:
            "https://github.com/ExampleOrg/MainRepo",

          teamMembers: [
            {
              name:
                "Builder",

              role:
                "Creator",

              links: [
                {
                  type:
                    "github",

                  url:
                    "https://github.com/BuilderOrg/AgentTools"
                },

                {
                  type:
                    "github",

                  url:
                    "https://github.com/BuilderOrg"
                }
              ]
            }
          ],

          products: [
            {
              name:
                "SDK",

              description:
                "Docs and source at github.com/ProductOrg/SDK.",

              url:
                "https://github.com/ProductOrg/SDK.git/tree/main"
            }
          ],

          projectUpdates: [
            {
              title:
                "New release",

              content:
                "Released from https://github.com/UpdateOrg/ReleaseRepo/releases/tag/v1.",

              createdAt:
                "2026-06-28T01:00:00.000Z"
            }
          ]
        }
      );

    const repositories =
      extractBankrGitHubRepositories(
        profile
      );

    assert.deepEqual(
      repositories.map(
        (repository) =>
          repository.url
      ),

      [
        "https://github.com/BuilderOrg/AgentTools",
        "https://github.com/ExampleOrg/MainRepo",
        "https://github.com/ProductOrg/SDK",
        "https://github.com/UpdateOrg/ReleaseRepo"
      ]
    );

    const mainRepository =
      repositories.find(
        (repository) =>
          repository.owner ===
            "ExampleOrg" &&
          repository.repository ===
            "MainRepo"
      );

    assert.deepEqual(
      mainRepository?.sources,
      [
        "website",
        "description"
      ]
    );

    const productRepository =
      repositories.find(
        (repository) =>
          repository.owner ===
            "ProductOrg" &&
          repository.repository ===
            "SDK"
      );

    assert.deepEqual(
      productRepository?.sources,
      [
        "product-url",
        "product-description"
      ]
    );
  }
);

test(
  "ignores GitHub owner pages and reserved GitHub routes",
  () => {
    const profile =
      createProfile(
        {
          description:
            [
              "Owner page:",
              "https://github.com/ExampleOrg",
              "Product page:",
              "https://github.com/features/actions"
            ].join(" "),

          website:
            "https://example.com"
        }
      );

    assert.deepEqual(
      extractBankrGitHubRepositories(
        profile
      ),
      []
    );
  }
);

test(
  "creates warnings for incomplete Bankr candidates",
  () => {
    const candidate =
      createBankrCandidate(
        createProfile(
          {
            description:
              undefined,

            website:
              undefined,

            twitterUsername:
              null,

            approved:
              false
          }
        )
      );

    assert.equal(
      candidate.source,
      "bankr"
    );

    assert.equal(
      candidate.description,
      null
    );

    assert.equal(
      candidate.website,
      null
    );

    assert.equal(
      candidate.twitterUsername,
      null
    );

    assert.deepEqual(
      candidate.githubRepositories,
      []
    );

    assert.deepEqual(
      candidate.warnings,
      [
        "missing-description",
        "missing-website",
        "missing-twitter",
        "no-github-repository",
        "unapproved-profile"
      ]
    );
  }
);

test(
  "keeps separate candidates that share one token identity",
  () => {
    const sharedTokenAddress =
      `0x${"12".repeat(20)}`;

    const firstProfile =
      createProfile(
        {
          id:
            "smart-profile-2",

          slug:
            "smartcodedbot-2",

          projectName:
            "SmartCodedBot",

          tokenAddress:
            sharedTokenAddress
        }
      );

    const secondProfile =
      createProfile(
        {
          id:
            "smart-profile-3",

          slug:
            "smartcodedbot-3",

          projectName:
            "SmartCodedBot",

          tokenAddress:
            sharedTokenAddress
        }
      );

    const report =
      buildBankrCandidateReport(
        [
          firstProfile,
          secondProfile
        ],
        "2026-06-28T12:00:00.000Z"
      );

    assert.equal(
      report.profilesReceived,
      2
    );

    assert.equal(
      report.candidates.length,
      2
    );

    assert.equal(
      report.conflicts
        .profileIds
        .length,
      0
    );

    assert.equal(
      report.conflicts
        .slugs
        .length,
      0
    );

    assert.deepEqual(
      report.conflicts
        .tokenIdentities,
      [
        {
          key:
            `base:${sharedTokenAddress}`,

          profileIds: [
            "smart-profile-2",
            "smart-profile-3"
          ],

          slugs: [
            "smartcodedbot-2",
            "smartcodedbot-3"
          ]
        }
      ]
    );

    for (
      const candidate
      of report.candidates
    ) {
      assert.ok(
        candidate
          .warnings
          .includes(
            "shared-token-identity"
          )
      );
    }
  }
);

test(
  "reports duplicate Bankr IDs and slugs without merging profiles",
  () => {
    const report =
      buildBankrCandidateReport(
        [
          createProfile(
            {
              id:
                "duplicate-id",

              slug:
                "Duplicate-Slug",

              tokenAddress:
                `0x${"34".repeat(20)}`
            }
          ),

          createProfile(
            {
              id:
                "duplicate-id",

              slug:
                "duplicate-slug",

              tokenAddress:
                `0x${"56".repeat(20)}`
            }
          )
        ],
        "2026-06-28T12:00:00.000Z"
      );

    assert.equal(
      report.candidates.length,
      2
    );

    assert.deepEqual(
      report.conflicts.profileIds,
      [
        {
          key:
            "duplicate-id",

          profileIds: [
            "duplicate-id",
            "duplicate-id"
          ],

          slugs: [
            "Duplicate-Slug",
            "duplicate-slug"
          ]
        }
      ]
    );

    assert.deepEqual(
      report.conflicts.slugs,
      [
        {
          key:
            "duplicate-slug",

          profileIds: [
            "duplicate-id",
            "duplicate-id"
          ],

          slugs: [
            "Duplicate-Slug",
            "duplicate-slug"
          ]
        }
      ]
    );
  }
);


test(
  "stores repository relationship classification in the Bankr candidate",
  () => {
    const candidate =
      createBankrCandidate(
        createProfile(
          {
            description:
              "Source code: https://github.com/ExampleOrg/MainAgent",

            website:
              "https://github.com/ExampleOrg/MainAgent"
          }
        )
      );

    assert.equal(
      candidate.githubRepositories.length,
      1
    );

    assert.deepEqual(
      candidate.githubRepositories[0],
      {
        owner:
          "ExampleOrg",

        repository:
          "MainAgent",

        url:
          "https://github.com/ExampleOrg/MainAgent",

        sources: [
          "website",
          "description"
        ],

        relationship:
          "primary",

        confidence:
          "high",

        reasons: [
          "A first-party URL field points directly to the repository.",
          "Evidence source: website."
        ]
      }
    );
  }
);

test(
  "does not treat an integration repository as the candidate primary repository",
  () => {
    const candidate =
      createBankrCandidate(
        createProfile(
          {
            description:
              "Compatible with Aeon: https://github.com/aaronjmars/aeon",

            website:
              "https://vigil.example"
          }
        )
      );

    assert.equal(
      candidate.githubRepositories.length,
      1
    );

    assert.equal(
      candidate
        .githubRepositories[0]
        ?.relationship,
      "integration"
    );

    assert.equal(
      candidate
        .githubRepositories[0]
        ?.confidence,
      "low"
    );
  }
);

test(
  "prefers stronger direct repository evidence when sources disagree",
  () => {
    const candidate =
      createBankrCandidate(
        createProfile(
          {
            description:
              "Compatible with another tool: https://github.com/ExampleOrg/Agent",

            website:
              "https://github.com/ExampleOrg/Agent"
          }
        )
      );

    const repository =
      candidate.githubRepositories[0];

    assert.equal(
      repository?.relationship,
      "primary"
    );

    assert.equal(
      repository?.confidence,
      "high"
    );

    assert.deepEqual(
      repository?.sources,
      [
        "website",
        "description"
      ]
    );
  }
);
