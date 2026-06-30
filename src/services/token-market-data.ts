import {
  z
} from "zod";

const DEFAULT_DEX_SCREENER_URL =
  "https://api.dexscreener.com";

const DEFAULT_GO_PLUS_URL =
  "https://api.gopluslabs.io";

const DEFAULT_TIMEOUT_MS =
  30_000;

const DEX_BATCH_SIZE =
  30;

const DEFAULT_GO_PLUS_REQUEST_INTERVAL_MS =
  2_100;

const EVM_ADDRESS_PATTERN =
  /^0x[a-fA-F0-9]{40}$/u;

export type TokenReference = {
  chainId: string;
  address: string;
};

export type TokenDataStatus =
  | "available"
  | "unavailable"
  | "no-pairs"
  | "failed";

export type TokenProviderFailure = {
  provider:
    | "dexscreener"
    | "goplus"
    | "holders";

  code: string;
  message: string;
  retryable: boolean;
};

export type TokenDexSnapshot = {
  provider: "dexscreener";
  status: TokenDataStatus;

  pools: number;

  poolAddresses?:
    string[];

  primaryPair: {
    chainId: string;
    dexId: string | null;
    pairAddress: string | null;
    url: string | null;
  } | null;

  totalLiquidityUsd: number | null;
  volume24hUsd: number | null;

  buys24h: number | null;
  sells24h: number | null;

  priceUsd: number | null;
  priceChange24hPct: number | null;

  marketCapUsd: number | null;
  fdvUsd: number | null;

  pairCreatedAt: string | null;

  error:
    TokenProviderFailure |
    null;
};

export type TokenTopHolder = {
  address: string;
  balance: string | null;
  percentPct: number | null;

  isContract: boolean | null;
  isLocked: boolean | null;

  tag: string | null;

  excludedFromCirculatingConcentration:
    boolean;

  exclusionReason:
    string |
    null;
};

export type TokenSecuritySnapshot = {
  provider: "goplus";
  status: TokenDataStatus;

  flags: {
    isOpenSource: boolean | null;
    isProxy: boolean | null;
    isHoneypot: boolean | null;
    cannotBuy: boolean | null;
    cannotSellAll: boolean | null;
    isMintable: boolean | null;
    hiddenOwner: boolean | null;
    ownerChangeBalance: boolean | null;
    selfDestruct: boolean | null;
    externalCall: boolean | null;
    transferPausable: boolean | null;
    isBlacklisted: boolean | null;
    slippageModifiable: boolean | null;
    antiWhaleModifiable: boolean | null;
  };

  buyTaxPct: number | null;
  sellTaxPct: number | null;

  holderCountReported: number | null;
  creatorAddress: string | null;
  ownerAddress: string | null;

  totalSupply?:
    string |
    null;

  creatorSupplyPct?:
    number |
    null;

  topHolders?:
    TokenTopHolder[];

  risks: string[];

  error:
    TokenProviderFailure |
    null;
};

export type TokenHolderSnapshot = {
  provider: string;
  status:
    | "available"
    | "unavailable"
    | "failed";

  holderCount: number | null;

  sampledHolders?:
    number;

  rawTop10SupplyPct?:
    number |
    null;

  excludedKnownSupplyPct?:
    number |
    null;

  dexPoolSupplyPct?:
    number |
    null;

  protocolLiquiditySupplyPct?:
    number |
    null;

  creatorSupplyPct?:
    number |
    null;

  top10SupplyPct: number | null;
  top20SupplyPct: number | null;
  relatedWalletSupplyPct: number | null;
  deployerClusterSupplyPct: number | null;

  evidence: string[];

  error:
    TokenProviderFailure |
    null;
};

export type FetchTokenHolderSnapshots = (
  tokens:
    TokenReference[]
) => Promise<
  Map<
    string,
    TokenHolderSnapshot
  >
>;

export type TokenMarketClientOptions = {
  fetch?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
  sleep?: (
    milliseconds: number
  ) => Promise<void>;
  requestIntervalMs?: number;
};

