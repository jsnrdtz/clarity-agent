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
  dirname
} from "node:path";

import {
  z
} from "zod";

import {
  AutomaticAgentRegistrySchema,
  getAutomaticAgentRegistryPath
} from "./automatic-agent-registry.js";

import type {
  AutomaticAgentIdentity,
  AutomaticAgentRegistry
} from "./automatic-agent-registry.js";

import {
  createTokenIdentity,
  createUnavailableHolderSnapshots,
  fetchDexScreenerSnapshots,
  fetchGoPlusSecuritySnapshots
} from "./token-market-data.js";

import type {
  FetchTokenHolderSnapshots,
  TokenDexSnapshot,
  TokenHolderSnapshot,
  TokenReference,
  TokenSecuritySnapshot
} from "./token-market-data.js";

export type TokenScoreCategory =
  | "contractSafety"
  | "distribution"
  | "launchFairness"
  | "liquidity"
  | "marketIntegrity"
  | "identityTransparency";

export type TokenCategoryConfidence =
  | "high"
  | "medium"
  | "low"
  | "none";

export type TokenCategoryScore = {
  score: number | null;
  weight: number;
  available: boolean;

  dataCoverage: number;

  confidence:
    TokenCategoryConfidence;

  evidence: string[];
};

export type TokenScoreBreakdown = {
  provisionalOverall: number | null;

  dataCoverage: number;

  confidence:
    | "high"
    | "medium"
    | "low";

  status:
    | "complete"
    | "partial"
    | "unavailable";

  categories:
    Record<
      TokenScoreCategory,
      TokenCategoryScore
    >;
};

export type TokenIntelligenceEntry = {
  slug: string;
  name: string;

  token: {
    chainId: string;
    address: string;
    identity: string;
    symbol: string;
    name: string;
  };

  identity: {
    website: string | null;
    twitterUsername: string | null;
    descriptionAvailable: boolean;
    bankrMarketCapUsd: number;
    weeklyRevenueWeth: string | null;
  };

  dex:
    TokenDexSnapshot;

  security:
    TokenSecuritySnapshot;

  holders:
    TokenHolderSnapshot;

  scores:
    TokenScoreBreakdown;

  collectedAt: string;
};

export type TokenIntelligenceReport = {
  schemaVersion: "1.0";
  source: "bankr";
  generatedAt: string;

  summary: {
    total: number;

    complete: number;
    partial: number;
    unavailable: number;

    dexAvailable: number;
    securityAvailable: number;
    holdersAvailable: number;

    scoresAvailable: number;
    providerFailures: number;
  };

  tokens:
    TokenIntelligenceEntry[];
};

export type TokenIntelligenceDependencies = {
  fetchDex?: (
    tokens:
      TokenReference[]
  ) => Promise<
    Map<
      string,
      TokenDexSnapshot
    >
  >;

  fetchSecurity?: (
    tokens:
      TokenReference[]
  ) => Promise<
    Map<
      string,
      TokenSecuritySnapshot
    >
  >;

  fetchHolders?:
    FetchTokenHolderSnapshots;

  now?: () => string;
};

export type RunTokenIntelligenceOptions =
  TokenIntelligenceDependencies & {
    registry?:
      AutomaticAgentRegistry;

    registryPath?: string;
    outputPath?: string;
  };

