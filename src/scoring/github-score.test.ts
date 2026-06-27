import assert from "node:assert/strict";
import test from "node:test";

import type {
  GitHubRepositoryData
} from "../services/github.js";

import {
  calculateGitHubScore
} from "./github-score.js";

type RepositoryFixtureOptions = {
  stars?: number;
  forks?: number;

  activity?: Partial<
    GitHubRepositoryData["activity"]
  >;
};

function createRepository(
  options:
    RepositoryFixtureOptions = {}
): GitHubRepositoryData {
  return {
    owner: "clarity-test",
    name: "test-agent",

    stars:
      options.stars ?? 0,

    forks:
      options.forks ?? 0,

    activity: {
      commitsLast30Days: 0,
      contributors: 0,
      releasesLast90Days: 0,
      latestReleaseAt: null,
      hasReadme: false,
      commitsCapped: false,
      contributorsCapped: false,
      releasesCapped: false,

      ...options.activity
    }
  } as unknown as GitHubRepositoryData;
}

test(
  "returns zero score for an inactive repository",
  () => {
    const score =
      calculateGitHubScore(
        createRepository()
      );

    assert.equal(
      score.activity,
      0
    );

    assert.equal(
      score.collaboration,
      0
    );

    assert.equal(
      score.adoption,
      0
    );

    assert.equal(
      score.releases,
      0
    );

    assert.equal(
      score.overall,
      0
    );

    assert.equal(
      score.dataCoverage,
      100
    );
  }
);

test(
  "returns maximum score at all scoring targets",
  () => {
    const score =
      calculateGitHubScore(
        createRepository({
          stars: 10_000,
          forks: 2_000,

          activity: {
            commitsLast30Days: 30,
            contributors: 20,
            releasesLast90Days: 4,

            latestReleaseAt:
              new Date().toISOString()
          }
        })
      );

    assert.equal(
      score.activity,
      100
    );

    assert.equal(
      score.collaboration,
      100
    );

    assert.equal(
      score.adoption,
      100
    );

    assert.equal(
      score.releases,
      100
    );

    assert.equal(
      score.overall,
      100
    );
  }
);

test(
  "uses logarithmic activity scoring and caps at target",
  () => {
    const oneCommit =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsLast30Days: 1
          }
        })
      );

    const fiveCommits =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsLast30Days: 5
          }
        })
      );

    const targetCommits =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsLast30Days: 30
          }
        })
      );

    const aboveTarget =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsLast30Days: 300
          }
        })
      );

    assert.equal(
      oneCommit.activity,
      20
    );

    assert.equal(
      fiveCommits.activity,
      52
    );

    assert.equal(
      targetCommits.activity,
      100
    );

    assert.equal(
      aboveTarget.activity,
      100
    );
  }
);

test(
  "applies overall weights of 40 20 25 and 15 percent",
  () => {
    const activityOnly =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsLast30Days: 30
          }
        })
      );

    const collaborationOnly =
      calculateGitHubScore(
        createRepository({
          activity: {
            contributors: 20
          }
        })
      );

    const adoptionOnly =
      calculateGitHubScore(
        createRepository({
          stars: 10_000,
          forks: 2_000
        })
      );

    const releasesOnly =
      calculateGitHubScore(
        createRepository({
          activity: {
            releasesLast90Days: 4,

            latestReleaseAt:
              new Date().toISOString()
          }
        })
      );

    assert.equal(
      activityOnly.overall,
      40
    );

    assert.equal(
      collaborationOnly.overall,
      20
    );

    assert.equal(
      adoptionOnly.overall,
      25
    );

    assert.equal(
      releasesOnly.overall,
      15
    );
  }
);

test(
  "combines release frequency and recency at 60 and 40 percent",
  () => {
    const frequencyOnly =
      calculateGitHubScore(
        createRepository({
          activity: {
            releasesLast90Days: 4,
            latestReleaseAt: null
          }
        })
      );

    const recencyOnly =
      calculateGitHubScore(
        createRepository({
          activity: {
            releasesLast90Days: 0,

            latestReleaseAt:
              new Date().toISOString()
          }
        })
      );

    assert.equal(
      frequencyOnly.releases,
      60
    );

    assert.equal(
      recencyOnly.releases,
      40
    );
  }
);

test(
  "reduces data coverage for capped GitHub collections",
  () => {
    const oneCap =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsCapped: true
          }
        })
      );

    const allCaps =
      calculateGitHubScore(
        createRepository({
          activity: {
            commitsCapped: true,
            contributorsCapped: true,
            releasesCapped: true
          }
        })
      );

    assert.equal(
      oneCap.dataCoverage,
      90
    );

    assert.equal(
      allCaps.dataCoverage,
      70
    );
  }
);
