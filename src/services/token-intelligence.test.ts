import assert from "node:assert/strict";

import {
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";

import {
  tmpdir
} from "node:os";

import {
  join
} from "node:path";

import test from "node:test";

import type {
  AutomaticAgentRegistry
} from "./automatic-agent-registry.js";

import {
  generateTokenIntelligenceReport,
  saveTokenIntelligenceReport
} from "./token-intelligence.js";

import {
  createTokenIdentity,
  fetchDexScreenerSnapshots,
  fetchGoPlusSecuritySnapshots
} from "./token-market-data.js";

import type {
  TokenDexSnapshot,
  TokenReference,
  TokenSecuritySnapshot
} from "./token-market-data.js";

const TOKEN_ADDRESS =
  `0x${"ab".repeat(20)}`;

function createRegistry():
AutomaticAgentRegistry {
  return {
    schemaVersion:
      "1.0",

    source:
      "bankr",

    generatedAt:
      "2026-06-30T00:00:00.000Z",

    summary: {
      total:
        1,

      githubVerified:
        0,

      githubProbable:
        0,

      githubUnresolved:
        1,

      agentScoreEligible:
        0,

      tokenScoreEligible:
        1
    },

    agents: [
      {
        source:
          "bankr",

        bankrProfileId:
          "profile-1",

        slug:
          "example-agent",

        name:
          "Example Agent",

        aliases: [
          "example-agent"
        ],

        description:
          "Example autonomous agent.",

        website:
          "https://example.xyz",

        twitterUsername:
          "exampleagent",

        token: {
          chainId:
            "base",

          address:
            TOKEN_ADDRESS,

          identity:
            `base:${TOKEN_ADDRESS}`,

          symbol:
            "EXAMPLE",

          name:
            "Example Agent"
        },

        market: {
          marketCapUsd:
            100_000,

          weeklyRevenueWeth:
            "1.25"
        },

        github: {
          status:
            "unresolved",

          conflict:
            false,

          selected:
            null,

          candidates:
            []
        },

        eligibility: {
          agentScore:
            false,

          tokenScore:
            true,

          reasons: [
            "Token identity is available."
          ]
        },

        warnings:
          [],

        createdAt:
          "2026-01-01T00:00:00.000Z"
      }
    ]
  };
}

test(
  "aggregates DEX Screener pools for one token",
  async () => {
    const fetcher:
      typeof fetch =
      async () =>
        new Response(
          JSON.stringify(
            [
              {
                chainId:
                  "base",

                dexId:
                  "dex-one",

                pairAddress:
                  "0xpairone",

                url:
                  "https://dex.example/pair-one",

                baseToken: {
                  address:
                    TOKEN_ADDRESS
                },

                quoteToken: {
                  address:
                    `0x${"cd".repeat(20)}`
                },

                priceUsd:
                  "0.10",

                liquidity: {
                  usd:
                    100_000
                },

                volume: {
                  h24:
                    50_000
                },

                txns: {
                  h24: {
                    buys:
                      100,

                    sells:
                      80
                  }
                },

                priceChange: {
                  h24:
                    5
                },

                marketCap:
                  1_000_000,

                fdv:
                  1_100_000,

                pairCreatedAt:
                  Date.parse(
                    "2026-06-01T00:00:00.000Z"
                  )
              },

              {
                chainId:
                  "base",

                dexId:
                  "dex-two",

                pairAddress:
                  "0xpairtwo",

                baseToken: {
                  address:
                    TOKEN_ADDRESS
                },

                quoteToken: {
                  address:
                    `0x${"ef".repeat(20)}`
                },

                liquidity: {
                  usd:
                    50_000
                },

                volume: {
                  h24:
                    20_000
                },

                txns: {
                  h24: {
                    buys:
                      40,

                    sells:
                      30
                  }
                },

                pairCreatedAt:
                  Date.parse(
                    "2026-06-10T00:00:00.000Z"
                  )
              }
            ]
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

    const token = {
      chainId:
        "base",

      address:
        TOKEN_ADDRESS
    };

    const snapshots =
      await fetchDexScreenerSnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      snapshot.status,
      "available"
    );

    assert.equal(
      snapshot.pools,
      2
    );

    assert.equal(
      snapshot.totalLiquidityUsd,
      150_000
    );

    assert.equal(
      snapshot.volume24hUsd,
      70_000
    );

    assert.equal(
      snapshot.buys24h,
      140
    );

    assert.equal(
      snapshot.sells24h,
      110
    );

    assert.equal(
      snapshot.primaryPair
        ?.pairAddress,
      "0xpairone"
    );

    assert.deepEqual(
      snapshot.poolAddresses,
      [
        "0xpairone",
        "0xpairtwo"
      ]
    );
  }
);

test(
  "normalizes GoPlus security flags and taxes",
  async () => {
    const fetcher:
      typeof fetch =
      async () =>
        new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result: {
                [
                  TOKEN_ADDRESS
                    .toLowerCase()
                ]: {
                  is_open_source:
                    "1",

                  is_honeypot:
                    "1",

                  is_mintable:
                    "0",

                  hidden_owner:
                    "0",

                  buy_tax:
                    "0.05",

                  sell_tax:
                    "0.12",

                  holder_count:
                    "1234",

                  creator_address:
                    `0x${"12".repeat(20)}`
                }
              }
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

    const token = {
      chainId:
        "base",

      address:
        TOKEN_ADDRESS
    };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      snapshot.status,
      "available"
    );

    assert.equal(
      snapshot.flags.isOpenSource,
      true
    );

    assert.equal(
      snapshot.flags.isHoneypot,
      true
    );

    assert.equal(
      snapshot.buyTaxPct,
      5
    );

    assert.equal(
      snapshot.sellTaxPct,
      12
    );

    assert.equal(
      snapshot.holderCountReported,
      1234
    );

    assert.ok(
      snapshot.risks.some(
        (risk) =>
          risk.includes(
            "honeypot"
          )
      )
    );
  }
);

test(
  "builds a partial score when holders and launch analysis are unavailable",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const dex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "available",

      pools:
        1,

      primaryPair: {
        chainId:
          "base",

        dexId:
          "example-dex",

        pairAddress:
          "0xpair",

        url:
          null
      },

      totalLiquidityUsd:
        250_000,

      volume24hUsd:
        100_000,

      buys24h:
        200,

      sells24h:
        180,

      priceUsd:
        0.1,

      priceChange24hPct:
        2,

      marketCapUsd:
        1_000_000,

      fdvUsd:
        1_100_000,

      pairCreatedAt:
        "2026-06-01T00:00:00.000Z",

      error:
        null
    };

    const security:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          false,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        0,

      holderCountReported:
        1_000,

      creatorAddress:
        null,

      ownerAddress:
        null,

      risks:
        [],

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    dex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    security
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    assert.equal(
      report.summary.total,
      1
    );

    assert.equal(
      report.summary.partial,
      1
    );

    assert.equal(
      report.summary.complete,
      0
    );

    assert.equal(
      entry.scores.status,
      "partial"
    );

    assert.equal(
      entry.scores.dataCoverage,
      55
    );

    assert.equal(
      entry.scores.confidence,
      "medium"
    );

    assert.notEqual(
      entry.scores
        .provisionalOverall,
      null
    );

    assert.equal(
      entry.scores
        .categories
        .distribution
        .available,
      false
    );

    assert.equal(
      entry.scores
        .categories
        .launchFairness
        .available,
      false
    );
  }
);

