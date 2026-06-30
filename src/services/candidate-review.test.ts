import assert from "node:assert/strict";

import {
  rm
} from "node:fs/promises";
import test from "node:test";

import {
  buildCandidateReviewView,
  loadCandidateReviewState,
  updateCandidateReviewsBatch
} from "./candidate-review.js";

import type {
  CandidateReviewState
} from "./candidate-review.js";

import type {
  BankrCandidateImportReport
} from "./bankr-candidate-import.js";

function createReport(
  includeDirectRepository =
    false
): BankrCandidateImportReport {
  const repositoryUrl =
    "https://github.com/example-agent/example-agent";

  const report = {
    generatedAt:
      "2026-06-30T12:00:00.000Z",

    candidates: [
      {
        bankrProfileId:
          "profile-example",

        bankrSlug:
          "example-agent",

        name:
          "Example Agent",

        description:
          "Autonomous Example Agent.",

        githubRepositories:
          includeDirectRepository
            ? [
                {
                  owner:
                    "example-agent",

                  repository:
                    "example-agent",

                  url:
                    repositoryUrl,

                  sources: [
                    "bankr-profile"
                  ],

                  relationship:
                    "primary",

                  confidence:
                    "high",

                  reasons: [
                    "Direct repository evidence."
                  ]
                }
              ]
            : []
      }
    ],

    ownerDiscovery: {
      results:
        []
    },

    globalGitHubDiscovery: {
      results: [
        {
          bankrProfileId:
            "profile-example",

          bankrSlug:
            "example-agent",

          status:
            "probable",

          queries: [
            {
              source:
                "project-name",

              query:
                "\"Example Agent\" in:name,description,readme"
            },

            {
              source:
                "compact-slug",

              query:
                "exampleagent in:name,description,readme"
            }
          ],

          repositoriesFound:
            1,

          candidates: [
            {
              owner:
                "example-agent",

              repository:
                "example-agent",

              fullName:
                "example-agent/example-agent",

              url:
                repositoryUrl,

              role:
                "primary-candidate",

              score:
                95,

              probable:
                true,

              matchedBy: [
                "compact-slug",
                "project-name"
              ],

              reasons: [
                "Repository name exactly matches the project identity."
              ]
            }
          ],

          error:
            null
        }
      ]
    }
  };

  return report as unknown as
    BankrCandidateImportReport;
}

function createState():
CandidateReviewState {
  return {
    schemaVersion:
      "1.0",

    updatedAt:
      null,

    decisions:
      []
  };
}

test(
  "adds global GitHub matches to the candidate review queue",
  () => {
    const view =
      buildCandidateReviewView(
        createReport(),
        createState()
      );

    assert.equal(
      view.counts.total,
      1
    );

    const item =
      view.items[0];

    assert.ok(item);

    assert.equal(
      item.source,
      "global-github-search"
    );

    assert.equal(
      item.suggestedScope,
      "primary"
    );

    assert.equal(
      item.evidence.score,
      95
    );

    assert.deepEqual(
      item.evidence.matchedBy,
      [
        "compact-slug",
        "project-name"
      ]
    );

    assert.deepEqual(
      item.evidence.queries,
      [
        "project-name: \"Example Agent\" in:name,description,readme",
        "compact-slug: exampleagent in:name,description,readme"
      ]
    );
  }
);

test(
  "keeps direct evidence when global search finds the same repository",
  () => {
    const view =
      buildCandidateReviewView(
        createReport(
          true
        ),

        createState()
      );

    assert.equal(
      view.counts.total,
      1
    );

    const item =
      view.items[0];

    assert.ok(item);

    assert.equal(
      item.source,
      "direct"
    );

    assert.equal(
      item.evidence.relationship,
      "primary"
    );

    assert.deepEqual(
      item.evidence.matchedBy,
      []
    );

    assert.deepEqual(
      item.evidence.queries,
      []
    );
  }
);

test(
  "validates candidate review batches before one atomic state write",
  async () => {
    const report =
      createReport(
        true
      );

    const candidate =
      report.candidates[0];

    assert.ok(
      candidate
    );

    candidate
      .githubRepositories
      .push(
        {
          owner:
            "example-agent",

          repository:
            "example-agent-tools",

          url:
            "https://github.com/example-agent/example-agent-tools",

          sources: [
            "website-page"
          ],

          relationship:
            "component",

          confidence:
            "medium",

          reasons: [
            "Additional project repository."
          ]
        }
      );

    const reviewPath =
      `/tmp/clarity-review-batch-${process.pid}-${Date.now()}.json`;

    const previousPath =
      process.env
        .CLARITY_CANDIDATE_REVIEW_PATH;

    process.env
      .CLARITY_CANDIDATE_REVIEW_PATH =
      reviewPath;

    try {
      await assert.rejects(
        updateCandidateReviewsBatch(
          report,
          [
            {
              bankrProfileId:
                "profile-example",

              repositoryUrl:
                "https://github.com/example-agent/example-agent",

              decision:
                "approve",

              note:
                "Verified primary."
            },

            {
              bankrProfileId:
                "profile-example",

              repositoryUrl:
                "https://github.com/example-agent/not-in-report",

              decision:
                "approve",

              note:
                null
            }
          ]
        )
      );

      const stateAfterFailure =
        await loadCandidateReviewState(
          reviewPath
        );

      assert.equal(
        stateAfterFailure
          .decisions
          .length,
        0
      );

      const view =
        await updateCandidateReviewsBatch(
          report,
          [
            {
              bankrProfileId:
                "profile-example",

              repositoryUrl:
                "https://github.com/example-agent/example-agent",

              decision:
                "approve",

              note:
                "Verified primary."
            },

            {
              bankrProfileId:
                "profile-example",

              repositoryUrl:
                "https://github.com/example-agent/example-agent-tools",

              decision:
                "reject",

              note:
                "Component only."
            }
          ]
        );

      assert.equal(
        view.counts.approved,
        1
      );

      assert.equal(
        view.counts.rejected,
        1
      );

      const stored =
        await loadCandidateReviewState(
          reviewPath
        );

      assert.equal(
        stored.decisions.length,
        2
      );

      assert.equal(
        stored.decisions[0]
          ?.decidedAt,
        stored.decisions[1]
          ?.decidedAt
      );
    } finally {
      if (
        previousPath ===
          undefined
      ) {
        delete process
          .env
          .CLARITY_CANDIDATE_REVIEW_PATH;
      } else {
        process.env
          .CLARITY_CANDIDATE_REVIEW_PATH =
          previousPath;
      }

      await rm(
        reviewPath,
        {
          force:
            true
        }
      );
    }
  }
);