const TokenIntelligenceReportSchema =
  z.object(
    {
      schemaVersion:
        z.literal(
          "1.0"
        ),

      source:
        z.literal(
          "bankr"
        ),

      generatedAt:
        z.string().datetime(),

      summary:
        z.object(
          {
            total:
              z.number()
                .int()
                .nonnegative(),

            complete:
              z.number()
                .int()
                .nonnegative(),

            partial:
              z.number()
                .int()
                .nonnegative(),

            unavailable:
              z.number()
                .int()
                .nonnegative(),

            dexAvailable:
              z.number()
                .int()
                .nonnegative(),

            securityAvailable:
              z.number()
                .int()
                .nonnegative(),

            holdersAvailable:
              z.number()
                .int()
                .nonnegative(),

            scoresAvailable:
              z.number()
                .int()
                .nonnegative(),

            providerFailures:
              z.number()
                .int()
                .nonnegative()
          }
        ),

      tokens:
        z.array(
          z.object(
            {
              slug:
                z.string().min(1),

              name:
                z.string().min(1),

              token:
                z.object(
                  {
                    chainId:
                      z.string().min(1),

                    address:
                      z.string().min(1),

                    identity:
                      z.string().min(1),

                    symbol:
                      z.string().min(1),

                    name:
                      z.string().min(1)
                  }
                ),

              identity:
                z.object(
                  {
                    website:
                      z.string()
                        .nullable(),

                    twitterUsername:
                      z.string()
                        .nullable(),

                    descriptionAvailable:
                      z.boolean(),

                    bankrMarketCapUsd:
                      z.number()
                        .nonnegative(),

                    weeklyRevenueWeth:
                      z.string()
                        .nullable()
                  }
                ),

              dex:
                z.object(
                  {
                    provider:
                      z.literal(
                        "dexscreener"
                      ),

                    status:
                      z.string(),

                    pools:
                      z.number()
                        .int()
                        .nonnegative()
                  }
                )
                  .passthrough(),

              security:
                z.object(
                  {
                    provider:
                      z.literal(
                        "goplus"
                      ),

                    status:
                      z.string(),

                    risks:
                      z.array(
                        z.string()
                      )
                  }
                )
                  .passthrough(),

              holders:
                z.object(
                  {
                    provider:
                      z.string(),

                    status:
                      z.string()
                  }
                )
                  .passthrough(),

              scores:
                z.object(
                  {
                    provisionalOverall:
                      z.number()
                        .min(0)
                        .max(100)
                        .nullable(),

                    dataCoverage:
                      z.number()
                        .min(0)
                        .max(100),

                    confidence:
                      z.enum(
                        [
                          "high",
                          "medium",
                          "low"
                        ]
                      ),

                    status:
                      z.enum(
                        [
                          "complete",
                          "partial",
                          "unavailable"
                        ]
                      ),

                    categories:
                      z.record(
                        z.string(),
                        z.object(
                          {
                            score:
                              z.number()
                                .min(0)
                                .max(100)
                                .nullable(),

                            weight:
                              z.number()
                                .min(0)
                                .max(100),

                            available:
                              z.boolean(),

                            dataCoverage:
                              z.number()
                                .min(0)
                                .max(100),

                            confidence:
                              z.enum(
                                [
                                  "high",
                                  "medium",
                                  "low",
                                  "none"
                                ]
                              ),

                            evidence:
                              z.array(
                                z.string()
                              )
                          }
                        )
                      )
                  }
                ),

              collectedAt:
                z.string().datetime()
            }
          )
        )
    }
  );

const CATEGORY_WEIGHTS:
  Record<
    TokenScoreCategory,
    number
  > = {
    contractSafety:
      20,

    distribution:
      25,

    launchFairness:
      20,

    liquidity:
      20,

    marketIntegrity:
      10,

    identityTransparency:
      5
  };

function clamp(
  value: number,
  minimum = 0,
  maximum = 100
): number {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  );
}

function roundScore(
  value: number
): number {
  return Math.round(
    clamp(
      value
    )
  );
}

function getCategoryConfidence(
  dataCoverage: number
): TokenCategoryConfidence {
  if (
    dataCoverage <= 0
  ) {
    return "none";
  }

  if (
    dataCoverage >= 85
  ) {
    return "high";
  }

  if (
    dataCoverage >= 60
  ) {
    return "medium";
  }

  return "low";
}

function logarithmicScore(
  value: number,
  target: number
): number {
  if (
    value <= 0 ||
    target <= 0
  ) {
    return 0;
  }

  return roundScore(
    (
      Math.log1p(
        Math.min(
          value,
          target
        )
      ) /
      Math.log1p(
        target
      )
    ) *
    100
  );
}

function createUnavailableCategory(
  category:
    TokenScoreCategory,

  evidence:
    string[]
): TokenCategoryScore {
  return {
    score:
      null,

    weight:
      CATEGORY_WEIGHTS[
        category
      ],

    available:
      false,

    dataCoverage:
      0,

    confidence:
      "none",

    evidence
  };
}

