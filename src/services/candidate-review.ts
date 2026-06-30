import {
  createHash,
  randomUUID,
  timingSafeEqual
} from "node:crypto";

import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";

import type {
  IncomingMessage
} from "node:http";

import {
  dirname
} from "node:path";

import {
  z
} from "zod";

import {
  listRegisteredAgents,
  type RegisteredAgent,
  type RepositoryScope
} from "../data/agent-registry.js";

import {
  ClarityError
} from "../errors/clarity-error.js";

import type {
  BankrCandidateImportReport
} from "./bankr-candidate-import.js";

const MINIMUM_REVIEW_TOKEN_LENGTH =
  32;

const MAXIMUM_REVIEW_BODY_BYTES =
  32 * 1024;

export type CandidateReviewStatus =
  | "approved"
  | "rejected";

export type CandidateReviewInput = {
  bankrProfileId: string;
  repositoryUrl: string;

  decision:
    | "approve"
    | "reject"
    | "reset";

  note:
    string |
    null;
};

export type CandidateReviewBatchInput = {
  reviews:
    CandidateReviewInput[];
};

export type CandidateReviewDecision = {
  key: string;

  bankrProfileId: string;
  bankrSlug: string;
  candidateName: string;

  repositoryUrl: string;
  githubOwner: string;
  githubRepository: string;

  status:
    CandidateReviewStatus;

  note:
    string |
    null;

  decidedAt: string;
};

export type CandidateReviewState = {
  schemaVersion: "1.0";

  updatedAt:
    string |
    null;

  decisions:
    CandidateReviewDecision[];
};

export type CandidateReviewItem = {
  key: string;

  source:
    | "direct"
    | "owner-discovery"
    | "global-github-search";

  bankrProfileId: string;
  bankrSlug: string;
  candidateName: string;
  candidateDescription: string | null;

  repositoryUrl: string;
  githubOwner: string;
  githubRepository: string;

  suggestedScope:
    RepositoryScope;

  evidence: {
    relationship:
      string |
      null;

    confidence:
      string |
      null;

    role:
      string |
      null;

    score:
      number |
      null;

    probable:
      boolean |
      null;

    matchedBy:
      string[];

    queries:
      string[];

    reasons:
      string[];
  };

  decision: {
    status:
      CandidateReviewStatus;

    note:
      string |
      null;

    decidedAt:
      string;
  } | null;
};

export type CandidateRegistryProposal = {
  decisionKey: string;

  eligible:
    boolean;

  conflicts:
    string[];

  entry:
    RegisteredAgent;

  source: {
    bankrProfileId: string;
    bankrSlug: string;
    repositoryUrl: string;
    decidedAt: string;
  };
};

export type CandidateReviewView = {
  schemaVersion: "1.0";

  reportGeneratedAt: string;

  reviewUpdatedAt:
    string |
    null;

  counts: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    staleDecisions: number;
  };

  items:
    CandidateReviewItem[];

  proposals:
    CandidateRegistryProposal[];
};

const reviewInputSchema =
  z.object(
    {
      bankrProfileId:
        z.string()
          .trim()
          .min(1)
          .max(200),

      repositoryUrl:
        z.string()
          .trim()
          .url()
          .max(500),

      decision:
        z.enum(
          [
            "approve",
            "reject",
            "reset"
          ]
        ),

      note:
        z.string()
          .trim()
          .max(500)
          .nullable()
          .optional()
    }
  )
    .strict();

const MAXIMUM_REVIEW_BATCH_SIZE =
  100;

const reviewBatchInputSchema =
  z.object(
    {
      reviews:
        z.array(
          reviewInputSchema
        )
          .min(1)
          .max(
            MAXIMUM_REVIEW_BATCH_SIZE
          )
    }
  )
    .strict();