test(
  "penalizes critical contract risks",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const safeSecurity:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          false,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        0,

      holderCountReported:
        null,

      creatorAddress:
        null,

      ownerAddress:
        null,

      risks:
        [],

      error:
        null
    };

    const riskySecurity:
      TokenSecuritySnapshot = {
      ...safeSecurity,

      flags: {
        ...safeSecurity.flags,

        isHoneypot:
          true,

        ownerChangeBalance:
          true
      },

      sellTaxPct:
        25,

      risks: [
        "Honeypot behaviour.",
        "Owner may change holder balances.",
        "High sell tax."
      ]
    };

    const unavailableDex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "no-pairs",

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

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    unavailableDex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    riskySecurity
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    assert.equal(
      entry.scores
        .categories
        .contractSafety
        .score,
      0
    );
  }
);

test(
  "saves token intelligence atomically",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "clarity-token-intelligence-"
        )
      );

    const outputPath =
      join(
        directory,
        "bankr-tokens.json"
      );

    try {
      const report =
        await generateTokenIntelligenceReport(
          createRegistry(),
          {
            fetchDex:
              async (
                tokens
              ) =>
                new Map(
                  tokens.map(
                    (token) => [
                      createTokenIdentity(
                        token
                      ),

                      {
                        provider:
                          "dexscreener",

                        status:
                          "no-pairs",

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

                        error:
                          null
                      }
                    ]
                  )
                ),

            fetchSecurity:
              async (
                tokens
              ) =>
                new Map(
                  tokens.map(
                    (token) => [
                      createTokenIdentity(
                        token
                      ),

                      {
                        provider:
                          "goplus",

                        status:
                          "unavailable",

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

                        error:
                          null
                      }
                    ]
                  )
                ),

            now:
              () =>
                "2026-06-30T00:00:00.000Z"
          }
        );

      await saveTokenIntelligenceReport(
        report,
        outputPath
      );

      const stored =
        JSON.parse(
          await readFile(
            outputPath,
            "utf8"
          )
        );

      assert.equal(
        stored.schemaVersion,
        "1.0"
      );

      assert.equal(
        stored.summary.total,
        1
      );

      assert.equal(
        stored.tokens[0]
          .slug,
        "example-agent"
      );
    } finally {
      await rm(
        directory,
        {
          recursive:
            true,

          force:
            true
        }
      );
    }
  }
);
test(
  "requests GoPlus security data one token at a time",
  async () => {
    const secondAddress =
      `0x${"cd".repeat(20)}`;

    const requestedAddresses:
      string[] =
      [];

    const sleepCalls:
      number[] =
      [];

    const fetcher:
      typeof fetch =
      async (
        input
      ) => {
        const url =
          new URL(
            String(
              input
            )
          );

        const address =
          url.searchParams.get(
            "contract_addresses"
          );

        assert.ok(
          address
        );

        requestedAddresses.push(
          address
        );

        return new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result: {
                [
                  address.toLowerCase()
                ]: {
                  is_open_source:
                    "1",

                  is_honeypot:
                    "0",

                  holder_count:
                    "100"
                }
              }
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      };

    const tokens:
      TokenReference[] = [
        {
          chainId:
            "base",

          address:
            TOKEN_ADDRESS
        },

        {
          chainId:
            "base",

          address:
            secondAddress
        }
      ];

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        tokens,
        {
          fetch:
            fetcher,

          requestIntervalMs:
            7,

          sleep:
            async (
              milliseconds
            ) => {
              sleepCalls.push(
                milliseconds
              );
            }
        }
      );

    assert.deepEqual(
      requestedAddresses,
      [
        TOKEN_ADDRESS.toLowerCase(),
        secondAddress.toLowerCase()
      ]
    );

    assert.equal(
      requestedAddresses.some(
        (address) =>
          address.includes(
            ","
          )
      ),
      false
    );

    assert.deepEqual(
      sleepCalls,
      [
        7
      ]
    );

    for (
      const token
      of tokens
    ) {
      const snapshot =
        snapshots.get(
          createTokenIdentity(
            token
          )
        );

      assert.ok(
        snapshot
      );

      assert.equal(
        snapshot.status,
        "available"
      );

      assert.equal(
        snapshot.holderCountReported,
        100
      );
    }
  }
);
test(
  "separates contract risk score from security evidence coverage",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const dex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "no-pairs",

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

      error:
        null
    };

    const security:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          null,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        null,

      holderCountReported:
        1_000,

      creatorAddress:
        `0x${"12".repeat(20)}`,

      ownerAddress:
        `0x${"34".repeat(20)}`,

      risks:
        [],

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    dex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    security
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    const contractSafety =
      entry.scores
        .categories
        .contractSafety;

    assert.equal(
      contractSafety.score,
      100
    );

    assert.equal(
      contractSafety.dataCoverage,
      88
    );

    assert.equal(
      contractSafety.confidence,
      "high"
    );

    assert.equal(
      entry.scores.dataCoverage,
      23
    );

    assert.equal(
      entry.scores.confidence,
      "low"
    );

    assert.match(
      contractSafety.evidence[0] ??
        "",
      /13\/14 flags and 1\/2 taxes/u
    );
  }
);
test(
  "normalizes GoPlus top-holder metadata",
  async () => {
    const burnAddress =
      "0x000000000000000000000000000000000000dead";

    const whaleAddress =
      `0x${"56".repeat(20)}`;

    const fetcher:
      typeof fetch =
      async () =>
        new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result: {
                [
                  TOKEN_ADDRESS
                    .toLowerCase()
                ]: {
                  is_open_source:
                    "1",

                  holder_count:
                    "1000",

                  total_supply:
                    "1000000",

                  creator_percent:
                    "0.05",

                  holders: [
                    {
                      address:
                        burnAddress,

                      balance:
                        "400000",

                      percent:
                        "0.4",

                      is_contract:
                        "0",

                      is_locked:
                        "0",

                      tag:
                        "Burn Address"
                    },

                    {
                      address:
                        whaleAddress,

                      balance:
                        "250000",

                      percent:
                        "0.25",

                      is_contract:
                        "0",

                      is_locked:
                        "0",

                      tag:
                        ""
                    }
                  ]
                }
              }
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      snapshot.totalSupply,
      "1000000"
    );

    assert.equal(
      snapshot.creatorSupplyPct,
      5
    );

    assert.equal(
      snapshot.topHolders
        ?.length,
      2
    );

    assert.equal(
      snapshot.topHolders
        ?.[0]
        ?.percentPct,
      40
    );

    assert.equal(
      snapshot.topHolders
        ?.[0]
        ?.excludedFromCirculatingConcentration,
      true
    );

    assert.equal(
      snapshot.topHolders
        ?.[1]
        ?.excludedFromCirculatingConcentration,
      false
    );
  }
);