function createAvailableCategory(
  category:
    TokenScoreCategory,

  score: number,

  evidence:
    string[],

  dataCoverage =
    100
): TokenCategoryScore {
  const normalizedCoverage =
    roundScore(
      dataCoverage
    );

  return {
    score:
      roundScore(
        score
      ),

    weight:
      CATEGORY_WEIGHTS[
        category
      ],

    available:
      true,

    dataCoverage:
      normalizedCoverage,

    confidence:
      getCategoryConfidence(
        normalizedCoverage
      ),

    evidence
  };
}

function calculateContractSafety(
  security:
    TokenSecuritySnapshot
): TokenCategoryScore {
  if (
    security.status !==
      "available"
  ) {
    return createUnavailableCategory(
      "contractSafety",
      [
        security.error
          ?.message ??
        "Contract security data is unavailable."
      ]
    );
  }

  let score =
    100;

  const evidence:
    string[] = [
      `GoPlus reported ${security.risks.length} explicit risk signals.`
    ];

  const penalties:
    Array<
      [
        boolean | null,
        number,
        string
      ]
    > = [
      [
        security.flags.isHoneypot,
        70,
        "Honeypot behaviour."
      ],

      [
        security.flags.cannotSellAll,
        50,
        "Complete balance may not be sellable."
      ],

      [
        security.flags.cannotBuy,
        35,
        "Purchases may be restricted."
      ],

      [
        security.flags.ownerChangeBalance,
        35,
        "Owner may change holder balances."
      ],

      [
        security.flags.selfDestruct,
        30,
        "Self-destruct behaviour."
      ],

      [
        security.flags.hiddenOwner,
        20,
        "Hidden owner relationship."
      ],

      [
        security.flags.isBlacklisted,
        20,
        "Blacklist functionality."
      ],

      [
        security.flags.isMintable,
        15,
        "Supply may be minted."
      ],

      [
        security.flags.transferPausable,
        12,
        "Transfers may be paused."
      ],

      [
        security.flags.slippageModifiable,
        12,
        "Trading taxes may be modified."
      ],

      [
        security.flags.antiWhaleModifiable,
        8,
        "Anti-whale settings may be modified."
      ],

      [
        security.flags.externalCall,
        8,
        "External calls are possible."
      ],

      [
        security.flags.isProxy,
        5,
        "Proxy contract."
      ]
    ];

  for (
    const [
      active,
      penalty,
      reason
    ]
    of penalties
  ) {
    if (!active) {
      continue;
    }

    score -=
      penalty;

    evidence.push(
      `-${penalty}: ${reason}`
    );
  }

  if (
    security.flags.isOpenSource ===
      false
  ) {
    score -=
      10;

    evidence.push(
      "-10: Contract source is not reported as open."
    );
  }

  const taxPenalties:
    Array<
      [
        number | null,
        string
      ]
    > = [
      [
        security.buyTaxPct,
        "buy"
      ],

      [
        security.sellTaxPct,
        "sell"
      ]
    ];

  for (
    const [
      tax,
      label
    ]
    of taxPenalties
  ) {
    if (
      tax === null
    ) {
      continue;
    }

    if (
      tax > 20
    ) {
      score -=
        25;

      evidence.push(
        `-25: ${label} tax is ${tax.toFixed(2)}%.`
      );
    } else if (
      tax > 10
    ) {
      score -=
        15;

      evidence.push(
        `-15: ${label} tax is ${tax.toFixed(2)}%.`
      );
    } else if (
      tax > 5
    ) {
      score -=
        7;

      evidence.push(
        `-7: ${label} tax is ${tax.toFixed(2)}%.`
      );
    }
  }

  const knownFlags =
    Object
      .values(
        security.flags
      )
      .filter(
        (value) =>
          value !== null
      )
      .length;

  const knownTaxes =
    [
      security.buyTaxPct,
      security.sellTaxPct
    ]
      .filter(
        (value) =>
          value !== null
      )
      .length;

  const totalSecurityFields =
    16;

  const knownSecurityFields =
    knownFlags +
    knownTaxes;

  const dataCoverage =
    knownSecurityFields /
    totalSecurityFields *
    100;

  evidence.unshift(
    `Security field coverage: ${knownFlags}/14 flags and ${knownTaxes}/2 taxes.`
  );

  return createAvailableCategory(
    "contractSafety",
    score,
    evidence,
    dataCoverage
  );
}

