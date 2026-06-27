import assert from "node:assert/strict";
import test from "node:test";

import type {
  GitHubRepositoryData
} from "./github.js";

import {
  buildProjectGitHubMetrics,
  type ProjectCoreRepositoryInput,
  type ProjectGitHubMetricsDependencies
} from "./project-github-metrics.js";

type RepositoryOptions = {
  stars?: number;
  forks?: number;
  openIssues?: number;

  createdAt?: string | null;
  updatedAt?: string | null;
  pushedAt?: string | null;

  activity?: Partial<
    GitHubRepositoryData["activity"]
  >;
};

function createRepository(
  owner: string,
  name: string,

  options:
    RepositoryOptions = {}
): GitHubRepositoryData {
  return {
    owner,
    name,

    description:
      `${name} description`,

    stars:
      options.stars ?? 0,

    forks:
      options.forks ?? 0,

    openIssues:
      options.openIssues ?? 0,

    language:
      "TypeScript",

    defaultBranch:
      "main",

    createdAt:
      options.createdAt ??
      "2026-01-10T00:00:00.000Z",

    updatedAt:
      options.updatedAt ??
      "2026-01-20T00:00:00.000Z",

    pushedAt:
      options.pushedAt ??
      "2026-01-20T00:00:00.000Z",

    url:
      `https://github.com/${owner}/${name}`,

    activity: {
      commitsLast30Days: 0,
      commitsCapped: false,

      contributors: 0,
      contributorsCapped: false,

      releasesLast90Days: 0,
      releasesCapped: false,

      latestReleaseAt: null,
      hasReadme: false,

      ...options.activity
    }
  };
}

function createInput(
  owner: string,
  repository: string,
  isAnchor: boolean
): ProjectCoreRepositoryInput {
  return {
    owner,
    repository,

    role:
      isAnchor
        ? "anchor"
        : "core-candidate",

    relationScore:
      isAnchor
        ? 100
        : 85,

    isAnchor
  };
}

function createDependencies(
  repositories:
    GitHubRepositoryData[],

  contributorKeys:
    Record<string, string[]> = {}
): ProjectGitHubMetricsDependencies {
  const repositoryMap =
    new Map(
      repositories.map(
        (repository) => [
          `${repository.owner}/${repository.name}`,
          repository
        ]
      )
    );

  return {
    getRepositoryData:
      async (
        owner: string,
        repository: string
      ): Promise<GitHubRepositoryData> => {
        const key =
          `${owner}/${repository}`;

        const data =
          repositoryMap.get(key);

        if (!data) {
          throw new Error(
            `Missing repository fixture: ${key}`
          );
        }

        return data;
      },

    getContributorKeys:
      async (
        owner: string,
        repository: string
      ): Promise<string[]> => {
        return (
          contributorKeys[
            `${owner}/${repository}`
          ] ?? []
        );
      }
  };
}

test(
  "requires at least one core repository",
  async () => {
    await assert.rejects(
      buildProjectGitHubMetrics(
        "Clarity",
        []
      ),

      /At least one core repository/
    );
  }
);

test(
  "requires an anchor repository",
  async () => {
    const repository =
      createRepository(
        "clarity",
        "sdk"
      );

    await assert.rejects(
      buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies([
          repository
        ])
      ),

      /has no anchor/
    );
  }
);

test(
  "counts anchor commits fully and caps additional core contribution",
  async () => {
    const anchor =
      createRepository(
        "clarity",
        "agent",
        {
          activity: {
            commitsLast30Days: 40
          }
        }
      );

    const additionalCore =
      createRepository(
        "clarity",
        "sdk",
        {
          activity: {
            commitsLast30Days: 200
          }
        }
      );

    const metrics =
      await buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "agent",
            true
          ),

          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies([
          anchor,
          additionalCore
        ])
      );

    assert.equal(
      metrics.rawCommitsLast30Days,
      240
    );

    assert.equal(
      metrics.adjustedCommitsLast30Days,
      70
    );

    assert.equal(
      metrics.repositories[0]
        ?.adjustedCommitContribution,
      40
    );

    assert.equal(
      metrics.repositories[1]
        ?.adjustedCommitContribution,
      30
    );

    assert.equal(
      metrics.aggregate.activity
        .commitsLast30Days,
      70
    );
  }
);