test(
  "derives partial holder distribution from the GoPlus security response",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const dex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "no-pairs",

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

      error:
        null
    };

    const security:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          false,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        0,

      holderCountReported:
        1_000,

      creatorAddress:
        `0x${"12".repeat(20)}`,

      ownerAddress:
        `0x${"34".repeat(20)}`,

      totalSupply:
        "1000000",

      creatorSupplyPct:
        5,

      topHolders: [
        {
          address:
            "0x000000000000000000000000000000000000dead",

          balance:
            "400000",

          percentPct:
            40,

          isContract:
            false,

          isLocked:
            false,

          tag:
            "Burn Address",

          excludedFromCirculatingConcentration:
            true,

          exclusionReason:
            "Known burn address."
        },

        {
          address:
            `0x${"56".repeat(20)}`,

          balance:
            "100000",

          percentPct:
            10,

          isContract:
            true,

          isLocked:
            true,

          tag:
            "Token Locker",

          excludedFromCirculatingConcentration:
            true,

          exclusionReason:
            "Holder is locked."
        },

        {
          address:
            `0x${"78".repeat(20)}`,

          balance:
            "250000",

          percentPct:
            25,

          isContract:
            false,

          isLocked:
            false,

          tag:
            null,

          excludedFromCirculatingConcentration:
            false,

          exclusionReason:
            null
        }
      ],

      risks:
        [],

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    dex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    security
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    assert.equal(
      report.summary
        .holdersAvailable,
      1
    );

    assert.equal(
      entry.holders.provider,
      "goplus"
    );

    assert.equal(
      entry.holders.status,
      "available"
    );

    assert.equal(
      entry.holders
        .sampledHolders,
      3
    );

    assert.equal(
      entry.holders
        .rawTop10SupplyPct,
      75
    );

    assert.equal(
      entry.holders
        .excludedKnownSupplyPct,
      50
    );

    assert.equal(
      entry.holders
        .top10SupplyPct,
      25
    );

    const distribution =
      entry.scores
        .categories
        .distribution;

    assert.equal(
      distribution.available,
      true
    );

    assert.equal(
      distribution.dataCoverage,
      75
    );

    assert.equal(
      distribution.confidence,
      "medium"
    );

    assert.notEqual(
      distribution.score,
      null
    );

    assert.equal(
      entry.scores
        .dataCoverage,
      44
    );

    assert.notEqual(
      entry.scores
        .provisionalOverall,
      null
    );
  }
);
test(
  "excludes detected DEX pool addresses from circulating concentration",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const liquidityPoolAddress =
      `0x${"90".repeat(20)}`;

    const whaleAddress =
      `0x${"91".repeat(20)}`;

    const dex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "available",

      pools:
        1,

      poolAddresses: [
        liquidityPoolAddress
      ],

      primaryPair: {
        chainId:
          "base",

        dexId:
          "example-dex",

        pairAddress:
          liquidityPoolAddress,

        url:
          null
      },

      totalLiquidityUsd:
        100_000,

      volume24hUsd:
        10_000,

      buys24h:
        20,

      sells24h:
        20,

      priceUsd:
        1,

      priceChange24hPct:
        0,

      marketCapUsd:
        1_000_000,

      fdvUsd:
        1_000_000,

      pairCreatedAt:
        "2026-06-01T00:00:00.000Z",

      error:
        null
    };

    const security:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          false,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        0,

      holderCountReported:
        1_000,

      creatorAddress:
        null,

      ownerAddress:
        null,

      totalSupply:
        "1000000",

      creatorSupplyPct:
        0,

      topHolders: [
        {
          address:
            liquidityPoolAddress,

          balance:
            "700000",

          percentPct:
            70,

          isContract:
            true,

          isLocked:
            false,

          tag:
            null,

          excludedFromCirculatingConcentration:
            false,

          exclusionReason:
            null
        },

        {
          address:
            whaleAddress,

          balance:
            "200000",

          percentPct:
            20,

          isContract:
            false,

          isLocked:
            false,

          tag:
            null,

          excludedFromCirculatingConcentration:
            false,

          exclusionReason:
            null
        }
      ],

      risks:
        [],

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    dex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    security
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    assert.equal(
      entry.holders
        .rawTop10SupplyPct,
      90
    );

    assert.equal(
      entry.holders
        .dexPoolSupplyPct,
      70
    );

    assert.equal(
      entry.holders
        .excludedKnownSupplyPct,
      70
    );

    assert.equal(
      entry.holders
        .top10SupplyPct,
      20
    );

    assert.match(
      entry.holders
        .evidence
        .join(" "),
      /matched detected DEX pair addresses/u
    );
  }
);
test(
  "excludes the verified Base Uniswap v4 PoolManager from concentration",
  async () => {
    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const identity =
      createTokenIdentity(
        token
      );

    const poolManagerAddress =
      "0x498581ff718922c3f8e6a244956af099b2652b2b";

    const whaleAddress =
      `0x${"92".repeat(20)}`;

    const dex:
      TokenDexSnapshot = {
      provider:
        "dexscreener",

      status:
        "no-pairs",

      pools:
        0,

      poolAddresses:
        [],

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

      error:
        null
    };

    const security:
      TokenSecuritySnapshot = {
      provider:
        "goplus",

      status:
        "available",

      flags: {
        isOpenSource:
          true,

        isProxy:
          false,

        isHoneypot:
          false,

        cannotBuy:
          false,

        cannotSellAll:
          false,

        isMintable:
          false,

        hiddenOwner:
          false,

        ownerChangeBalance:
          false,

        selfDestruct:
          false,

        externalCall:
          false,

        transferPausable:
          false,

        isBlacklisted:
          false,

        slippageModifiable:
          false,

        antiWhaleModifiable:
          false
      },

      buyTaxPct:
        0,

      sellTaxPct:
        0,

      holderCountReported:
        1_000,

      creatorAddress:
        null,

      ownerAddress:
        null,

      totalSupply:
        "1000000",

      creatorSupplyPct:
        0,

      topHolders: [
        {
          address:
            poolManagerAddress,

          balance:
            "700000",

          percentPct:
            70,

          isContract:
            true,

          isLocked:
            false,

          tag:
            null,

          excludedFromCirculatingConcentration:
            false,

          exclusionReason:
            null
        },

        {
          address:
            whaleAddress,

          balance:
            "200000",

          percentPct:
            20,

          isContract:
            false,

          isLocked:
            false,

          tag:
            null,

          excludedFromCirculatingConcentration:
            false,

          exclusionReason:
            null
        }
      ],

      risks:
        [],

      error:
        null
    };

    const report =
      await generateTokenIntelligenceReport(
        createRegistry(),
        {
          fetchDex:
            async () =>
              new Map(
                [
                  [
                    identity,
                    dex
                  ]
                ]
              ),

          fetchSecurity:
            async () =>
              new Map(
                [
                  [
                    identity,
                    security
                  ]
                ]
              ),

          now:
            () =>
              "2026-06-30T00:00:00.000Z"
        }
      );

    const entry =
      report.tokens[0];

    assert.ok(entry);

    assert.equal(
      entry.holders
        .rawTop10SupplyPct,
      90
    );

    assert.equal(
      entry.holders
        .dexPoolSupplyPct,
      0
    );

    assert.equal(
      entry.holders
        .protocolLiquiditySupplyPct,
      70
    );

    assert.equal(
      entry.holders
        .excludedKnownSupplyPct,
      70
    );

    assert.equal(
      entry.holders
        .top10SupplyPct,
      20
    );

    assert.match(
      entry.holders
        .evidence
        .join(" "),
      /Uniswap v4 PoolManager/u
    );

    assert.match(
      entry.holders
        .evidence
        .join(" "),
      /verified protocol liquidity custody/u
    );
  }
);
test(
  "retries empty GoPlus records and preserves attempt metadata",
  async () => {
    let requestCount =
      0;

    const sleepCalls:
      number[] =
      [];

    const fetcher:
      typeof fetch =
      async () => {
        requestCount +=
          1;

        const result =
          requestCount < 3
            ? {}
            : {
                [
                  TOKEN_ADDRESS
                    .toLowerCase()
                ]: {
                  is_open_source:
                    "1",

                  is_honeypot:
                    "0",

                  holder_count:
                    "321"
                }
              };

        return new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      };

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher,

          requestIntervalMs:
            11,

          sleep:
            async (
              milliseconds
            ) => {
              sleepCalls.push(
                milliseconds
              );
            }
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      requestCount,
      3
    );

    assert.deepEqual(
      sleepCalls,
      [
        11,
        11
      ]
    );

    assert.equal(
      snapshot.status,
      "available"
    );

    assert.equal(
      snapshot.attempts,
      3
    );

    assert.equal(
      snapshot.unavailableReason,
      null
    );

    assert.equal(
      snapshot.holderCountReported,
      321
    );
  }
);