export class TokenDataProviderError
extends Error {
  public readonly provider:
    TokenProviderFailure["provider"];

  public readonly code:
    string;

  public readonly retryable:
    boolean;

  public readonly upstreamStatus:
    number |
    null;

  public constructor(
    provider:
      TokenProviderFailure["provider"],

    code: string,
    message: string,

    options: {
      retryable?: boolean;
      upstreamStatus?: number | null;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name =
      "TokenDataProviderError";

    this.provider =
      provider;

    this.code =
      code;

    this.retryable =
      options.retryable ??
      false;

    this.upstreamStatus =
      options.upstreamStatus ??
      null;

    if (
      options.cause !==
      undefined
    ) {
      (
        this as Error & {
          cause?: unknown;
        }
      ).cause =
        options.cause;
    }
  }
}

const DexTokenSchema =
  z.object(
    {
      address:
        z.string().min(1)
    }
  )
    .passthrough();

const DexPairSchema =
  z.object(
    {
      chainId:
        z.string().min(1),

      dexId:
        z.string().min(1).optional(),

      url:
        z.string().min(1).optional(),

      pairAddress:
        z.string().min(1).optional(),

      baseToken:
        DexTokenSchema,

      quoteToken:
        DexTokenSchema,

      priceUsd:
        z.string()
          .nullable()
          .optional(),

      txns:
        z.object(
          {
            h24:
              z.object(
                {
                  buys:
                    z.number()
                      .nonnegative()
                      .optional(),

                  sells:
                    z.number()
                      .nonnegative()
                      .optional()
                }
              )
                .passthrough()
                .optional()
          }
        )
          .passthrough()
          .optional(),

      volume:
        z.object(
          {
            h24:
              z.number()
                .nonnegative()
                .optional()
          }
        )
          .passthrough()
          .optional(),

      priceChange:
        z.object(
          {
            h24:
              z.number()
                .optional()
          }
        )
          .passthrough()
          .nullable()
          .optional(),

      liquidity:
        z.object(
          {
            usd:
              z.number()
                .nonnegative()
                .nullable()
                .optional()
          }
        )
          .passthrough()
          .nullable()
          .optional(),

      fdv:
        z.number()
          .nonnegative()
          .nullable()
          .optional(),

      marketCap:
        z.number()
          .nonnegative()
          .nullable()
          .optional(),

      pairCreatedAt:
        z.number()
          .nonnegative()
          .nullable()
          .optional()
    }
  )
    .passthrough();

const DexPairsSchema =
  z.array(
    DexPairSchema
  );

type DexPair =
  z.infer<
    typeof DexPairSchema
  >;

const GoPlusScalarSchema =
  z.union(
    [
      z.string(),
      z.number(),
      z.boolean(),
      z.null()
    ]
  );

const GoPlusHolderSchema =
  z.object(
    {
      address:
        z.string().min(1),

      balance:
        GoPlusScalarSchema.optional(),

      percent:
        GoPlusScalarSchema.optional(),

      is_contract:
        GoPlusScalarSchema.optional(),

      is_locked:
        GoPlusScalarSchema.optional(),

      tag:
        GoPlusScalarSchema.optional()
    }
  )
    .passthrough();

const GoPlusTokenSchema =
  z.object(
    {
      is_open_source:
        GoPlusScalarSchema.optional(),

      is_proxy:
        GoPlusScalarSchema.optional(),

      is_honeypot:
        GoPlusScalarSchema.optional(),

      cannot_buy:
        GoPlusScalarSchema.optional(),

      cannot_sell_all:
        GoPlusScalarSchema.optional(),

      is_mintable:
        GoPlusScalarSchema.optional(),

      hidden_owner:
        GoPlusScalarSchema.optional(),

      owner_change_balance:
        GoPlusScalarSchema.optional(),

      selfdestruct:
        GoPlusScalarSchema.optional(),

      external_call:
        GoPlusScalarSchema.optional(),

      transfer_pausable:
        GoPlusScalarSchema.optional(),

      is_blacklisted:
        GoPlusScalarSchema.optional(),

      slippage_modifiable:
        GoPlusScalarSchema.optional(),

      anti_whale_modifiable:
        GoPlusScalarSchema.optional(),

      buy_tax:
        GoPlusScalarSchema.optional(),

      sell_tax:
        GoPlusScalarSchema.optional(),

      holder_count:
        GoPlusScalarSchema.optional(),

      creator_address:
        GoPlusScalarSchema.optional(),

      owner_address:
        GoPlusScalarSchema.optional(),

      total_supply:
        GoPlusScalarSchema.optional(),

      creator_percent:
        GoPlusScalarSchema.optional(),

      holders:
        z.array(
          GoPlusHolderSchema
        )
          .optional()
    }
  )
    .passthrough();

const GoPlusResponseSchema =
  z.object(
    {
      code:
        z.union(
          [
            z.string(),
            z.number()
          ]
        )
          .optional(),

      message:
        z.string()
          .optional(),

      result:
        z.record(
          z.string(),
          GoPlusTokenSchema
        )
          .default(
            {}
          )
    }
  )
    .passthrough();

type GoPlusHolder =
  z.infer<
    typeof GoPlusHolderSchema
  >;

type GoPlusToken =
  z.infer<
    typeof GoPlusTokenSchema
  >;

function normalizeChainId(
  chainId: string
): string {
  return chainId
    .trim()
    .toLowerCase();
}

function normalizeAddress(
  address: string
): string {
  return address
    .trim()
    .toLowerCase();
}

export function createTokenIdentity(
  token:
    TokenReference
): string {
  return [
    normalizeChainId(
      token.chainId
    ),

    normalizeAddress(
      token.address
    )
  ].join(":");
}

function validateTokenReference(
  token:
    TokenReference
): void {
  if (
    !token.chainId.trim()
  ) {
    throw new TokenDataProviderError(
      "dexscreener",
      "TOKEN_CHAIN_INVALID",
      "Token chain ID cannot be empty."
    );
  }

  if (
    !token.address.trim()
  ) {
    throw new TokenDataProviderError(
      "dexscreener",
      "TOKEN_ADDRESS_INVALID",
      "Token address cannot be empty."
    );
  }

  if (
    normalizeChainId(
      token.chainId
    ) ===
      "base" &&
    !EVM_ADDRESS_PATTERN.test(
      token.address
    )
  ) {
    throw new TokenDataProviderError(
      "dexscreener",
      "TOKEN_ADDRESS_INVALID",
      "Base token address must be a 20-byte hexadecimal address."
    );
  }
}

function getTimeoutMs(
  value:
    number |
    undefined
): number {
  const timeoutMs =
    value ??
    DEFAULT_TIMEOUT_MS;

  if (
    !Number.isSafeInteger(
      timeoutMs
    ) ||
    timeoutMs <= 0
  ) {
    throw new Error(
      "Token provider timeout must be a positive integer."
    );
  }

  return timeoutMs;
}

function getBaseUrl(
  explicitValue:
    string |
    undefined,

  defaultValue:
    string
): string {
  const value =
    explicitValue ??
    defaultValue;

  const parsed =
    new URL(
      value
    );

  return parsed
    .toString()
    .replace(
      /\/+$/u,
      ""
    );
}

function isRetryableStatus(
  status: number
): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function toFailure(
  error: unknown,

  fallbackProvider:
    TokenProviderFailure["provider"]
): TokenProviderFailure {
  if (
    error instanceof
      TokenDataProviderError
  ) {
    return {
      provider:
        error.provider,

      code:
        error.code,

      message:
        error.message,

      retryable:
        error.retryable
    };
  }

  return {
    provider:
      fallbackProvider,

    code:
      "TOKEN_PROVIDER_FAILED",

    message:
      error instanceof Error
        ? error.message
        : "Unknown token provider error.",

    retryable:
      true
  };
}

async function fetchJson(
  provider:
    TokenProviderFailure["provider"],

  url: URL,

  options:
    TokenMarketClientOptions
): Promise<unknown> {
  const fetcher =
    options.fetch ??
    globalThis.fetch;

  const timeoutMs =
    getTimeoutMs(
      options.timeoutMs
    );

  let response:
    Response;

  try {
    response =
      await fetcher(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json"
          },

          signal:
            AbortSignal.timeout(
              timeoutMs
            )
        }
      );
  } catch (cause) {
    throw new TokenDataProviderError(
      provider,
      "TOKEN_PROVIDER_REQUEST_FAILED",
      `${provider} request failed before a response was received.`,
      {
        retryable:
          true,

        cause
      }
    );
  }

  let body:
    string;

  try {
    body =
      await response.text();
  } catch (cause) {
    throw new TokenDataProviderError(
      provider,
      "TOKEN_PROVIDER_RESPONSE_FAILED",
      `${provider} response body could not be read.`,
      {
        retryable:
          true,

        upstreamStatus:
          response.status,

        cause
      }
    );
  }

  if (
    !response.ok
  ) {
    throw new TokenDataProviderError(
      provider,
      "TOKEN_PROVIDER_HTTP_ERROR",
      `${provider} returned HTTP ${response.status}.`,
      {
        retryable:
          isRetryableStatus(
            response.status
          ),

        upstreamStatus:
          response.status
      }
    );
  }

  try {
    return JSON.parse(
      body
    );
  } catch (cause) {
    throw new TokenDataProviderError(
      provider,
      "TOKEN_PROVIDER_INVALID_JSON",
      `${provider} returned invalid JSON.`,
      {
        retryable:
          false,

        upstreamStatus:
          response.status,

        cause
      }
    );
  }
}

