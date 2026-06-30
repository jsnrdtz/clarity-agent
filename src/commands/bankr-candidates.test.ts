import assert from "node:assert/strict";
import test from "node:test";

import {
  runBankrCandidatesCommand
} from "./bankr-candidates.js";

import type {
  BankrCandidateImportReport
} from "../services/bankr-candidate-import.js";

function createReport(
  failures = 0
): BankrCandidateImportReport {
  return {
    schemaVersion:
      "1.0",

    source:
      "bankr",

    generatedAt:
      "2026-06-29T12:00:00.000Z",

    profilesListed:
      1,

    detailsLoaded:
      failures === 0
        ? 1
        : 0,

    failures:
      failures === 0
        ? []
        : [
            {
              bankrProfileId:
                "profile-1",

              bankrSlug:
                "example-agent",

              code:
                "BANKR_HTTP_ERROR",

              message:
                "Request failed.",

              retryable:
                true
            }
          ],

    candidates:
      [],

    warnings:
      [],

    conflicts: {
      profileIds:
        [],

      slugs:
        [],

      tokenIdentities:
        []
    },

    websiteDiscovery: {
      skippedExistingGitHub:
        0,

      skippedNoWebsite:
        0,

      skippedSocialWebsite:
        0,

      attempted:
        0,

      found:
        0,

      ownerOnly:
        0,

      notFound:
        0,

      failed:
        0,

      repositoriesFound:
        0,

      ownerPagesFound:
        0,

      results:
        []
    },

    ownerDiscovery: {
      enabled:
        true,

      skippedNoToken:
        0,

      attempted:
        0,

      probable:
        0,

      review:
        0,

      notFound:
        0,

      failed:
        0,

      candidatesFound:
        0,

      results:
        []
    },

    githubEvidence: {
      candidatesWithGitHub:
        0,

      candidatesWithoutGitHub:
        0,

      classifiedRepositories:
        0,

      uniqueRepositories:
        0,

      relationships: {
        primary:
          0,

        component:
          0,

        integration:
          0,

        dependency:
          0,

        example:
          0,

        unknown:
          0
      },

      confidences: {
        high:
          0,

        medium:
          0,

        low:
          0
      }
    }
  };
}

test(
  "prints a JSON Bankr candidate report",
  async () => {
    const report =
      createReport();

    const result =
      await runBankrCandidatesCommand(
        true,
        {
          runImport:
            async () => ({
              report,

              outputPath:
                "data/candidates/bankr.json"
            })
        }
      );

    assert.deepEqual(
      JSON.parse(
        result.output
      ),
      report
    );

    assert.equal(
      result.hasFailures,
      false
    );
  }
);

test(
  "marks the command as failed when profile details fail",
  async () => {
    const result =
      await runBankrCandidatesCommand(
        false,
        {
          runImport:
            async () => ({
              report:
                createReport(1),

              outputPath:
                "data/candidates/bankr.json"
            })
        }
      );

    assert.equal(
      result.hasFailures,
      true
    );

    assert.match(
      result.output,
      /Profile failures: 1/
    );
  }
);