test(
  "marks exhausted empty GoPlus records as unavailable",
  async () => {
    let requestCount =
      0;

    const sleepCalls:
      number[] =
      [];

    const fetcher:
      typeof fetch =
      async () => {
        requestCount +=
          1;

        return new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result: {}
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      };

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher,

          requestIntervalMs:
            13,

          sleep:
            async (
              milliseconds
            ) => {
              sleepCalls.push(
                milliseconds
              );
            }
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      requestCount,
      3
    );

    assert.deepEqual(
      sleepCalls,
      [
        13,
        13
      ]
    );

    assert.equal(
      snapshot.status,
      "unavailable"
    );

    assert.equal(
      snapshot.attempts,
      3
    );

    assert.equal(
      snapshot.unavailableReason,
      "record-not-returned-after-retries"
    );

    assert.equal(
      snapshot.error,
      null
    );
  }
);
function createRetryTestDexSnapshots(
  tokens:
    TokenReference[]
): Map<
  string,
  TokenDexSnapshot
> {
  return new Map(
    tokens.map(
      (token) => [
        createTokenIdentity(
          token
        ),

        {
          provider:
            "dexscreener",

          status:
            "no-pairs",

          pools:
            0,

          poolAddresses:
            [],

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

          error:
            null
        }
      ]
    )
  );
}