function chunkValues<T>(
  values: T[],
  size: number
): T[][] {
  const chunks:
    T[][] =
    [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

async function sleepBetweenRequests(
  options:
    TokenMarketClientOptions
): Promise<void> {
  const interval =
    Math.max(
      0,
      options.requestIntervalMs ??
        0
    );

  if (
    interval === 0
  ) {
    return;
  }

  const sleep =
    options.sleep ??
    (
      async (
        milliseconds: number
      ): Promise<void> => {
        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              milliseconds
            );
          }
        );
      }
    );

  await sleep(
    interval
  );
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function toBooleanFlag(
  value: unknown
): boolean | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return null;
}

function toTaxPercentage(
  value: unknown
): number | null {
  const parsed =
    toFiniteNumber(
      value
    );

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed <= 1
    ? parsed * 100
    : parsed;
}

function toOptionalAddress(
  value: unknown
): string | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  return normalized
    ? normalized
    : null;
}

function toOptionalString(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(
      value
    ).trim();

  return normalized
    ? normalized
    : null;
}

function getHolderExclusionReason(
  address: string,
  isLocked: boolean | null,
  tag: string | null
): string | null {
  if (
    isLocked === true
  ) {
    return (
      "Holder is explicitly marked as locked."
    );
  }

  if (
    address ===
      "0x0000000000000000000000000000000000000000" ||
    address ===
      "0x000000000000000000000000000000000000dead"
  ) {
    return (
      "Known burn or null address."
    );
  }

  const normalizedTag =
    (
      tag ??
      ""
    ).toLowerCase();

  const excludedMarkers = [
    "burn",
    "dead",
    "black hole",
    "locked",
    "locker",
    "vesting",
    "liquidity pool",
    "lp token"
  ];

  const matchedMarker =
    excludedMarkers.find(
      (candidate) =>
        normalizedTag.includes(
          candidate
        )
    );

  if (!matchedMarker) {
    return null;
  }

  return (
    `Holder tag indicates ${matchedMarker}.`
  );
}

