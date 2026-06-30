import {
  Octokit
} from "octokit";

import type {
  BankrCandidate
} from "./bankr-candidate.js";

export type BankrGlobalGitHubSearchSource =
  | "project-name"
  | "compact-slug"
  | "official-domain";

export type BankrGlobalGitHubRepositoryRole =
  | "primary-candidate"
  | "component"
  | "documentation"
  | "website"
  | "unknown";

export type BankrGlobalGitHubMatchStatus =
  | "probable"
  | "review"
  | "weak"
  | "unrelated";

export type BankrGlobalGitHubSearchRepository = {
  owner: string;
  repository: string;
  fullName: string;

  url: string;

  description:
    string |
    null;

  homepage:
    string |
    null;

  language:
    string |
    null;

  stars: number;
  forks: number;
  openIssues: number;

  pushedAt:
    string |
    null;

  fork: boolean;
  archived: boolean;
  disabled: boolean;
};

export type BankrGlobalGitHubRepositoryMatch =
  BankrGlobalGitHubSearchRepository & {
    role:
      BankrGlobalGitHubRepositoryRole;

    score:
      number;

    status:
      BankrGlobalGitHubMatchStatus;

    probable:
      boolean;

    matchedBy:
      BankrGlobalGitHubSearchSource[];

    reasons:
      string[];
  };

export type BankrGlobalGitHubQuery = {
  source:
    BankrGlobalGitHubSearchSource;

  query:
    string;
};

export type BankrGlobalGitHubCandidateDiscovery = {
  bankrProfileId: string;
  bankrSlug: string;

  queries:
    BankrGlobalGitHubQuery[];

  repositoriesFound:
    number;

  candidates:
    BankrGlobalGitHubRepositoryMatch[];
};

export type SearchGitHubRepositories = (
  query: string
) => Promise<
  BankrGlobalGitHubSearchRepository[]
>;

type CollectedRepository = {
  repository:
    BankrGlobalGitHubSearchRepository;

  matchedBy:
    Set<
      BankrGlobalGitHubSearchSource
    >;
};

const SEARCH_RESULTS_PER_QUERY =
  10;

const MAX_FINAL_MATCHES =
  12;

const DAY_IN_MS =
  24 * 60 * 60 * 1000;

function normalizeIdentity(
  value:
    string |
    null |
    undefined
): string {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/gu,
      ""
    );
}

function normalizeText(
  value:
    string |
    null |
    undefined
): string {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}

function quoteSearchValue(
  value: string
): string {
  const normalized =
    value
      .replace(
        /["\\]/gu,
        " "
      )
      .replace(
        /\s+/gu,
        " "
      )
      .trim();

  return `"${normalized}"`;
}

function getWebsiteDomain(
  website:
    string |
    null
): string | null {
  if (!website) {
    return null;
  }

  try {
    const parsed =
      new URL(
        website
      );

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www\./u,
          ""
        );

    if (
      hostname === "github.com" ||
      hostname.endsWith(
        ".github.com"
      )
    ) {
      return null;
    }

    return hostname;
  } catch {
    return null;
  }
}

function getHomepageDomain(
  homepage:
    string |
    null
): string | null {
  if (!homepage) {
    return null;
  }

  try {
    return new URL(
      homepage
    )
      .hostname
      .toLowerCase()
      .replace(
        /^www\./u,
        ""
      );
  } catch {
    return null;
  }
}

function domainsMatch(
  left:
    string |
    null,

  right:
    string |
    null
): boolean {
  if (
    !left ||
    !right
  ) {
    return false;
  }

  return (
    left === right ||
    left.endsWith(
      `.${right}`
    ) ||
    right.endsWith(
      `.${left}`
    )
  );
}

function getDaysSincePush(
  pushedAt:
    string |
    null
): number | null {
  if (!pushedAt) {
    return null;
  }

  const timestamp =
    new Date(
      pushedAt
    ).getTime();

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return null;
  }

  return Math.max(
    0,

    Math.floor(
      (
        Date.now() -
        timestamp
      ) /
      DAY_IN_MS
    )
  );
}