test(
  "preserves GoPlus retry metadata through report validation and atomic save",
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          "clarity-token-retry-metadata-"
        )
      );

    const outputPath =
      join(
        directory,
        "bankr-tokens.json"
      );

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    try {
      const securitySnapshots =
        await fetchGoPlusSecuritySnapshots(
          [
            token
          ],
          {
            fetch:
              async () =>
                new Response(
                  JSON.stringify(
                    {
                      code:
                        1,

                      message:
                        "OK",

                      result:
                        {}
                    }
                  ),

                  {
                    status:
                      200,

                    headers: {
                      "Content-Type":
                        "application/json"
                    }
                  }
                ),

            goPlusMaxAttempts:
              2,

            requestIntervalMs:
              1,

            sleep:
              async () =>
                undefined
          }
        );

      const report =
        await generateTokenIntelligenceReport(
          createRegistry(),
          {
            fetchDex:
              async (
                tokens
              ) =>
                createRetryTestDexSnapshots(
                  tokens
                ),

            fetchSecurity:
              async () =>
                securitySnapshots,

            now:
              () =>
                "2026-06-30T00:00:00.000Z"
          }
        );

      const generatedSecurity =
        report.tokens[0]
          ?.security;

      assert.ok(
        generatedSecurity
      );

      assert.equal(
        generatedSecurity.attempts,
        2
      );

      assert.equal(
        generatedSecurity
          .unavailableReason,
        "record-not-returned-after-retries"
      );

      await saveTokenIntelligenceReport(
        report,
        outputPath
      );

      const stored =
        JSON.parse(
          await readFile(
            outputPath,
            "utf8"
          )
        );

      const storedSecurity =
        stored.tokens?.[0]
          ?.security;

      assert.equal(
        storedSecurity?.attempts,
        2
      );

      assert.equal(
        storedSecurity
          ?.unavailableReason,
        "record-not-returned-after-retries"
      );
    } finally {
      await rm(
        directory,
        {
          recursive:
            true,

          force:
            true
        }
      );
    }
  }
);