const reviewDecisionSchema =
  z.object(
    {
      key:
        z.string().min(1),

      bankrProfileId:
        z.string().min(1),

      bankrSlug:
        z.string().min(1),

      candidateName:
        z.string().min(1),

      repositoryUrl:
        z.string().url(),

      githubOwner:
        z.string().min(1),

      githubRepository:
        z.string().min(1),

      status:
        z.enum(
          [
            "approved",
            "rejected"
          ]
        ),

      note:
        z.string()
          .nullable(),

      decidedAt:
        z.string()
          .datetime()
    }
  )
    .strict();

const reviewStateSchema =
  z.object(
    {
      schemaVersion:
        z.literal(
          "1.0"
        ),

      updatedAt:
        z.string()
          .datetime()
          .nullable(),

      decisions:
        z.array(
          reviewDecisionSchema
        )
    }
  )
    .strict();

function hashToken(
  token: string
): Buffer {
  return createHash(
    "sha256"
  )
    .update(
      token,
      "utf8"
    )
    .digest();
}

function tokensMatch(
  providedToken: string,
  configuredToken: string
): boolean {
  return timingSafeEqual(
    hashToken(
      providedToken
    ),

    hashToken(
      configuredToken
    )
  );
}

function getBearerToken(
  authorizationHeader:
    string |
    undefined
): string | null {
  const match =
    authorizationHeader?.match(
      /^Bearer[ \t]+(.+)$/i
    );

  const token =
    match?.[1]?.trim();

  return token
    ? token
    : null;
}

function normalizeGitHubRepositoryUrl(
  value: string
): {
  url: string;
  owner: string;
  repository: string;
} | null {
  let parsed:
    URL;

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

  const parts =
    parsed
      .pathname
      .split("/")
      .filter(Boolean);

  if (
    parts.length !== 2
  ) {
    return null;
  }

  const owner =
    parts[0];

  const repository =
    parts[1]
      ?.replace(
        /\.git$/iu,
        ""
      );

  if (
    !owner ||
    !repository ||
    !/^[A-Za-z0-9_.-]+$/u.test(
      owner
    ) ||
    !/^[A-Za-z0-9_.-]+$/u.test(
      repository
    )
  ) {
    return null;
  }

  return {
    url:
      `https://github.com/${owner}/${repository}`,

    owner,

    repository
  };
}

function createDecisionKey(
  bankrProfileId: string,
  repositoryUrl: string
): string {
  return createHash(
    "sha256"
  )
    .update(
      [
        bankrProfileId
          .trim()
          .toLowerCase(),

        repositoryUrl
          .trim()
          .toLowerCase()
      ].join("\n"),
      "utf8"
    )
    .digest(
      "hex"
    );
}

function createEmptyReviewState():
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

export function getCandidateReviewPath():
string {
  return (
    process.env
      .CLARITY_CANDIDATE_REVIEW_PATH ??
    "data/candidates/bankr-reviews.json"
  );
}

export function authenticateCandidateReview(
  authorizationHeader:
    string |
    undefined,

  configuredToken:
    string |
    undefined =
      process.env
        .CLARITY_CANDIDATE_REVIEW_TOKEN
): void {
  const normalizedConfiguredToken =
    configuredToken?.trim();

  if (
    !normalizedConfiguredToken ||
    normalizedConfiguredToken.length <
      MINIMUM_REVIEW_TOKEN_LENGTH
  ) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_NOT_CONFIGURED",

      "Administrative candidate review is not configured.",

      503
    );
  }

  const providedToken =
    getBearerToken(
      authorizationHeader
    );

  if (
    !providedToken ||
    !tokensMatch(
      providedToken,
      normalizedConfiguredToken
    )
  ) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_AUTHENTICATION_FAILED",

      "Valid candidate review Bearer authentication is required.",

      401
    );
  }
}