function getAgeDays(
  pairCreatedAt: string | null,
  generatedAt: string
): number | null {
  if (!pairCreatedAt) {
    return null;
  }

  const created =
    Date.parse(
      pairCreatedAt
    );

  const generated =
    Date.parse(
      generatedAt
    );

  if (
    Number.isNaN(
      created
    ) ||
    Number.isNaN(
      generated
    )
  ) {
    return null;
  }

  return Math.max(
    0,

    (
      generated -
      created
    ) /
    (
      24 *
      60 *
      60 *
      1000
    )
  );
}

function calculateLiquidity(
  dex:
    TokenDexSnapshot,

  generatedAt: string
): TokenCategoryScore {
  if (
    dex.status !==
      "available"
  ) {
    return createUnavailableCategory(
      "liquidity",
      [
        dex.status ===
          "no-pairs"
          ? "No active DEX pairs were found."
          : (
              dex.error
                ?.message ??
              "DEX liquidity data is unavailable."
            )
      ]
    );
  }

  const liquidity =
    dex.totalLiquidityUsd ??
    0;

  const volume =
    dex.volume24hUsd ??
    0;

  const liquidityScore =
    logarithmicScore(
      liquidity,
      1_000_000
    );

  const volumeScore =
    logarithmicScore(
      volume,
      500_000
    );

  const ageDays =
    getAgeDays(
      dex.pairCreatedAt,
      generatedAt
    );

  const ageScore =
    ageDays ===
      null
      ? 0
      : roundScore(
          Math.min(
            ageDays,
            30
          ) /
          30 *
          100
        );

  const poolScore =
    dex.pools >= 3
      ? 100
      : dex.pools === 2
        ? 75
        : 50;

  const buys =
    dex.buys24h ??
    0;

  const sells =
    dex.sells24h ??
    0;

  const tradeMaximum =
    Math.max(
      buys,
      sells
    );

  const balanceScore =
    tradeMaximum === 0
      ? 0
      : roundScore(
          Math.min(
            buys,
            sells
          ) /
          tradeMaximum *
          100
        );

  const overall =
    liquidityScore *
      0.45 +
    volumeScore *
      0.25 +
    ageScore *
      0.15 +
    poolScore *
      0.05 +
    balanceScore *
      0.10;

  return createAvailableCategory(
    "liquidity",
    overall,
    [
      `$${liquidity.toFixed(2)} total liquidity across ${dex.pools} pools.`,
      `$${volume.toFixed(2)} volume in the last 24 hours.`,
      `${buys} buys and ${sells} sells in the last 24 hours.`,
      ageDays === null
        ? "Pair creation time is unavailable."
        : `Oldest detected pair is ${ageDays.toFixed(1)} days old.`
    ]
  );
}

function calculateMarketIntegrity(
  dex:
    TokenDexSnapshot
): TokenCategoryScore {
  if (
    dex.status !==
      "available"
  ) {
    return createUnavailableCategory(
      "marketIntegrity",
      [
        "DEX transaction data is unavailable."
      ]
    );
  }

  const buys =
    dex.buys24h ??
    0;

  const sells =
    dex.sells24h ??
    0;

  const transactions =
    buys +
    sells;

  const activityScore =
    logarithmicScore(
      transactions,
      1_000
    );

  const maximumSide =
    Math.max(
      buys,
      sells
    );

  const balanceScore =
    maximumSide === 0
      ? 0
      : roundScore(
          Math.min(
            buys,
            sells
          ) /
          maximumSide *
          100
        );

  const liquidity =
    dex.totalLiquidityUsd ??
    0;

  const volume =
    dex.volume24hUsd ??
    0;

  const turnover =
    liquidity > 0
      ? volume /
        liquidity
      : null;

  let turnoverScore =
    0;

  if (
    turnover !== null
  ) {
    if (
      turnover >= 0.01 &&
      turnover <= 5
    ) {
      turnoverScore =
        100;
    } else if (
      turnover > 5 &&
      turnover <= 15
    ) {
      turnoverScore =
        70;
    } else if (
      turnover > 15 &&
      turnover <= 40
    ) {
      turnoverScore =
        35;
    } else if (
      turnover > 40
    ) {
      turnoverScore =
        10;
    } else {
      turnoverScore =
        30;
    }
  }

  return createAvailableCategory(
    "marketIntegrity",

    activityScore *
      0.35 +
    balanceScore *
      0.40 +
    turnoverScore *
      0.25,

    [
      `${transactions} DEX transactions in the last 24 hours.`,
      `Buy/sell balance score: ${balanceScore}/100.`,
      turnover === null
        ? "Volume-to-liquidity ratio is unavailable."
        : `24-hour volume/liquidity ratio: ${turnover.toFixed(2)}.`
    ]
  );
}

