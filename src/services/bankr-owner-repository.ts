import type {
  BankrCandidate
} from "./bankr-candidate.js";

import type {
  DiscoveredRepository,
  GitHubOwnerDiscovery
} from "./github-discovery.js";

const PROBABLE_SCORE =
  60;

const MAX_CANDIDATES_PER_OWNER =
  5;

export type BankrOwnerRepositoryMatch = {
  owner: string;
  repository: string;
  url: string;

  description: string | null;
  role:
    DiscoveredRepository["role"];

  score: number;
  probable: boolean;
  reasons: string[];

  stars: number;
  pushedAt: string | null;
};

function normalizeIdentity(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function getSignificantTokens(
  ...values: string[]
): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(
        /[^a-z0-9]+/
      )
      .filter(
        (token) =>
          token.length >= 4 &&
          token !== "agent" &&
          token !== "project" &&
          token !== "official"
      )
  );
}

function getHostname(
  value:
    string |
    null
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(
      value
    )
      .hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );
  } catch {
    return null;
  }
}

export function parseGitHubOwnerUrl(
  value: string
): string | null {
  let parsed: URL;

  try {
    parsed =
      new URL(
        value
      );
  } catch {
    return null;
  }

  const hostname =
    parsed
      .hostname
      .toLowerCase();

  if (
    hostname !== "github.com" &&
    hostname !== "www.github.com"
  ) {
    return null;
  }

  const pathParts =
    parsed
      .pathname
      .split("/")
      .filter(Boolean);

  if (
    pathParts.length !== 1
  ) {
    return null;
  }

  const owner =
    pathParts[0];

  if (
    !owner ||
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(
      owner
    )
  ) {
    return null;
  }

  return owner;
}

function scoreRepository(
  candidate:
    BankrCandidate,

  repository:
    DiscoveredRepository
): BankrOwnerRepositoryMatch {
  let score =
    0;

  const reasons:
    string[] =
    [];

  const candidateIdentities =
    [
      normalizeIdentity(
        candidate.name
      ),

      normalizeIdentity(
        candidate.bankrSlug
      )
    ]
      .filter(
        (value) =>
          value.length >= 3
      );

  const repositoryIdentity =
    normalizeIdentity(
      repository.name
    );

  const ownerIdentity =
    normalizeIdentity(
      repository.owner
    );

  if (
    candidateIdentities.includes(
      repositoryIdentity
    )
  ) {
    score +=
      60;

    reasons.push(
      "Repository name exactly matches the Bankr project name or slug."
    );
  } else {
    const partialIdentityMatch =
      candidateIdentities.some(
        (identity) =>
          identity.length >= 5 &&
          repositoryIdentity.length >= 5 &&
          (
            repositoryIdentity.includes(
              identity
            ) ||
            identity.includes(
              repositoryIdentity
            )
          )
      );

    if (partialIdentityMatch) {
      score +=
        35;

      reasons.push(
        "Repository name closely matches the Bankr project identity."
      );
    }
  }

  if (
    candidateIdentities.includes(
      ownerIdentity
    )
  ) {
    score +=
      25;

    reasons.push(
      "GitHub owner exactly matches the Bankr project identity."
    );
  } else {
    const partialOwnerMatch =
      candidateIdentities.some(
        (identity) =>
          identity.length >= 5 &&
          ownerIdentity.length >= 5 &&
          (
            ownerIdentity.includes(
              identity
            ) ||
            identity.includes(
              ownerIdentity
            )
          )
      );

    if (partialOwnerMatch) {
      score +=
        15;

      reasons.push(
        "GitHub owner closely matches the Bankr project identity."
      );
    }
  }

  const candidateTokens =
    getSignificantTokens(
      candidate.name,
      candidate.bankrSlug
    );

  const repositoryTokens =
    getSignificantTokens(
      repository.name,
      repository.description ??
        ""
    );

  const sharedTokens =
    [
      ...candidateTokens
    ].filter(
      (token) =>
        repositoryTokens.has(
          token
        )
    );

  if (
    sharedTokens.length > 0
  ) {
    const tokenScore =
      Math.min(
        20,
        sharedTokens.length *
          10
      );

    score +=
      tokenScore;

    reasons.push(
      `Shared project tokens: ${sharedTokens.join(", ")}.`
    );
  }

  const candidateWebsiteHost =
    getHostname(
      candidate.website
    );

  const repositoryHomepageHost =
    getHostname(
      repository.homepage
    );

  if (
    candidateWebsiteHost &&
    repositoryHomepageHost &&
    candidateWebsiteHost ===
      repositoryHomepageHost
  ) {
    score +=
      20;

    reasons.push(
      "Repository homepage matches the official Bankr website."
    );
  }

  if (
    repository.role ===
      "primary-candidate"
  ) {
    score +=
      10;

    reasons.push(
      "GitHub metadata classifies the repository as a primary candidate."
    );
  }

  if (
    repository.daysSincePush !==
      null &&
    repository.daysSincePush <=
      180
  ) {
    score +=
      5;

    reasons.push(
      "Repository has recent public activity."
    );
  }

  if (
    repository.stars > 0
  ) {
    score +=
      2;

    reasons.push(
      "Repository has observable public adoption."
    );
  }

  if (
    repository.role ===
      "website"
  ) {
    score -=
      70;

    reasons.push(
      "Website repositories are not treated as probable project repositories."
    );
  } else if (
    repository.role ===
      "documentation"
  ) {
    score -=
      60;

    reasons.push(
      "Documentation repositories are not treated as probable project repositories."
    );
  }

  const normalizedScore =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  const eligibleForProbable =
    repository.role !==
      "website" &&
    repository.role !==
      "documentation";

  return {
    owner:
      repository.owner,

    repository:
      repository.name,

    url:
      repository.url,

    description:
      repository.description,

    role:
      repository.role,

    score:
      normalizedScore,

    probable:
      eligibleForProbable &&
      normalizedScore >=
        PROBABLE_SCORE,

    reasons,

    stars:
      repository.stars,

    pushedAt:
      repository.pushedAt
  };
}

export function rankBankrOwnerRepositories(
  candidate:
    BankrCandidate,

  discovery:
    GitHubOwnerDiscovery,

  limit =
    MAX_CANDIDATES_PER_OWNER
): BankrOwnerRepositoryMatch[] {
  return discovery
    .candidates
    .map(
      (repository) =>
        scoreRepository(
          candidate,
          repository
        )
    )
    .filter(
      (repository) =>
        repository.score > 0
    )
    .sort(
      (
        left,
        right
      ) => {
        const scoreDifference =
          right.score -
          left.score;

        if (
          scoreDifference !== 0
        ) {
          return scoreDifference;
        }

        const starsDifference =
          right.stars -
          left.stars;

        if (
          starsDifference !== 0
        ) {
          return starsDifference;
        }

        return left.url.localeCompare(
          right.url,
          "en",
          {
            sensitivity:
              "base"
          }
        );
      }
    )
    .slice(
      0,
      Math.max(
        1,
        limit
      )
    );
}
