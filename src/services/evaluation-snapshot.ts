import {
  randomUUID
} from "node:crypto";

import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";

import {
  join
} from "node:path";

import {
  isClarityError
} from "../errors/clarity-error.js";

import {
  buildAgentEvaluation,
  type AgentEvaluation
} from "./agent-evaluation.js";

export type AgentEvaluationSnapshot = {
  schemaVersion: "1.0";
  savedAt: string;
  evaluation: AgentEvaluation;
};

export type EvaluationDelivery = {
  source: "live" | "snapshot";
  stale: boolean;
  snapshotSavedAt: string | null;
  liveError: string | null;
};

export type ResolvedAgentEvaluation = {
  evaluation: AgentEvaluation;
  delivery: EvaluationDelivery;
};

export type EvaluationSnapshotDependencies = {
  buildLiveEvaluation: (
    agentSlug: string
  ) => Promise<AgentEvaluation>;

  saveSnapshot: (
    evaluation: AgentEvaluation
  ) => Promise<AgentEvaluationSnapshot>;

  loadSnapshot: (
    agentSlug: string
  ) => Promise<AgentEvaluationSnapshot | null>;
};

function getSnapshotDirectory(): string {
  return (
    process.env.CLARITY_SNAPSHOT_DIR ??
    "data/snapshots"
  );
}

function normalizeAgentSlug(
  agentSlug: string
): string {
  const normalized =
    agentSlug
      .trim()
      .toLowerCase();

  if (
    !/^[a-z0-9][a-z0-9._-]*$/.test(
      normalized
    )
  ) {
    throw new Error(
      `Invalid agent slug: "${agentSlug}"`
    );
  }

  return normalized;
}

function getSnapshotPath(
  agentSlug: string
): string {
  const normalized =
    normalizeAgentSlug(
      agentSlug
    );

  return join(
    getSnapshotDirectory(),
    `${normalized}.json`
  );
}

function isSnapshot(
  value: unknown
): value is AgentEvaluationSnapshot {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Partial<AgentEvaluationSnapshot>;

  return (
    candidate.schemaVersion === "1.0" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.evaluation === "object" &&
    candidate.evaluation !== null &&
    candidate.evaluation.schemaVersion === "1.0" &&
    typeof candidate.evaluation.agent?.slug ===
      "string"
  );
}

function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Unknown live evaluation error.";
}