function classifyRepositoryRole(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  repository:
    BankrGlobalGitHubSearchRepository
): BankrGlobalGitHubRepositoryRole {
  const repositoryIdentity =
    normalizeIdentity(
      repository.repository
    );

  const ownerIdentity =
    normalizeIdentity(
      repository.owner
    );

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
        (
          value,
          index,
          values
        ) =>
          value.length >= 3 &&
          values.indexOf(
            value
          ) === index
      );

  const text =
    [
      repository.repository,
      repository.description ??
        ""
    ]
      .join(
        " "
      )
      .toLowerCase();

  const exactRepositoryIdentity =
    candidateIdentities.some(
      (identity) =>
        repositoryIdentity ===
          identity
    );

  const exactOwnerIdentity =
    candidateIdentities.some(
      (identity) =>
        ownerIdentity ===
          identity
    );

  const closeOwnerIdentity =
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        (
          ownerIdentity.includes(
            identity
          ) ||
          identity.includes(
            ownerIdentity
          )
        )
    );

  const homepageMatchesWebsite =
    domainsMatch(
      getWebsiteDomain(
        candidate.website
      ),

      getHomepageDomain(
        repository.homepage
      )
    );

  if (
    text.includes(
      "documentation"
    ) ||
    text.includes(
      " docs"
    ) ||
    repositoryIdentity.endsWith(
      "docs"
    ) ||
    repositoryIdentity.endsWith(
      "documentation"
    )
  ) {
    return "documentation";
  }

  if (
    text.includes(
      "website"
    ) ||
    text.includes(
      "landing page"
    ) ||
    repositoryIdentity.endsWith(
      "site"
    ) ||
    repositoryIdentity.endsWith(
      "website"
    )
  ) {
    return "website";
  }

  if (
    text.includes(
      " sdk"
    ) ||
    text.includes(
      "sdk "
    ) ||
    text.includes(
      "library"
    ) ||
    text.includes(
      "client"
    ) ||
    text.includes(
      "contracts"
    ) ||
    text.includes(
      "contract"
    ) ||
    text.includes(
      "plugin"
    ) ||
    text.includes(
      "skill"
    ) ||
    text.includes(
      " mcp"
    ) ||
    text.includes(
      "mcp "
    ) ||
    text.includes(
      " cli"
    ) ||
    text.includes(
      "cli "
    ) ||
    text.includes(
      " api"
    ) ||
    text.includes(
      "api "
    ) ||
    repositoryIdentity.endsWith(
      "cli"
    ) ||
    repositoryIdentity.endsWith(
      "skills"
    ) ||
    repositoryIdentity.endsWith(
      "sdk"
    ) ||
    repositoryIdentity.endsWith(
      "api"
    ) ||
    repositoryIdentity.endsWith(
      "contracts"
    ) ||
    repositoryIdentity.endsWith(
      "plugin"
    ) ||
    repositoryIdentity.endsWith(
      "tools"
    ) ||
    repositoryIdentity.endsWith(
      "containers"
    ) ||
    repositoryIdentity.includes(
      "toolkit"
    )
  ) {
    return "component";
  }

  const primaryLanguage =
    /\b(?:autonomous\s+agents?|ai\s+agents?|agent\s+framework|agent\s+platform|operating\s+system|protocol|platform|monorepo|implementation|dapp|application)\b/u.test(
      text
    );

  if (
    homepageMatchesWebsite ||
    primaryLanguage ||
    (
      exactRepositoryIdentity &&
      (
        exactOwnerIdentity ||
        closeOwnerIdentity
      )
    )
  ) {
    return "primary-candidate";
  }

  return "unknown";
}

function getMatchStatus(
  score: number,

  role:
    BankrGlobalGitHubRepositoryRole,

  strongProjectEvidence:
    boolean,

  disqualified:
    boolean
): BankrGlobalGitHubMatchStatus {
  if (
    disqualified
  ) {
    return "unrelated";
  }

  if (
    score >= 80 &&
    role ===
      "primary-candidate" &&
    strongProjectEvidence
  ) {
    return "probable";
  }

  if (
    score >= 55
  ) {
    return "review";
  }

  if (
    score >= 30
  ) {
    return "weak";
  }

  return "unrelated";
}