function normalizeTopHolder(
  holder:
    GoPlusHolder
): TokenTopHolder | null {
  const address =
    toOptionalAddress(
      holder.address
    );

  if (!address) {
    return null;
  }

  const rawPercent =
    toTaxPercentage(
      holder.percent
    );

  const percentPct =
    rawPercent === null
      ? null
      : Math.min(
          Math.max(
            rawPercent,
            0
          ),
          100
        );

  const isLocked =
    toBooleanFlag(
      holder.is_locked
    );

  const tag =
    toOptionalString(
      holder.tag
    );

  const exclusionReason =
    getHolderExclusionReason(
      address,
      isLocked,
      tag
    );

  return {
    address,

    balance:
      toOptionalString(
        holder.balance
      ),

    percentPct,

    isContract:
      toBooleanFlag(
        holder.is_contract
      ),

    isLocked,
    tag,

    excludedFromCirculatingConcentration:
      exclusionReason !==
      null,

    exclusionReason
  };
}

function createEmptyDexSnapshot(
  status:
    TokenDexSnapshot["status"],

  error:
    TokenProviderFailure |
    null = null
): TokenDexSnapshot {
  return {
    provider:
      "dexscreener",

    status,

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

    error
  };
}

function createEmptySecuritySnapshot(
  status:
    TokenSecuritySnapshot["status"],

  error:
    TokenProviderFailure |
    null = null
): TokenSecuritySnapshot {
  return {
    provider:
      "goplus",

    status,

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

    totalSupply:
      null,

    creatorSupplyPct:
      null,

    topHolders:
      [],

    risks:
      [],

    error
  };
}