test(
  "retries retryable GoPlus HTTP failures",
  async () => {
    let requestCount =
      0;

    const sleepCalls:
      number[] =
      [];

    const fetcher:
      typeof fetch =
      async () => {
        requestCount +=
          1;

        if (
          requestCount <
          3
        ) {
          return new Response(
            JSON.stringify(
              {
                message:
                  "Temporary upstream failure"
              }
            ),

            {
              status:
                503,

              headers: {
                "Content-Type":
                  "application/json"
              }
            }
          );
        }

        return new Response(
          JSON.stringify(
            {
              code:
                1,

              message:
                "OK",

              result: {
                [
                  TOKEN_ADDRESS
                    .toLowerCase()
                ]: {
                  is_open_source:
                    "1",

                  is_honeypot:
                    "0",

                  holder_count:
                    "500"
                }
              }
            }
          ),

          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      };

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher,

          requestIntervalMs:
            17,

          sleep:
            async (
              milliseconds
            ) => {
              sleepCalls.push(
                milliseconds
              );
            }
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      requestCount,
      3
    );

    assert.deepEqual(
      sleepCalls,
      [
        17,
        17
      ]
    );

    assert.equal(
      snapshot.status,
      "available"
    );

    assert.equal(
      snapshot.attempts,
      3
    );

    assert.equal(
      snapshot.unavailableReason,
      null
    );
  }
);