export async function saveAgentEvaluationSnapshot(
  evaluation: AgentEvaluation
): Promise<AgentEvaluationSnapshot> {
  const directory =
    getSnapshotDirectory();

  await mkdir(
    directory,
    {
      recursive: true
    }
  );

  const snapshot:
  AgentEvaluationSnapshot = {
    schemaVersion: "1.0",

    savedAt:
      new Date().toISOString(),

    evaluation
  };

  const finalPath =
    getSnapshotPath(
      evaluation.agent.slug
    );

  const temporaryPath =
    `${finalPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(
      temporaryPath,

      JSON.stringify(
        snapshot,
        null,
        2
      ) + "\n",

      "utf8"
    );

    await rename(
      temporaryPath,
      finalPath
    );
  } catch (error) {
    await unlink(
      temporaryPath
    ).catch(
      () => undefined
    );

    throw error;
  }

  return snapshot;
}

export async function loadAgentEvaluationSnapshot(
  agentSlug: string
): Promise<AgentEvaluationSnapshot | null> {
  const snapshotPath =
    getSnapshotPath(
      agentSlug
    );

  let content: string;

  try {
    content =
      await readFile(
        snapshotPath,
        "utf8"
      );
  } catch (
    error: unknown
  ) {
    const code =
      (
        error as {
          code?: string;
        }
      ).code;

    if (code === "ENOENT") {
      return null;
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(content);
  } catch {
    return null;
  }

  if (!isSnapshot(parsed)) {
    return null;
  }

  if (
    parsed.evaluation.agent.slug
      .toLowerCase() !==
    normalizeAgentSlug(agentSlug)
  ) {
    return null;
  }

  return parsed;
}

const defaultDependencies:
EvaluationSnapshotDependencies = {
  buildLiveEvaluation:
    buildAgentEvaluation,

  saveSnapshot:
    saveAgentEvaluationSnapshot,

  loadSnapshot:
    loadAgentEvaluationSnapshot
};

function resolveDependencies(
  overrides:
    Partial<EvaluationSnapshotDependencies>
): EvaluationSnapshotDependencies {
  return {
    ...defaultDependencies,
    ...overrides
  };
}

export async function resolveAgentEvaluation(
  agentSlug: string,

  dependencyOverrides:
    Partial<EvaluationSnapshotDependencies> = {}
): Promise<ResolvedAgentEvaluation> {
  const dependencies =
    resolveDependencies(
      dependencyOverrides
    );

  try {
    const evaluation =
      await dependencies
        .buildLiveEvaluation(
          agentSlug
        );

    let snapshotSavedAt:
      string | null = null;

    try {
      const snapshot =
        await dependencies
          .saveSnapshot(
            evaluation
          );

      snapshotSavedAt =
        snapshot.savedAt;
    } catch {
      snapshotSavedAt =
        null;
    }

    return {
      evaluation,

      delivery: {
        source: "live",
        stale: false,
        snapshotSavedAt,
        liveError: null
      }
    };
  } catch (liveError) {
    if (
      !isClarityError(liveError) ||
      !liveError.retryable
    ) {
      throw liveError;
    }

    let snapshot:
      AgentEvaluationSnapshot | null =
        null;

    try {
      snapshot =
        await dependencies
          .loadSnapshot(
            agentSlug
          );
    } catch {
      snapshot =
        null;
    }

    if (!snapshot) {
      throw liveError;
    }

    return {
      evaluation:
        snapshot.evaluation,

      delivery: {
        source: "snapshot",
        stale: true,

        snapshotSavedAt:
          snapshot.savedAt,

        liveError:
          getErrorMessage(
            liveError
          )
      }
    };
  }
}

const DEFAULT_RANKING_SNAPSHOT_MAX_AGE_MS =
  6 * 60 * 60 * 1000;

type RecentEvaluationDependencies = {
  loadSnapshot: (
    agentSlug: string
  ) => Promise<AgentEvaluationSnapshot | null>;

  resolveLiveEvaluation: (
    agentSlug: string
  ) => Promise<ResolvedAgentEvaluation>;

  now: () => number;
  maxAgeMs: number;
};

function getRankingSnapshotMaxAgeMs():
number {
  const rawValue =
    process.env
      .CLARITY_RANKING_SNAPSHOT_MAX_AGE_MS;

  if (!rawValue) {
    return (
      DEFAULT_RANKING_SNAPSHOT_MAX_AGE_MS
    );
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < 0
  ) {
    return (
      DEFAULT_RANKING_SNAPSHOT_MAX_AGE_MS
    );
  }

  return parsedValue;
}

function resolveRecentEvaluationDependencies(
  overrides:
    Partial<RecentEvaluationDependencies>
): RecentEvaluationDependencies {
  return {
    loadSnapshot:
      loadAgentEvaluationSnapshot,

    resolveLiveEvaluation:
      resolveAgentEvaluation,

    now:
      () => Date.now(),

    maxAgeMs:
      getRankingSnapshotMaxAgeMs(),

    ...overrides
  };
}

function isRecentSnapshot(
  snapshot:
    AgentEvaluationSnapshot,

  now: number,
  maxAgeMs: number
): boolean {
  const savedAt =
    new Date(
      snapshot.savedAt
    ).getTime();

  if (
    !Number.isFinite(savedAt)
  ) {
    return false;
  }

  const age =
    now - savedAt;

  return (
    age >= 0 &&
    age <= maxAgeMs
  );
}

export async function getAgentEvaluation(
  agentSlug: string,

  dependencyOverrides:
    Partial<RecentEvaluationDependencies> = {}
): Promise<AgentEvaluation> {
  const dependencies =
    resolveRecentEvaluationDependencies(
      dependencyOverrides
    );

  try {
    const snapshot =
      await dependencies
        .loadSnapshot(
          agentSlug
        );

    if (
      snapshot &&
      isRecentSnapshot(
        snapshot,
        dependencies.now(),
        dependencies.maxAgeMs
      )
    ) {
      return snapshot.evaluation;
    }
  } catch {
    // Snapshot storage is an optional
    // read-through optimization.
  }

  const resolved =
    await dependencies
      .resolveLiveEvaluation(
        agentSlug
      );

  return resolved.evaluation;
}