test(
  "applies 25 percent weight below the additional core cap",
  async () => {
    const anchor =
      createRepository(
        "clarity",
        "agent",
        {
          activity: {
            commitsLast30Days: 10
          }
        }
      );

    const additionalCore =
      createRepository(
        "clarity",
        "sdk",
        {
          activity: {
            commitsLast30Days: 40
          }
        }
      );

    const metrics =
      await buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "agent",
            true
          ),

          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies([
          anchor,
          additionalCore
        ])
      );

    assert.equal(
      metrics.rawCommitsLast30Days,
      50
    );

    assert.equal(
      metrics.adjustedCommitsLast30Days,
      20
    );

    assert.equal(
      metrics.repositories[1]
        ?.adjustedCommitContribution,
      10
    );
  }
);

test(
  "deduplicates contributors across core repositories",
  async () => {
    const anchor =
      createRepository(
        "clarity",
        "agent",
        {
          activity: {
            contributors: 2
          }
        }
      );

    const additionalCore =
      createRepository(
        "clarity",
        "sdk",
        {
          activity: {
            contributors: 2
          }
        }
      );

    const metrics =
      await buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "agent",
            true
          ),

          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies(
          [
            anchor,
            additionalCore
          ],

          {
            "clarity/agent": [
              "login:alice",
              "login:bob"
            ],

            "clarity/sdk": [
              "login:bob",
              "login:carol"
            ]
          }
        )
      );

    assert.equal(
      metrics.uniqueContributors,
      3
    );

    assert.equal(
      metrics.aggregate.activity
        .contributors,
      3
    );
  }
);

test(
  "uses the largest repository contributor count when identities are unavailable",
  async () => {
    const anchor =
      createRepository(
        "clarity",
        "agent",
        {
          activity: {
            contributors: 4
          }
        }
      );

    const additionalCore =
      createRepository(
        "clarity",
        "sdk",
        {
          activity: {
            contributors: 7
          }
        }
      );

    const metrics =
      await buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "agent",
            true
          ),

          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies([
          anchor,
          additionalCore
        ])
      );

    assert.equal(
      metrics.uniqueContributors,
      7
    );
  }
);

test(
  "uses anchor adoption data and aggregates project metadata",
  async () => {
    const anchor =
      createRepository(
        "clarity",
        "agent",
        {
          stars: 100,
          forks: 20,
          openIssues: 2,

          createdAt:
            "2026-01-10T00:00:00.000Z",

          updatedAt:
            "2026-01-20T00:00:00.000Z",

          pushedAt:
            "2026-01-20T00:00:00.000Z",

          activity: {
            releasesLast90Days: 1,

            latestReleaseAt:
              "2026-01-18T00:00:00.000Z",

            hasReadme: true
          }
        }
      );

    const additionalCore =
      createRepository(
        "clarity",
        "sdk",
        {
          stars: 9999,
          forks: 999,
          openIssues: 3,

          createdAt:
            "2026-01-01T00:00:00.000Z",

          updatedAt:
            "2026-01-25T00:00:00.000Z",

          pushedAt:
            "2026-01-26T00:00:00.000Z",

          activity: {
            commitsCapped: true,

            contributorsCapped:
              true,

            releasesLast90Days: 2,

            releasesCapped:
              true,

            latestReleaseAt:
              "2026-01-24T00:00:00.000Z",

            hasReadme: false
          }
        }
      );

    const metrics =
      await buildProjectGitHubMetrics(
        "Clarity",

        [
          createInput(
            "clarity",
            "agent",
            true
          ),

          createInput(
            "clarity",
            "sdk",
            false
          )
        ],

        createDependencies([
          anchor,
          additionalCore
        ])
      );

    assert.equal(
      metrics.aggregate.stars,
      100
    );

    assert.equal(
      metrics.aggregate.forks,
      20
    );

    assert.equal(
      metrics.aggregate.openIssues,
      5
    );

    assert.equal(
      metrics.aggregate.createdAt,
      "2026-01-01T00:00:00.000Z"
    );

    assert.equal(
      metrics.aggregate.updatedAt,
      "2026-01-25T00:00:00.000Z"
    );

    assert.equal(
      metrics.aggregate.pushedAt,
      "2026-01-26T00:00:00.000Z"
    );

    assert.equal(
      metrics.aggregate.activity
        .releasesLast90Days,
      3
    );

    assert.equal(
      metrics.aggregate.activity
        .latestReleaseAt,
      "2026-01-24T00:00:00.000Z"
    );

    assert.equal(
      metrics.aggregate.activity
        .hasReadme,
      true
    );

    assert.equal(
      metrics.aggregate.activity
        .commitsCapped,
      true
    );

    assert.equal(
      metrics.aggregate.activity
        .contributorsCapped,
      true
    );

    assert.equal(
      metrics.aggregate.activity
        .releasesCapped,
      true
    );
  }
);