test(
  "does not retry non-retryable GoPlus authentication failures",
  async () => {
    let requestCount =
      0;

    const sleepCalls:
      number[] =
      [];

    const fetcher:
      typeof fetch =
      async () => {
        requestCount +=
          1;

        return new Response(
          JSON.stringify(
            {
              message:
                "Unauthorized"
            }
          ),

          {
            status:
              401,

            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );
      };

    const token:
      TokenReference = {
        chainId:
          "base",

        address:
          TOKEN_ADDRESS
      };

    const snapshots =
      await fetchGoPlusSecuritySnapshots(
        [
          token
        ],
        {
          fetch:
            fetcher,

          requestIntervalMs:
            19,

          sleep:
            async (
              milliseconds
            ) => {
              sleepCalls.push(
                milliseconds
              );
            }
        }
      );

    const snapshot =
      snapshots.get(
        createTokenIdentity(
          token
        )
      );

    assert.ok(snapshot);

    assert.equal(
      requestCount,
      1
    );

    assert.deepEqual(
      sleepCalls,
      []
    );

    assert.equal(
      snapshot.status,
      "failed"
    );

    assert.equal(
      snapshot.attempts,
      1
    );

    assert.equal(
      snapshot.unavailableReason,
      null
    );

    assert.equal(
      snapshot.error
        ?.retryable,
      false
    );
  }
);