async function readCandidateReviewJson(
  request:
    IncomingMessage
): Promise<unknown> {
  const chunks:
    Buffer[] =
    [];

  let bytesRead =
    0;

  for await (
    const chunk
    of request
  ) {
    const buffer =
      Buffer.isBuffer(
        chunk
      )
        ? chunk
        : Buffer.from(
            chunk
          );

    bytesRead +=
      buffer.byteLength;

    if (
      bytesRead >
      MAXIMUM_REVIEW_BODY_BYTES
    ) {
      request.resume();

      throw new ClarityError(
        "CANDIDATE_REVIEW_INVALID",
        "Candidate review request body is too large.",
        413
      );
    }

    chunks.push(
      buffer
    );
  }

  if (
    bytesRead === 0
  ) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_INVALID",
      "Candidate review request body is empty.",
      400
    );
  }

  try {
    return JSON.parse(
      Buffer
        .concat(
          chunks
        )
        .toString(
          "utf8"
        )
    );
  } catch (error) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_INVALID",
      "Candidate review request body is not valid JSON.",
      400,
      {
        cause:
          error
      }
    );
  }
}

function createReviewValidationError(
  issues:
    Array<{
      path:
        PropertyKey[];

      message:
        string;
    }>
): ClarityError {
  return new ClarityError(
    "CANDIDATE_REVIEW_INVALID",
    "Candidate review request failed runtime validation.",
    400,
    {
      details: {
        issues:
          issues
            .slice(
              0,
              10
            )
            .map(
              (issue) => ({
                path:
                  issue.path
                    .map(
                      String
                    )
                    .join(
                      "."
                    ),

                message:
                  issue.message
              })
            )
      }
    }
  );
}

function normalizeReviewInput(
  input:
    z.infer<
      typeof reviewInputSchema
    >
): CandidateReviewInput {
  return {
    ...input,

    note:
      input.note
        ?.trim() ||
      null
  };
}

export async function readCandidateReviewRequest(
  request:
    IncomingMessage
): Promise<
  CandidateReviewInput
> {
  const parsed =
    await readCandidateReviewJson(
      request
    );

  const validated =
    reviewInputSchema.safeParse(
      parsed
    );

  if (
    !validated.success
  ) {
    throw createReviewValidationError(
      validated.error.issues
    );
  }

  return normalizeReviewInput(
    validated.data
  );
}

export async function readCandidateReviewBatchRequest(
  request:
    IncomingMessage
): Promise<
  CandidateReviewBatchInput
> {
  const parsed =
    await readCandidateReviewJson(
      request
    );

  const validated =
    reviewBatchInputSchema.safeParse(
      parsed
    );

  if (
    !validated.success
  ) {
    throw createReviewValidationError(
      validated.error.issues
    );
  }

  return {
    reviews:
      validated
        .data
        .reviews
        .map(
          normalizeReviewInput
        )
  };
}

export async function loadCandidateReviewState(
  inputPath =
    getCandidateReviewPath()
): Promise<
  CandidateReviewState
> {
  let content:
    string;

  try {
    content =
      await readFile(
        inputPath,
        "utf8"
      );
  } catch (error) {
    const candidate =
      error as
        NodeJS.ErrnoException;

    if (
      candidate.code ===
        "ENOENT"
    ) {
      return createEmptyReviewState();
    }

    throw error;
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        content
      );
  } catch (error) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_STATE_INVALID",

      "Stored candidate review state is not valid JSON.",

      500,

      {
        cause:
          error
      }
    );
  }

  const validated =
    reviewStateSchema.safeParse(
      parsed
    );

  if (
    !validated.success
  ) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_STATE_INVALID",

      "Stored candidate review state failed runtime validation.",

      500
    );
  }

  return validated.data;
}