function scoreRepository(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  repository:
    BankrGlobalGitHubSearchRepository,

  matchedBy:
    BankrGlobalGitHubSearchSource[]
): BankrGlobalGitHubRepositoryMatch {
  const reasons:
    string[] =
    [];

  let score =
    0;

  function addEvidence(
    points: number,
    reason: string
  ): void {
    score +=
      points;

    reasons.push(
      `${points >= 0 ? "+" : ""}${points}: ${reason}`
    );
  }

  const repositoryIdentity =
    normalizeIdentity(
      repository.repository
    );

  const ownerIdentity =
    normalizeIdentity(
      repository.owner
    );

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
        (
          value,
          index,
          values
        ) =>
          value.length >= 3 &&
          values.indexOf(
            value
          ) === index
      );

  const descriptionIdentity =
    normalizeIdentity(
      repository.description
    );

  const exactRepositoryIdentity =
    candidateIdentities.some(
      (identity) =>
        repositoryIdentity ===
          identity
    );

  const containedRepositoryIdentity =
    !exactRepositoryIdentity &&
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        repositoryIdentity.includes(
          identity
        )
    );

  const exactOwnerIdentity =
    candidateIdentities.some(
      (identity) =>
        ownerIdentity ===
          identity
    );

  const closeOwnerIdentity =
    !exactOwnerIdentity &&
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        (
          ownerIdentity.includes(
            identity
          ) ||
          identity.includes(
            ownerIdentity
          )
        )
    );

  const homepageMatchesWebsite =
    domainsMatch(
      getWebsiteDomain(
        candidate.website
      ),

      getHomepageDomain(
        repository.homepage
      )
    );

  if (
    exactRepositoryIdentity
  ) {
    addEvidence(
      30,
      "Repository name exactly matches the Bankr project identity."
    );
  } else if (
    containedRepositoryIdentity
  ) {
    addEvidence(
      15,
      "Repository name contains the Bankr project identity."
    );
  }

  if (
    candidateIdentities.some(
      (identity) =>
        identity.length >= 4 &&
        descriptionIdentity.includes(
          identity
        )
    )
  ) {
    addEvidence(
      10,
      "Repository description contains the Bankr project identity."
    );
  }

  if (
    exactOwnerIdentity
  ) {
    addEvidence(
      25,
      "GitHub owner exactly matches the Bankr project identity."
    );
  } else if (
    closeOwnerIdentity
  ) {
    addEvidence(
      10,
      "GitHub owner closely matches the Bankr project identity."
    );
  }

  if (
    homepageMatchesWebsite
  ) {
    addEvidence(
      40,
      "Repository homepage matches the official Bankr website."
    );
  }

  if (
    matchedBy.includes(
      "official-domain"
    )
  ) {
    addEvidence(
      5,
      "Official project domain appeared in searchable repository metadata."
    );
  }

  if (
    matchedBy.includes(
      "project-name"
    )
  ) {
    addEvidence(
      5,
      "Repository matched the project-name GitHub search."
    );
  }

  const role =
    classifyRepositoryRole(
      candidate,
      repository
    );

  if (
    role ===
      "primary-candidate"
  ) {
    addEvidence(
      5,
      "Repository metadata is consistent with a primary project repository."
    );
  }

  const daysSincePush =
    getDaysSincePush(
      repository.pushedAt
    );

  if (
    daysSincePush !== null &&
    daysSincePush <= 90
  ) {
    addEvidence(
      5,
      "Repository has recent public activity."
    );
  } else if (
    daysSincePush !== null &&
    daysSincePush > 365
  ) {
    addEvidence(
      -10,
      "Repository has not been updated within the last year."
    );
  }

  if (
    repository.stars >= 5
  ) {
    addEvidence(
      3,
      "Repository has observable public adoption."
    );
  }

  if (
    exactRepositoryIdentity &&
    exactOwnerIdentity
  ) {
    addEvidence(
      15,
      "Repository and owner both exactly match the project identity."
    );
  } else if (
    exactRepositoryIdentity &&
    homepageMatchesWebsite
  ) {
    addEvidence(
      15,
      "Exact repository identity is corroborated by the official website."
    );
  } else if (
    containedRepositoryIdentity &&
    exactOwnerIdentity
  ) {
    addEvidence(
      10,
      "Matching repository family is owned by the exact project identity."
    );
  }

  const repositoryName =
    normalizeText(
      repository.repository
    );

  if (
    /(?:^|[-_.])(examples?|demo|template|starter)(?:$|[-_.])/u.test(
      repositoryName
    )
  ) {
    addEvidence(
      -25,
      "Repository name indicates examples, a demo, or a template."
    );
  }

  if (
    role ===
      "component"
  ) {
    addEvidence(
      -20,
      "Repository appears to be a component rather than the primary project."
    );
  }

  if (
    role ===
      "documentation" ||
    role ===
      "website"
  ) {
    addEvidence(
      -40,
      "Repository appears to contain documentation or a website."
    );
  }

  if (
    repository.fork
  ) {
    addEvidence(
      -60,
      "Forked repositories are not treated as primary project evidence."
    );
  }

  if (
    repository.archived ||
    repository.disabled
  ) {
    addEvidence(
      -60,
      "Archived or disabled repositories are not active project anchors."
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

  const strongProjectEvidence =
    homepageMatchesWebsite ||
    (
      exactRepositoryIdentity &&
      exactOwnerIdentity
    );

  const disqualified =
    repository.fork ||
    repository.archived ||
    repository.disabled;

  const status =
    getMatchStatus(
      normalizedScore,
      role,
      strongProjectEvidence,
      disqualified
    );

  return {
    ...repository,

    role,

    score:
      normalizedScore,

    status,

    probable:
      status ===
        "probable",

    matchedBy:
      [
        ...matchedBy
      ].sort(),

    reasons:
      reasons.length > 0
        ? reasons
        : [
            "No meaningful project identity signals were found."
          ]
  };
}

function applyAmbiguityPenalty(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  matches:
    BankrGlobalGitHubRepositoryMatch[]
): BankrGlobalGitHubRepositoryMatch[] {
  const contenders =
    matches
      .filter(
        (match) =>
          match.score >= 55 &&
          match.role ===
            "primary-candidate" &&
          !match.fork &&
          !match.archived &&
          !match.disabled
      )
      .sort(
        (
          left,
          right
        ) =>
          right.score -
          left.score
      );

  const topScore =
    contenders[0]
      ?.score;

  if (
    topScore ===
      undefined
  ) {
    return matches;
  }

  const ambiguous =
    contenders.filter(
      (match) =>
        topScore -
          match.score <=
        10
    );

  if (
    ambiguous.length < 2
  ) {
    return matches;
  }

  const ambiguousKeys =
    new Set(
      ambiguous.map(
        (match) =>
          match.fullName
            .toLowerCase()
      )
    );

  return matches.map(
    (match) => {
      if (
        !ambiguousKeys.has(
          match.fullName
            .toLowerCase()
        )
      ) {
        return match;
      }

      const nextScore =
        Math.max(
          0,
          match.score -
            15
        );

      const status =
        getMatchStatus(
          nextScore,
          match.role,
          false,
          match.fork ||
            match.archived ||
            match.disabled
        );

      return {
        ...match,

        score:
          nextScore,

        status,

        probable:
          false,

        reasons: [
          ...match.reasons,

          "-15: Multiple similarly ranked repositories create unresolved ownership ambiguity."
        ]
      };
    }
  );
}

function sortMatches(
  matches:
    BankrGlobalGitHubRepositoryMatch[]
): BankrGlobalGitHubRepositoryMatch[] {
  return [
    ...matches
  ].sort(
    (
      left,
      right
    ) =>
      right.score -
        left.score ||
      right.stars -
        left.stars ||
      left.fullName.localeCompare(
        right.fullName,
        "en",
        {
          sensitivity:
            "base"
        }
      )
  );
}

export function buildBankrGlobalGitHubQueries(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >
): BankrGlobalGitHubQuery[] {
  const queries:
    BankrGlobalGitHubQuery[] =
    [];

  const projectName =
    candidate.name
      .trim();

  if (
    projectName.length >= 2
  ) {
    queries.push(
      {
        source:
          "project-name",

        query:
          `${quoteSearchValue(projectName)} in:name,description,readme fork:false archived:false`
      }
    );
  }

  const compactSlug =
    normalizeIdentity(
      candidate.bankrSlug
    );

  if (
    compactSlug.length >= 3
  ) {
    queries.push(
      {
        source:
          "compact-slug",

        query:
          `${compactSlug} in:name,description,readme fork:false archived:false`
      }
    );
  }

  const websiteDomain =
    getWebsiteDomain(
      candidate.website
    );

  if (
    websiteDomain
  ) {
    queries.push(
      {
        source:
          "official-domain",

        query:
          `${websiteDomain} in:description,readme fork:false archived:false`
      }
    );
  }

  return queries;
}

export function rankBankrGlobalGitHubRepositories(
  candidate:
    Pick<
      BankrCandidate,
      "name" |
      "bankrSlug" |
      "website"
    >,

  collected:
    Array<{
      repository:
        BankrGlobalGitHubSearchRepository;

      matchedBy:
        BankrGlobalGitHubSearchSource[];
    }>
): BankrGlobalGitHubRepositoryMatch[] {
  const scored =
    collected.map(
      (
        {
          repository,
          matchedBy
        }
      ) =>
        scoreRepository(
          candidate,
          repository,
          matchedBy
        )
    );

  return sortMatches(
    applyAmbiguityPenalty(
      candidate,
      scored
    )
  )
    .slice(
      0,
      MAX_FINAL_MATCHES
    );
}

export async function searchGitHubRepositories(
  query: string
): Promise<
  BankrGlobalGitHubSearchRepository[]
> {
  const token =
    process.env
      .GITHUB_TOKEN
      ?.trim();

  const octokit =
    new Octokit(
      token
        ? {
            auth:
              token
          }
        : {}
    );

  const response =
    await octokit
      .rest
      .search
      .repos(
        {
          q:
            query,

          sort:
            "updated",

          order:
            "desc",

          per_page:
            SEARCH_RESULTS_PER_QUERY
        }
      );

  return response
    .data
    .items
    .map(
      (repository) => ({
        owner:
          repository.owner
            ?.login ??
          repository.full_name
            .split(
              "/"
            )[0] ??
          "",

        repository:
          repository.name,

        fullName:
          repository.full_name,

        url:
          repository.html_url,

        description:
          repository.description,

        homepage:
          repository.homepage ??
          null,

        language:
          repository.language ??
          null,

        stars:
          repository
            .stargazers_count ??
          0,

        forks:
          repository
            .forks_count ??
          0,

        openIssues:
          repository
            .open_issues_count ??
          0,

        pushedAt:
          repository.pushed_at ??
          null,

        fork:
          repository.fork,

        archived:
          Boolean(
            repository.archived
          ),

        disabled:
          Boolean(
            repository.disabled
          )
      })
    )
    .filter(
      (repository) =>
        repository.owner &&
        repository.repository
    );
}

export async function discoverBankrCandidateGlobalGitHub(
  candidate:
    Pick<
      BankrCandidate,
      "bankrProfileId" |
      "bankrSlug" |
      "name" |
      "website"
    >,

  searchRepositories:
    SearchGitHubRepositories =
      searchGitHubRepositories
): Promise<
  BankrGlobalGitHubCandidateDiscovery
> {
  const queries =
    buildBankrGlobalGitHubQueries(
      candidate
    );

  const collected =
    new Map<
      string,
      CollectedRepository
    >();

  for (
    const query
    of queries
  ) {
    const repositories =
      await searchRepositories(
        query.query
      );

    for (
      const repository
      of repositories
    ) {
      const key =
        repository
          .fullName
          .trim()
          .toLowerCase();

      const existing =
        collected.get(
          key
        );

      if (
        existing
      ) {
        existing
          .matchedBy
          .add(
            query.source
          );

        continue;
      }

      collected.set(
        key,
        {
          repository,

          matchedBy:
            new Set(
              [
                query.source
              ]
            )
        }
      );
    }
  }

  const candidates =
    rankBankrGlobalGitHubRepositories(
      candidate,

      [
        ...collected
          .values()
      ].map(
        (entry) => ({
          repository:
            entry.repository,

          matchedBy:
            [
              ...entry.matchedBy
            ]
        })
      )
    );

  return {
    bankrProfileId:
      candidate.bankrProfileId,

    bankrSlug:
      candidate.bankrSlug,

    queries,

    repositoriesFound:
      collected.size,

    candidates
  };
}