function getPairKey(
  pair:
    DexPair
): string {
  return (
    pair.pairAddress ??
    [
      pair.chainId,
      pair.dexId ??
        "unknown",

      pair.baseToken.address,
      pair.quoteToken.address
    ].join(":")
  )
    .toLowerCase();
}

function getPairTokenAddresses(
  pair:
    DexPair
): string[] {
  return [
    normalizeAddress(
      pair.baseToken.address
    ),

    normalizeAddress(
      pair.quoteToken.address
    )
  ];
}

function aggregateDexPairs(
  pairs:
    DexPair[]
): TokenDexSnapshot {
  if (
    pairs.length === 0
  ) {
    return createEmptyDexSnapshot(
      "no-pairs"
    );
  }

  const uniquePairs =
    new Map<
      string,
      DexPair
    >();

  for (
    const pair
    of pairs
  ) {
    uniquePairs.set(
      getPairKey(
        pair
      ),
      pair
    );
  }

  const values =
    [
      ...uniquePairs.values()
    ];

  values.sort(
    (
      left,
      right
    ) =>
      (
        right.liquidity
          ?.usd ??
        0
      ) -
      (
        left.liquidity
          ?.usd ??
        0
      )
  );

  const primary =
    values[0];

  if (!primary) {
    return createEmptyDexSnapshot(
      "no-pairs"
    );
  }

  const totalLiquidityUsd =
    values.reduce(
      (
        total,
        pair
      ) =>
        total +
        (
          pair.liquidity
            ?.usd ??
          0
        ),

      0
    );

  const volume24hUsd =
    values.reduce(
      (
        total,
        pair
      ) =>
        total +
        (
          pair.volume
            ?.h24 ??
          0
        ),

      0
    );

  const buys24h =
    values.reduce(
      (
        total,
        pair
      ) =>
        total +
        (
          pair.txns
            ?.h24
            ?.buys ??
          0
        ),

      0
    );

  const sells24h =
    values.reduce(
      (
        total,
        pair
      ) =>
        total +
        (
          pair.txns
            ?.h24
            ?.sells ??
          0
        ),

      0
    );

  const createdValues =
    values
      .map(
        (pair) =>
          pair.pairCreatedAt ??
          null
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const earliestCreated =
    createdValues.length > 0
      ? Math.min(
          ...createdValues
        )
      : null;

  return {
    provider:
      "dexscreener",

    status:
      "available",

    pools:
      values.length,

    poolAddresses:
      values
        .map(
          (pair) =>
            pair.pairAddress
              ?.trim()
              .toLowerCase() ??
            null
        )
        .filter(
          (
            address
          ): address is string =>
            address !==
            null
        ),

    primaryPair: {
      chainId:
        primary.chainId,

      dexId:
        primary.dexId ??
        null,

      pairAddress:
        primary.pairAddress ??
        null,

      url:
        primary.url ??
        null
    },

    totalLiquidityUsd,

    volume24hUsd,

    buys24h,
    sells24h,

    priceUsd:
      toFiniteNumber(
        primary.priceUsd
      ),

    priceChange24hPct:
      primary.priceChange
        ?.h24 ??
      null,

    marketCapUsd:
      primary.marketCap ??
      null,

    fdvUsd:
      primary.fdv ??
      null,

    pairCreatedAt:
      earliestCreated ===
        null
        ? null
        : new Date(
            earliestCreated
          ).toISOString(),

    error:
      null
  };
}

export async function fetchDexScreenerSnapshots(
  tokens:
    TokenReference[],

  options:
    TokenMarketClientOptions = {}
): Promise<
  Map<
    string,
    TokenDexSnapshot
  >
> {
  const snapshots =
    new Map<
      string,
      TokenDexSnapshot
    >();

  const uniqueTokens =
    new Map<
      string,
      TokenReference
    >();

  for (
    const token
    of tokens
  ) {
    validateTokenReference(
      token
    );

    const identity =
      createTokenIdentity(
        token
      );

    uniqueTokens.set(
      identity,
      {
        chainId:
          normalizeChainId(
            token.chainId
          ),

        address:
          normalizeAddress(
            token.address
          )
      }
    );

    snapshots.set(
      identity,
      createEmptyDexSnapshot(
        "no-pairs"
      )
    );
  }

  const groups =
    new Map<
      string,
      TokenReference[]
    >();

  for (
    const token
    of uniqueTokens.values()
  ) {
    const group =
      groups.get(
        token.chainId
      ) ??
      [];

    group.push(
      token
    );

    groups.set(
      token.chainId,
      group
    );
  }

  const baseUrl =
    getBaseUrl(
      options.baseUrl,
      DEFAULT_DEX_SCREENER_URL
    );

  for (
    const [
      chainId,
      chainTokens
    ]
    of groups
  ) {
    const batches =
      chunkValues(
        chainTokens,
        DEX_BATCH_SIZE
      );

    for (
      let batchIndex = 0;
      batchIndex < batches.length;
      batchIndex += 1
    ) {
      const batch =
        batches[
          batchIndex
        ] ??
        [];

      const requestedAddresses =
        new Set(
          batch.map(
            (token) =>
              normalizeAddress(
                token.address
              )
          )
        );

      const pairsByAddress =
        new Map<
          string,
          DexPair[]
        >();

      for (
        const address
        of requestedAddresses
      ) {
        pairsByAddress.set(
          address,
          []
        );
      }

      try {
        const addresses =
          batch
            .map(
              (token) =>
                token.address
            )
            .join(",");

        const url =
          new URL(
            `${baseUrl}/tokens/v1/${encodeURIComponent(chainId)}/${addresses}`
          );

        const rawResponse =
          await fetchJson(
            "dexscreener",
            url,
            options
          );

        const pairs =
          DexPairsSchema.parse(
            rawResponse
          );

        for (
          const pair
          of pairs
        ) {
          for (
            const address
            of getPairTokenAddresses(
              pair
            )
          ) {
            if (
              !requestedAddresses.has(
                address
              )
            ) {
              continue;
            }

            const current =
              pairsByAddress.get(
                address
              ) ??
              [];

            current.push(
              pair
            );

            pairsByAddress.set(
              address,
              current
            );
          }
        }

        for (
          const token
          of batch
        ) {
          const identity =
            createTokenIdentity(
              token
            );

          snapshots.set(
            identity,

            aggregateDexPairs(
              pairsByAddress.get(
                normalizeAddress(
                  token.address
                )
              ) ??
              []
            )
          );
        }
      } catch (error) {
        const failure =
          toFailure(
            error,
            "dexscreener"
          );

        for (
          const token
          of batch
        ) {
          snapshots.set(
            createTokenIdentity(
              token
            ),

            createEmptyDexSnapshot(
              "failed",
              failure
            )
          );
        }
      }

      if (
        batchIndex <
        batches.length - 1
      ) {
        await sleepBetweenRequests(
          options
        );
      }
    }
  }

  return snapshots;
}

function getGoPlusChainId(
  chainId: string
): string | null {
  const normalized =
    normalizeChainId(
      chainId
    );

  const aliases:
    Record<
      string,
      string
    > = {
      base:
        "8453",

      ethereum:
        "1",

      eth:
        "1",

      optimism:
        "10",

      polygon:
        "137",

      bsc:
        "56",

      arbitrum:
        "42161",

      avalanche:
        "43114"
    };

  if (
    /^\d+$/u.test(
      normalized
    )
  ) {
    return normalized;
  }

  return aliases[
    normalized
  ] ??
  null;
}

function buildSecurityRisks(
  flags:
    TokenSecuritySnapshot["flags"],

  buyTaxPct:
    number |
    null,

  sellTaxPct:
    number |
    null
): string[] {
  const risks:
    string[] =
    [];

  const flagRisks:
    Array<
      [
        boolean | null,
        string
      ]
    > = [
      [
        flags.isHoneypot,
        "GoPlus reports honeypot behaviour."
      ],

      [
        flags.cannotBuy,
        "Token purchases may be restricted."
      ],

      [
        flags.cannotSellAll,
        "Selling the complete balance may be restricted."
      ],

      [
        flags.isMintable,
        "Additional token supply may be minted."
      ],

      [
        flags.hiddenOwner,
        "A hidden owner relationship was detected."
      ],

      [
        flags.ownerChangeBalance,
        "The owner may be able to change holder balances."
      ],

      [
        flags.selfDestruct,
        "The contract exposes self-destruct behaviour."
      ],

      [
        flags.externalCall,
        "The contract may execute external calls."
      ],

      [
        flags.transferPausable,
        "Token transfers may be paused."
      ],

      [
        flags.isBlacklisted,
        "The contract contains blacklist functionality."
      ],

      [
        flags.slippageModifiable,
        "Trading taxes or slippage may be modified."
      ],

      [
        flags.antiWhaleModifiable,
        "Anti-whale limits may be modified."
      ]
    ];

  for (
    const [
      active,
      message
    ]
    of flagRisks
  ) {
    if (active) {
      risks.push(
        message
      );
    }
  }

  if (
    buyTaxPct !== null &&
    buyTaxPct > 10
  ) {
    risks.push(
      `High buy tax detected: ${buyTaxPct.toFixed(2)}%.`
    );
  }

  if (
    sellTaxPct !== null &&
    sellTaxPct > 10
  ) {
    risks.push(
      `High sell tax detected: ${sellTaxPct.toFixed(2)}%.`
    );
  }

  return risks;
}

function normalizeSecuritySnapshot(
  token:
    GoPlusToken
): TokenSecuritySnapshot {
  const flags:
    TokenSecuritySnapshot["flags"] = {
    isOpenSource:
      toBooleanFlag(
        token.is_open_source
      ),

    isProxy:
      toBooleanFlag(
        token.is_proxy
      ),

    isHoneypot:
      toBooleanFlag(
        token.is_honeypot
      ),

    cannotBuy:
      toBooleanFlag(
        token.cannot_buy
      ),

    cannotSellAll:
      toBooleanFlag(
        token.cannot_sell_all
      ),

    isMintable:
      toBooleanFlag(
        token.is_mintable
      ),

    hiddenOwner:
      toBooleanFlag(
        token.hidden_owner
      ),

    ownerChangeBalance:
      toBooleanFlag(
        token.owner_change_balance
      ),

    selfDestruct:
      toBooleanFlag(
        token.selfdestruct
      ),

    externalCall:
      toBooleanFlag(
        token.external_call
      ),

    transferPausable:
      toBooleanFlag(
        token.transfer_pausable
      ),

    isBlacklisted:
      toBooleanFlag(
        token.is_blacklisted
      ),

    slippageModifiable:
      toBooleanFlag(
        token.slippage_modifiable
      ),

    antiWhaleModifiable:
      toBooleanFlag(
        token.anti_whale_modifiable
      )
  };

  const buyTaxPct =
    toTaxPercentage(
      token.buy_tax
    );

  const sellTaxPct =
    toTaxPercentage(
      token.sell_tax
    );

  const topHolders =
    (
      token.holders ??
      []
    )
      .map(
        normalizeTopHolder
      )
      .filter(
        (
          holder
        ): holder is TokenTopHolder =>
          holder !== null
      );

  return {
    provider:
      "goplus",

    status:
      "available",

    flags,

    buyTaxPct,
    sellTaxPct,

    holderCountReported:
      toFiniteNumber(
        token.holder_count
      ),

    creatorAddress:
      toOptionalAddress(
        token.creator_address
      ),

    ownerAddress:
      toOptionalAddress(
        token.owner_address
      ),

    totalSupply:
      toOptionalString(
        token.total_supply
      ),

    creatorSupplyPct:
      toTaxPercentage(
        token.creator_percent
      ),

    topHolders,

    risks:
      buildSecurityRisks(
        flags,
        buyTaxPct,
        sellTaxPct
      ),

    error:
      null
  };
}

export async function fetchGoPlusSecuritySnapshots(
  tokens:
    TokenReference[],

  options:
    TokenMarketClientOptions = {}
): Promise<
  Map<
    string,
    TokenSecuritySnapshot
  >
> {
  const snapshots =
    new Map<
      string,
      TokenSecuritySnapshot
    >();

  const requests =
    new Map<
      string,
      {
        goPlusChainId: string;
        address: string;
        identities: string[];
      }
    >();

  for (
    const token
    of tokens
  ) {
    validateTokenReference(
      token
    );

    const identity =
      createTokenIdentity(
        token
      );

    const goPlusChainId =
      getGoPlusChainId(
        token.chainId
      );

    if (!goPlusChainId) {
      snapshots.set(
        identity,
        createEmptySecuritySnapshot(
          "unavailable"
        )
      );

      continue;
    }

    const address =
      normalizeAddress(
        token.address
      );

    const requestKey =
      `${goPlusChainId}:${address}`;

    const existing =
      requests.get(
        requestKey
      );

    if (existing) {
      if (
        !existing.identities
          .includes(
            identity
          )
      ) {
        existing.identities.push(
          identity
        );
      }

      continue;
    }

    requests.set(
      requestKey,
      {
        goPlusChainId,
        address,
        identities: [
          identity
        ]
      }
    );
  }

  const baseUrl =
    getBaseUrl(
      options.baseUrl,
      DEFAULT_GO_PLUS_URL
    );

  const requestEntries =
    [
      ...requests.values()
    ];

  for (
    let index = 0;
    index < requestEntries.length;
    index += 1
  ) {
    const request =
      requestEntries[
        index
      ];

    if (!request) {
      continue;
    }

    try {
      const url =
        new URL(
          `${baseUrl}/api/v1/token_security/${request.goPlusChainId}`
        );

      url.searchParams.set(
        "contract_addresses",
        request.address
      );

      const rawResponse =
        await fetchJson(
          "goplus",
          url,
          options
        );

      const response =
        GoPlusResponseSchema.parse(
          rawResponse
        );

      const record =
        Object
          .entries(
            response.result
          )
          .find(
            (
              [
                address
              ]
            ) =>
              normalizeAddress(
                address
              ) ===
              request.address
          )
          ?.[1];

      const snapshot =
        record
          ? normalizeSecuritySnapshot(
              record
            )
          : createEmptySecuritySnapshot(
              "unavailable"
            );

      for (
        const identity
        of request.identities
      ) {
        snapshots.set(
          identity,
          snapshot
        );
      }
    } catch (error) {
      const failure =
        toFailure(
          error,
          "goplus"
        );

      for (
        const identity
        of request.identities
      ) {
        snapshots.set(
          identity,

          createEmptySecuritySnapshot(
            "failed",
            failure
          )
        );
      }
    }

    if (
      index <
      requestEntries.length - 1
    ) {
      await sleepBetweenRequests(
        {
          ...options,

          requestIntervalMs:
            options.requestIntervalMs ??
            DEFAULT_GO_PLUS_REQUEST_INTERVAL_MS
        }
      );
    }
  }

  return snapshots;
}

export async function createUnavailableHolderSnapshots(
  tokens:
    TokenReference[]
): Promise<
  Map<
    string,
    TokenHolderSnapshot
  >
> {
  return new Map(
    tokens.map(
      (token) => [
        createTokenIdentity(
          token
        ),

        {
          provider:
            "unconfigured",

          status:
            "unavailable" as const,

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
            "Holder distribution provider is not configured."
          ],

          error:
            null
        }
      ]
    )
  );
}