function calculateDistribution(
  holders:
    TokenHolderSnapshot
): TokenCategoryScore {
  if (
    holders.status !==
      "available"
  ) {
    return createUnavailableCategory(
      "distribution",
      [
        ...holders.evidence
      ]
    );
  }

  const holderCount =
    holders.holderCount ??
    0;

  const holderScore =
    logarithmicScore(
      holderCount,
      5_000
    );

  const top10Score =
    holders.top10SupplyPct ===
      null
      ? 0
      : roundScore(
          100 -
          holders.top10SupplyPct
        );

  const top20Score =
    holders.top20SupplyPct ===
      null
      ? 0
      : roundScore(
          100 -
          holders.top20SupplyPct
        );

  const relatedScore =
    holders.relatedWalletSupplyPct ===
      null
      ? 50
      : roundScore(
          100 -
          holders.relatedWalletSupplyPct *
            2
        );

  const score =
    holderScore *
      0.25 +
    top10Score *
      0.35 +
    top20Score *
      0.25 +
    relatedScore *
      0.15;

  return createAvailableCategory(
    "distribution",
    score,
    [
      `${holderCount} holders detected.`,
      holders.top10SupplyPct ===
        null
        ? "Top-10 concentration is unavailable."
        : `Top-10 holders control ${holders.top10SupplyPct.toFixed(2)}%.`,
      holders.top20SupplyPct ===
        null
        ? "Top-20 concentration is unavailable."
        : `Top-20 holders control ${holders.top20SupplyPct.toFixed(2)}%.`,
      ...holders.evidence
    ]
  );
}

function calculateIdentityTransparency(
  agent:
    AutomaticAgentIdentity
): TokenCategoryScore {
  let score =
    20;

  const evidence:
    string[] = [
      "Token identity is linked by the Bankr project profile."
    ];

  if (
    agent.website
  ) {
    score +=
      30;

    evidence.push(
      "Official website is available."
    );
  }

  if (
    agent.twitterUsername
  ) {
    score +=
      20;

    evidence.push(
      "Official X account is available."
    );
  }

  if (
    agent.description
  ) {
    score +=
      15;

    evidence.push(
      "Project description is available."
    );
  }

  if (
    agent.market
      .weeklyRevenueWeth !==
      null
  ) {
    score +=
      15;

    evidence.push(
      "Bankr reports weekly revenue data."
    );
  }

  return createAvailableCategory(
    "identityTransparency",
    score,
    evidence
  );
}

function calculateScoreBreakdown(
  agent:
    AutomaticAgentIdentity,

  dex:
    TokenDexSnapshot,

  security:
    TokenSecuritySnapshot,

  holders:
    TokenHolderSnapshot,

  generatedAt: string
): TokenScoreBreakdown {
  const categories:
    TokenScoreBreakdown["categories"] = {
    contractSafety:
      calculateContractSafety(
        security
      ),

    distribution:
      calculateDistribution(
        holders
      ),

    launchFairness:
      createUnavailableCategory(
        "launchFairness",
        [
          "Launch forensics, early buyers, snipers and wallet clusters are not collected in Token Intelligence v1."
        ]
      ),

    liquidity:
      calculateLiquidity(
        dex,
        generatedAt
      ),

    marketIntegrity:
      calculateMarketIntegrity(
        dex
      ),

    identityTransparency:
      calculateIdentityTransparency(
        agent
      )
  };

  const available =
    Object
      .values(
        categories
      )
      .filter(
        (
          category
        ) =>
          category.available &&
          category.score !==
            null
      );

  const availableWeight =
    available.reduce(
      (
        total,
        category
      ) =>
        total +
        category.weight,

      0
    );

  const weightedScore =
    available.reduce(
      (
        total,
        category
      ) =>
        total +
        (
          category.score ??
          0
        ) *
        category.weight,

      0
    );

  const provisionalOverall =
    availableWeight >= 25
      ? roundScore(
          weightedScore /
          availableWeight
        )
      : null;

  const dataCoverage =
    roundScore(
      Object
        .values(
          categories
        )
        .reduce(
          (
            total,
            category
          ) =>
            total +
            category.weight *
            (
              category.dataCoverage /
              100
            ),

          0
        )
    );

  const confidence =
    dataCoverage >= 75
      ? "high"
      : dataCoverage >= 45
        ? "medium"
        : "low";

  const status =
    dataCoverage === 100
      ? "complete"
      : provisionalOverall ===
          null
        ? "unavailable"
        : "partial";

  return {
    provisionalOverall,
    dataCoverage,
    confidence,
    status,
    categories
  };
}