async function saveCandidateReviewState(
  state:
    CandidateReviewState,

  outputPath =
    getCandidateReviewPath()
): Promise<void> {
  const validated =
    reviewStateSchema.parse(
      state
    );

  await mkdir(
    dirname(
      outputPath
    ),
    {
      recursive:
        true
    }
  );

  const temporaryPath =
    `${outputPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(
      temporaryPath,

      JSON.stringify(
        validated,
        null,
        2
      ) + "\n",

      {
        encoding:
          "utf8",

        mode:
          0o600
      }
    );

    await rename(
      temporaryPath,
      outputPath
    );
  } catch (error) {
    await unlink(
      temporaryPath
    ).catch(
      () => undefined
    );

    throw error;
  }
}

function collectReviewableRepositories(
  report:
    BankrCandidateImportReport
): Omit<
  CandidateReviewItem,
  "decision"
>[] {
  const items =
    new Map<
      string,
      Omit<
        CandidateReviewItem,
        "decision"
      >
    >();

  const candidatesByProfileId =
    new Map(
      report.candidates.map(
        (candidate) => [
          candidate.bankrProfileId,
          candidate
        ]
      )
    );

  for (
    const candidate
    of report.candidates
  ) {
    for (
      const repository
      of candidate.githubRepositories
    ) {
      const normalized =
        normalizeGitHubRepositoryUrl(
          repository.url
        );

      if (!normalized) {
        continue;
      }

      const key =
        createDecisionKey(
          candidate.bankrProfileId,
          normalized.url
        );

      items.set(
        key,
        {
          key,

          source:
            "direct",

          bankrProfileId:
            candidate.bankrProfileId,

          bankrSlug:
            candidate.bankrSlug,

          candidateName:
            candidate.name,

          candidateDescription:
            candidate.description,

          repositoryUrl:
            normalized.url,

          githubOwner:
            normalized.owner,

          githubRepository:
            normalized.repository,

          suggestedScope:
            repository.relationship ===
              "primary"
              ? "primary"
              : "component",

          evidence: {
            relationship:
              repository.relationship,

            confidence:
              repository.confidence,

            role:
              null,

            score:
              null,

            probable:
              null,

            matchedBy:
              [],

            queries:
              [],

            reasons:
              repository.reasons
          }
        }
      );
    }
  }

  for (
    const result
    of report
      .ownerDiscovery
      .results
  ) {
    const candidate =
      candidatesByProfileId.get(
        result.bankrProfileId
      );

    if (!candidate) {
      continue;
    }

    for (
      const repository
      of result.candidates
    ) {
      const normalized =
        normalizeGitHubRepositoryUrl(
          repository.url
        );

      if (!normalized) {
        continue;
      }

      const key =
        createDecisionKey(
          candidate.bankrProfileId,
          normalized.url
        );

      if (
        items.has(
          key
        )
      ) {
        continue;
      }

      items.set(
        key,
        {
          key,

          source:
            "owner-discovery",

          bankrProfileId:
            candidate.bankrProfileId,

          bankrSlug:
            candidate.bankrSlug,

          candidateName:
            candidate.name,

          candidateDescription:
            candidate.description,

          repositoryUrl:
            normalized.url,

          githubOwner:
            normalized.owner,

          githubRepository:
            normalized.repository,

          suggestedScope:
            repository.role ===
              "primary-candidate"
              ? "primary"
              : "component",

          evidence: {
            relationship:
              null,

            confidence:
              null,

            role:
              repository.role,

            score:
              repository.score,

            probable:
              repository.probable,

            matchedBy:
              [],

            queries:
              [],

            reasons:
              repository.reasons
          }
        }
      );
    }
  }

  for (
    const result
    of report
      .globalGitHubDiscovery
      ?.results ??
      []
  ) {
    const candidate =
      candidatesByProfileId.get(
        result.bankrProfileId
      );

    if (!candidate) {
      continue;
    }

    const queries =
      result.queries.map(
        (query) =>
          `${query.source}: ${query.query}`
      );

    for (
      const repository
      of result.candidates
    ) {
      const normalized =
        normalizeGitHubRepositoryUrl(
          repository.url
        );

      if (!normalized) {
        continue;
      }

      const key =
        createDecisionKey(
          candidate.bankrProfileId,
          normalized.url
        );

      if (
        items.has(
          key
        )
      ) {
        continue;
      }

      items.set(
        key,
        {
          key,

          source:
            "global-github-search",

          bankrProfileId:
            candidate.bankrProfileId,

          bankrSlug:
            candidate.bankrSlug,

          candidateName:
            candidate.name,

          candidateDescription:
            candidate.description,

          repositoryUrl:
            normalized.url,

          githubOwner:
            normalized.owner,

          githubRepository:
            normalized.repository,

          suggestedScope:
            repository.role ===
              "primary-candidate"
              ? "primary"
              : "component",

          evidence: {
            relationship:
              null,

            confidence:
              null,

            role:
              repository.role,

            score:
              repository.score,

            probable:
              repository.probable,

            matchedBy:
              repository.matchedBy,

            queries,

            reasons:
              repository.reasons
          }
        }
      );
    }
  }

  return [
    ...items.values()
  ].sort(
    (
      left,
      right
    ) =>
      left.candidateName.localeCompare(
        right.candidateName,
        "en",
        {
          sensitivity:
            "base"
        }
      ) ||
      left.repositoryUrl.localeCompare(
        right.repositoryUrl,
        "en",
        {
          sensitivity:
            "base"
        }
      )
  );
}

function buildRegistryProposals(
  items:
    CandidateReviewItem[],

  decisions:
    CandidateReviewDecision[]
): CandidateRegistryProposal[] {
  const registered =
    listRegisteredAgents();

  const itemByKey =
    new Map(
      items.map(
        (item) => [
          item.key,
          item
        ]
      )
    );

  const approved =
    decisions.filter(
      (decision) =>
        decision.status ===
          "approved" &&
        itemByKey.has(
          decision.key
        )
    );

  const slugCounts =
    new Map<
      string,
      number
    >();

  const repositoryCounts =
    new Map<
      string,
      number
    >();

  for (
    const decision
    of approved
  ) {
    const item =
      itemByKey.get(
        decision.key
      );

    if (!item) {
      continue;
    }

    const slug =
      item.bankrSlug
        .toLowerCase();

    const repositoryKey =
      [
        item.githubOwner,
        item.githubRepository
      ]
        .join("/")
        .toLowerCase();

    slugCounts.set(
      slug,
      (
        slugCounts.get(
          slug
        ) ??
        0
      ) + 1
    );

    repositoryCounts.set(
      repositoryKey,
      (
        repositoryCounts.get(
          repositoryKey
        ) ??
        0
      ) + 1
    );
  }

  return approved.map(
    (decision) => {
      const item =
        itemByKey.get(
          decision.key
        );

      if (!item) {
        throw new Error(
          "Approved review item disappeared."
        );
      }

      const slug =
        item.bankrSlug
          .toLowerCase();

      const repositoryKey =
        [
          item.githubOwner,
          item.githubRepository
        ]
          .join("/")
          .toLowerCase();

      const conflicts:
        string[] =
        [];

      if (
        !/^[a-z0-9][a-z0-9._-]*$/u.test(
          slug
        )
      ) {
        conflicts.push(
          "Bankr slug is not a valid Clarity registry slug."
        );
      }

      if (
        registered.some(
          (agent) =>
            agent.slug ===
              slug
        )
      ) {
        conflicts.push(
          "Registry already contains this slug."
        );
      }

      if (
        registered.some(
          (agent) =>
            [
              agent.github.owner,
              agent.github.repository
            ]
              .join("/")
              .toLowerCase() ===
            repositoryKey
        )
      ) {
        conflicts.push(
          "Registry already contains this GitHub repository."
        );
      }

      if (
        (
          slugCounts.get(
            slug
          ) ??
          0
        ) > 1
      ) {
        conflicts.push(
          "Multiple approved repositories use the same candidate slug."
        );
      }

      if (
        (
          repositoryCounts.get(
            repositoryKey
          ) ??
          0
        ) > 1
      ) {
        conflicts.push(
          "The same GitHub repository was approved more than once."
        );
      }

      const normalizedName =
        item.candidateName
          .trim();

      const searchName =
        normalizedName
          .toLowerCase();

      const entry:
        RegisteredAgent = {
          slug,

          name:
            normalizedName,

          aliases: [
            `${item.githubOwner}/${item.githubRepository}`
          ],

          searchAliases:
            Array.from(
              new Set(
                [
                  searchName,
                  `${searchName} ai`,
                  `${searchName} agent`
                ]
              )
            ),

          description:
            item
              .candidateDescription
              ?.trim() ||
            "Bankr-discovered AI agent candidate with manually approved GitHub evidence.",

          github: {
            owner:
              item.githubOwner,

            repository:
              item.githubRepository,

            scope:
              item.suggestedScope
          }
        };

      return {
        decisionKey:
          decision.key,

        eligible:
          conflicts.length ===
            0,

        conflicts,

        entry,

        source: {
          bankrProfileId:
            item.bankrProfileId,

          bankrSlug:
            item.bankrSlug,

          repositoryUrl:
            item.repositoryUrl,

          decidedAt:
            decision.decidedAt
        }
      };
    }
  );
}

export function buildCandidateReviewView(
  report:
    BankrCandidateImportReport,

  state:
    CandidateReviewState
): CandidateReviewView {
  const rawItems =
    collectReviewableRepositories(
      report
    );

  const currentKeys =
    new Set(
      rawItems.map(
        (item) =>
          item.key
      )
    );

  const currentDecisions =
    state.decisions.filter(
      (decision) =>
        currentKeys.has(
          decision.key
        )
    );

  const decisionByKey =
    new Map(
      currentDecisions.map(
        (decision) => [
          decision.key,
          decision
        ]
      )
    );

  const items:
    CandidateReviewItem[] =
    rawItems.map(
      (item) => {
        const decision =
          decisionByKey.get(
            item.key
          );

        return {
          ...item,

          decision:
            decision
              ? {
                  status:
                    decision.status,

                  note:
                    decision.note,

                  decidedAt:
                    decision.decidedAt
                }
              : null
        };
      }
    );

  const approved =
    currentDecisions.filter(
      (decision) =>
        decision.status ===
          "approved"
    ).length;

  const rejected =
    currentDecisions.filter(
      (decision) =>
        decision.status ===
          "rejected"
    ).length;

  return {
    schemaVersion:
      "1.0",

    reportGeneratedAt:
      report.generatedAt,

    reviewUpdatedAt:
      state.updatedAt,

    counts: {
      total:
        items.length,

      approved,

      rejected,

      pending:
        Math.max(
          0,
          items.length -
            approved -
            rejected
        ),

      staleDecisions:
        state.decisions.length -
        currentDecisions.length
    },

    items,

    proposals:
      buildRegistryProposals(
        items,
        currentDecisions
      )
  };
}

export function createPublicCandidateReviewView(
  view:
    CandidateReviewView
): CandidateReviewView {
  return {
    ...view,

    items:
      view.items.map(
        (item) => ({
          ...item,

          decision:
            item.decision
              ? {
                  ...item.decision,

                  note:
                    null
                }
              : null
        })
      ),

    proposals:
      []
  };
}

export async function getCandidateReviewView(
  report:
    BankrCandidateImportReport
): Promise<
  CandidateReviewView
> {
  const state =
    await loadCandidateReviewState();

  return buildCandidateReviewView(
    report,
    state
  );
}

let mutationQueue:
Promise<void> =
  Promise.resolve();

type ResolvedCandidateReviewMutation = {
  input:
    CandidateReviewInput;

  key:
    string;

  item:
    CandidateReviewItem;
};

function resolveCandidateReviewMutations(
  view:
    CandidateReviewView,

  inputs:
    CandidateReviewInput[]
): ResolvedCandidateReviewMutation[] {
  if (
    inputs.length < 1 ||
    inputs.length >
      MAXIMUM_REVIEW_BATCH_SIZE
  ) {
    throw new ClarityError(
      "CANDIDATE_REVIEW_INVALID",
      `Candidate review batch must contain between 1 and ${MAXIMUM_REVIEW_BATCH_SIZE} decisions.`,
      400
    );
  }

  const itemByKey =
    new Map(
      view.items.map(
        (item) => [
          item.key,
          item
        ]
      )
    );

  const seenKeys =
    new Set<string>();

  return inputs.map(
    (input) => {
      const normalized =
        normalizeGitHubRepositoryUrl(
          input.repositoryUrl
        );

      if (!normalized) {
        throw new ClarityError(
          "CANDIDATE_REVIEW_INVALID",
          "Candidate review repository must be a GitHub repository URL.",
          400
        );
      }

      const key =
        createDecisionKey(
          input.bankrProfileId,
          normalized.url
        );

      if (
        seenKeys.has(
          key
        )
      ) {
        throw new ClarityError(
          "CANDIDATE_REVIEW_INVALID",
          "Candidate review batch contains the same repository target more than once.",
          400
        );
      }

      seenKeys.add(
        key
      );

      const item =
        itemByKey.get(
          key
        );

      if (!item) {
        throw new ClarityError(
          "CANDIDATE_REVIEW_TARGET_NOT_FOUND",
          "Candidate repository is not present in the current published report.",
          404
        );
      }

      return {
        input:
          normalizeReviewInput(
            input
          ),

        key,

        item
      };
    }
  );
}

function buildNextCandidateReviewState(
  state:
    CandidateReviewState,

  mutations:
    ResolvedCandidateReviewMutation[]
): CandidateReviewState {
  const now =
    new Date()
      .toISOString();

  const decisionsByKey =
    new Map(
      state.decisions.map(
        (decision) => [
          decision.key,
          decision
        ]
      )
    );

  for (
    const mutation
    of mutations
  ) {
    if (
      mutation.input.decision ===
        "reset"
    ) {
      decisionsByKey.delete(
        mutation.key
      );

      continue;
    }

    decisionsByKey.set(
      mutation.key,
      {
        key:
          mutation.key,

        bankrProfileId:
          mutation.item
            .bankrProfileId,

        bankrSlug:
          mutation.item
            .bankrSlug,

        candidateName:
          mutation.item
            .candidateName,

        repositoryUrl:
          mutation.item
            .repositoryUrl,

        githubOwner:
          mutation.item
            .githubOwner,

        githubRepository:
          mutation.item
            .githubRepository,

        status:
          mutation.input.decision ===
            "approve"
            ? "approved"
            : "rejected",

        note:
          mutation.input.note ??
          null,

        decidedAt:
          now
      }
    );
  }

  return {
    schemaVersion:
      "1.0",

    updatedAt:
      now,

    decisions:
      [
        ...decisionsByKey
          .values()
      ].sort(
        (
          left,
          right
        ) =>
          left.key.localeCompare(
            right.key
          )
      )
  };
}

export async function updateCandidateReviewsBatch(
  report:
    BankrCandidateImportReport,

  inputs:
    CandidateReviewInput[]
): Promise<
  CandidateReviewView
> {
  let resolveResult!:
    (
      value:
        CandidateReviewView
    ) => void;

  let rejectResult!:
    (
      reason:
        unknown
    ) => void;

  const result =
    new Promise<
      CandidateReviewView
    >(
      (
        resolve,
        reject
      ) => {
        resolveResult =
          resolve;

        rejectResult =
          reject;
      }
    );

  mutationQueue =
    mutationQueue
      .catch(
        () => undefined
      )
      .then(
        async () => {
          try {
            const state =
              await loadCandidateReviewState();

            const view =
              buildCandidateReviewView(
                report,
                state
              );

            const mutations =
              resolveCandidateReviewMutations(
                view,
                inputs
              );

            const nextState =
              buildNextCandidateReviewState(
                state,
                mutations
              );

            await saveCandidateReviewState(
              nextState
            );

            resolveResult(
              buildCandidateReviewView(
                report,
                nextState
              )
            );
          } catch (error) {
            rejectResult(
              error
            );
          }
        }
      );

  return result;
}

export async function updateCandidateReview(
  report:
    BankrCandidateImportReport,

  input:
    CandidateReviewInput
): Promise<
  CandidateReviewView
> {
  return updateCandidateReviewsBatch(
    report,
    [
      input
    ]
  );
}