function createMissingDexSnapshot(
  message: string
): TokenDexSnapshot {
  return {
    provider:
      "dexscreener",

    status:
      "failed",

    pools:
      0,

    primaryPair:
      null,

    totalLiquidityUsd:
      null,

    volume24hUsd:
      null,

    buys24h:
      null,

    sells24h:
      null,

    priceUsd:
      null,

    priceChange24hPct:
      null,

    marketCapUsd:
      null,

    fdvUsd:
      null,

    pairCreatedAt:
      null,

    error: {
      provider:
        "dexscreener",

      code:
        "DEX_SNAPSHOT_MISSING",

      message,

      retryable:
        true
    }
  };
}

function createMissingSecuritySnapshot(
  message: string
): TokenSecuritySnapshot {
  return {
    provider:
      "goplus",

    status:
      "failed",

    flags: {
      isOpenSource:
        null,

      isProxy:
        null,

      isHoneypot:
        null,

      cannotBuy:
        null,

      cannotSellAll:
        null,

      isMintable:
        null,

      hiddenOwner:
        null,

      ownerChangeBalance:
        null,

      selfDestruct:
        null,

      externalCall:
        null,

      transferPausable:
        null,

      isBlacklisted:
        null,

      slippageModifiable:
        null,

      antiWhaleModifiable:
        null
    },

    buyTaxPct:
      null,

    sellTaxPct:
      null,

    holderCountReported:
      null,

    creatorAddress:
      null,

    ownerAddress:
      null,

    risks:
      [],

    error: {
      provider:
        "goplus",

      code:
        "SECURITY_SNAPSHOT_MISSING",

      message,

      retryable:
        true
    }
  };
}

function createMissingHolderSnapshot(
  message: string
): TokenHolderSnapshot {
  return {
    provider:
      "unconfigured",

    status:
      "unavailable",

    holderCount:
      null,

    top10SupplyPct:
      null,

    top20SupplyPct:
      null,

    relatedWalletSupplyPct:
      null,

    deployerClusterSupplyPct:
      null,

    evidence: [
      message
    ],

    error:
      null
  };
}

export async function generateTokenIntelligenceReport(
  registry:
    AutomaticAgentRegistry,

  dependencies:
    TokenIntelligenceDependencies = {}
): Promise<
  TokenIntelligenceReport
> {
  const validatedRegistry =
    AutomaticAgentRegistrySchema.parse(
      registry
    );

  const generatedAt =
    dependencies.now?.() ??
    new Date().toISOString();

  const tokens:
    TokenReference[] =
    validatedRegistry.agents.map(
      (agent) => ({
        chainId:
          agent.token.chainId,

        address:
          agent.token.address
      })
    );

  const fetchDex =
    dependencies.fetchDex ??
    fetchDexScreenerSnapshots;

  const fetchSecurity =
    dependencies.fetchSecurity ??
    fetchGoPlusSecuritySnapshots;

  const fetchHolders =
    dependencies.fetchHolders ??
    createUnavailableHolderSnapshots;

  const [
    dexSnapshots,
    securitySnapshots,
    holderSnapshots
  ] = await Promise.all(
    [
      fetchDex(
        tokens
      ),

      fetchSecurity(
        tokens
      ),

      fetchHolders(
        tokens
      )
    ]
  );

  const entries:
    TokenIntelligenceEntry[] =
    validatedRegistry.agents
      .map(
        (
          agent
        ): TokenIntelligenceEntry => {
          const tokenReference = {
            chainId:
              agent.token.chainId,

            address:
              agent.token.address
          };

          const identity =
            createTokenIdentity(
              tokenReference
            );

          const dex =
            dexSnapshots.get(
              identity
            ) ??
            createMissingDexSnapshot(
              "DEX snapshot was not returned for this token."
            );

          const security =
            securitySnapshots.get(
              identity
            ) ??
            createMissingSecuritySnapshot(
              "Security snapshot was not returned for this token."
            );

          const holders =
            holderSnapshots.get(
              identity
            ) ??
            createMissingHolderSnapshot(
              "Holder snapshot was not returned for this token."
            );

          return {
            slug:
              agent.slug,

            name:
              agent.name,

            token: {
              ...agent.token
            },

            identity: {
              website:
                agent.website,

              twitterUsername:
                agent.twitterUsername,

              descriptionAvailable:
                Boolean(
                  agent.description
                ),

              bankrMarketCapUsd:
                agent.market
                  .marketCapUsd,

              weeklyRevenueWeth:
                agent.market
                  .weeklyRevenueWeth
            },

            dex,
            security,
            holders,

            scores:
              calculateScoreBreakdown(
                agent,
                dex,
                security,
                holders,
                generatedAt
              ),

            collectedAt:
              generatedAt
          };
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          left.slug.localeCompare(
            right.slug
          )
      );

  const providerFailures =
    entries.reduce(
      (
        total,
        entry
      ) =>
        total +
        (
          entry.dex.status ===
            "failed"
            ? 1
            : 0
        ) +
        (
          entry.security.status ===
            "failed"
            ? 1
            : 0
        ) +
        (
          entry.holders.status ===
            "failed"
            ? 1
            : 0
        ),

      0
    );

  const report:
    TokenIntelligenceReport = {
    schemaVersion:
      "1.0",

    source:
      "bankr",

    generatedAt,

    summary: {
      total:
        entries.length,

      complete:
        entries.filter(
          (entry) =>
            entry.scores.status ===
              "complete"
        ).length,

      partial:
        entries.filter(
          (entry) =>
            entry.scores.status ===
              "partial"
        ).length,

      unavailable:
        entries.filter(
          (entry) =>
            entry.scores.status ===
              "unavailable"
        ).length,

      dexAvailable:
        entries.filter(
          (entry) =>
            entry.dex.status ===
              "available"
        ).length,

      securityAvailable:
        entries.filter(
          (entry) =>
            entry.security.status ===
              "available"
        ).length,

      holdersAvailable:
        entries.filter(
          (entry) =>
            entry.holders.status ===
              "available"
        ).length,

      scoresAvailable:
        entries.filter(
          (entry) =>
            entry.scores
              .provisionalOverall !==
              null
        ).length,

      providerFailures
    },

    tokens:
      entries
  };

  return TokenIntelligenceReportSchema.parse(
    report
  ) as TokenIntelligenceReport;
}

export function getTokenIntelligenceReportPath():
string {
  return (
    process.env
      .CLARITY_TOKEN_INTELLIGENCE_REPORT_PATH ??
    "data/token-intelligence/bankr-tokens.json"
  );
}

export async function loadAutomaticAgentRegistry(
  inputPath =
    getAutomaticAgentRegistryPath()
): Promise<
  AutomaticAgentRegistry
> {
  const content =
    await readFile(
      inputPath,
      "utf8"
    );

  return AutomaticAgentRegistrySchema.parse(
    JSON.parse(
      content
    )
  );
}

export async function saveTokenIntelligenceReport(
  report:
    TokenIntelligenceReport,

  outputPath =
    getTokenIntelligenceReportPath()
): Promise<string> {
  const validated =
    TokenIntelligenceReportSchema.parse(
      report
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

      "utf8"
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

  return outputPath;
}

export async function runTokenIntelligence(
  options:
    RunTokenIntelligenceOptions = {}
): Promise<{
  report: TokenIntelligenceReport;
  outputPath: string;
}> {
  const registry =
    options.registry ??
    await loadAutomaticAgentRegistry(
      options.registryPath
    );

  const report =
    await generateTokenIntelligenceReport(
      registry,
      {
        fetchDex:
          options.fetchDex,

        fetchSecurity:
          options.fetchSecurity,

        fetchHolders:
          options.fetchHolders,

        now:
          options.now
      }
    );

  const outputPath =
    await saveTokenIntelligenceReport(
      report,
      options.outputPath
    );

  return {
    report,
    outputPath
  };
}
