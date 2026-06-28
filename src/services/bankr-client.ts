import {
  z
} from "zod";

const DEFAULT_BANKR_API_URL =
  "https://api.bankr.bot";

const DEFAULT_BANKR_TIMEOUT_MS =
  30_000;

const BANKR_PAGE_LIMIT =
  100;

const MAX_BANKR_PAGES =
  1_000;

const EVM_TOKEN_ADDRESS_PATTERN =
  /^0x[a-fA-F0-9]{40}$/;

const BankrDateTimeSchema =
  z
    .string()
    .min(1)
    .refine(
      (value) =>
        !Number.isNaN(
          Date.parse(value)
        ),
      {
        message:
          "Expected a valid date-time string."
      }
    );

const BankrRevenueSchema =
  z
    .string()
    .min(1)
    .refine(
      (value) => {
        const parsed =
          Number(value);

        return (
          Number.isFinite(parsed) &&
          parsed >= 0
        );
      },
      {
        message:
          "Expected a non-negative numeric string."
      }
    );

const
BankrAgentProfileSummaryShape = {
  id:
    z.string().min(1),

  slug:
    z.string().min(1),

  projectName:
    z.string().min(1),

  description:
    z.string().optional(),

  profileImageUrl:
    z.string().min(1).optional(),

  projectImages:
    z.array(
      z.unknown()
    ),

  tokenAddress:
    z.string().min(1),

  tokenChainId:
    z.string().min(1),

  tokenSymbol:
    z.string().min(1),

  tokenName:
    z.string().min(1),

  marketCapUsd:
    z.number().nonnegative(),

  weeklyRevenueWeth:
    BankrRevenueSchema.optional(),

  twitterUsername:
    z
      .string()
      .min(1)
      .nullable()
      .optional(),

  website:
    z.string().min(1).optional(),

  productsCount:
    z
      .number()
      .int()
      .nonnegative(),

  createdAt:
    BankrDateTimeSchema
};

function validateTokenAddress(
  profile: {
    tokenAddress: string;
    tokenChainId: string;
  },
  context: z.RefinementCtx
): void {
  if (
    profile
      .tokenChainId
      .toLowerCase() !==
    "base"
  ) {
    return;
  }

  if (
    EVM_TOKEN_ADDRESS_PATTERN.test(
      profile.tokenAddress
    )
  ) {
    return;
  }

  context.addIssue(
    {
      code: "custom",

      path: [
        "tokenAddress"
      ],

      message:
        "Base token address must be a 20-byte hexadecimal address."
    }
  );
}

function normalizeTokenAddress<
  T extends {
    tokenAddress: string;
  }
>(
  profile: T
): T {
  if (
    !EVM_TOKEN_ADDRESS_PATTERN.test(
      profile.tokenAddress
    )
  ) {
    return profile;
  }

  return {
    ...profile,

    tokenAddress:
      profile
        .tokenAddress
        .toLowerCase()
  };
}

const
RawBankrAgentProfileSummarySchema =
  z
    .object(
      BankrAgentProfileSummaryShape
    )
    .passthrough()
    .superRefine(
      validateTokenAddress
    );

export const
BankrAgentProfileSummarySchema =
  RawBankrAgentProfileSummarySchema
    .transform(
      normalizeTokenAddress
    );

export const BankrTeamMemberLinkSchema =
  z
    .object(
      {
        type:
          z.string().min(1),

        url:
          z.string().min(1)
      }
    )
    .passthrough();

export const BankrTeamMemberSchema =
  z
    .object(
      {
        name:
          z.string().min(1),

        role:
          z.string().min(1),

        links:
          z.array(
            BankrTeamMemberLinkSchema
          )
      }
    )
    .passthrough();

export const BankrProductSchema =
  z
    .object(
      {
        name:
          z.string().min(1),

        description:
          z.string(),

        url:
          z
            .string()
            .min(1)
            .optional()
      }
    )
    .passthrough();

export const BankrRevenueSourceSchema =
  z
    .object(
      {
        name:
          z.string().min(1),

        description:
          z.string()
      }
    )
    .passthrough();

export const BankrProjectUpdateSchema =
  z
    .object(
      {
        title:
          z.string().min(1),

        content:
          z.string(),

        createdAt:
          BankrDateTimeSchema
      }
    )
    .passthrough();

const
RawBankrAgentProfileDetailSchema =
  z
    .object(
      {
        ...BankrAgentProfileSummaryShape,

        teamMembers:
          z.array(
            BankrTeamMemberSchema
          ),

        products:
          z.array(
            BankrProductSchema
          ),

        revenueSources:
          z.array(
            BankrRevenueSourceSchema
          ),

        projectUpdates:
          z.array(
            BankrProjectUpdateSchema
          ),

        approved:
          z.boolean()
      }
    )
    .passthrough()
    .superRefine(
      validateTokenAddress
    );

export const
BankrAgentProfileDetailSchema =
  RawBankrAgentProfileDetailSchema
    .transform(
      normalizeTokenAddress
    );

export const
BankrAgentProfilesResponseSchema =
  z
    .object(
      {
        profiles:
          z.array(
            BankrAgentProfileSummarySchema
          ),

        total:
          z
            .number()
            .int()
            .nonnegative(),

        limit:
          z
            .number()
            .int()
            .min(1)
            .max(
              BANKR_PAGE_LIMIT
            ),

        offset:
          z
            .number()
            .int()
            .nonnegative()
      }
    )
    .passthrough();

export type BankrAgentProfileSummary =
  z.infer<
    typeof BankrAgentProfileSummarySchema
  >;

export type BankrAgentProfileDetail =
  z.infer<
    typeof BankrAgentProfileDetailSchema
  >;

export type BankrAgentProfilesResponse =
  z.infer<
    typeof BankrAgentProfilesResponseSchema
  >;

export type BankrProfileSort =
  | "newest"
  | "marketCap";

export type BankrClientErrorCode =
  | "BANKR_INVALID_ARGUMENT"
  | "BANKR_REQUEST_FAILED"
  | "BANKR_HTTP_ERROR"
  | "BANKR_INVALID_RESPONSE";

export type BankrClientErrorOptions = {
  upstreamStatus?: number | null;
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export class BankrClientError
extends Error {
  public readonly code:
    BankrClientErrorCode;

  public readonly upstreamStatus:
    number | null;

  public readonly retryable:
    boolean;

  public readonly details:
    Record<string, unknown> | null;

  public constructor(
    code: BankrClientErrorCode,
    message: string,
    options:
      BankrClientErrorOptions = {}
  ) {
    super(message);

    this.name =
      "BankrClientError";

    this.code =
      code;

    this.upstreamStatus =
      options.upstreamStatus ??
      null;

    this.retryable =
      options.retryable ??
      false;

    this.details =
      options.details ??
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

export type BankrClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export type ListApprovedBankrProfilesOptions =
  BankrClientOptions & {
    sort?: BankrProfileSort;
  };

function getTimeoutMs(
  value: number | undefined
): number {
  const timeoutMs =
    value ??
    DEFAULT_BANKR_TIMEOUT_MS;

  if (
    !Number.isSafeInteger(
      timeoutMs
    ) ||
    timeoutMs <= 0
  ) {
    throw new BankrClientError(
      "BANKR_INVALID_ARGUMENT",
      "Bankr timeout must be a positive integer."
    );
  }

  return timeoutMs;
}

function getBaseUrl(
  value: string | undefined
): string {
  const baseUrl =
    value ??
    DEFAULT_BANKR_API_URL;

  try {
    const parsed =
      new URL(baseUrl);

    parsed.pathname =
      parsed
        .pathname
        .replace(
          /\/+$/,
          ""
        );

    return parsed.toString();
  } catch (cause) {
    throw new BankrClientError(
      "BANKR_INVALID_ARGUMENT",
      "Bankr base URL is invalid.",
      {
        cause
      }
    );
  }
}

function createBankrUrl(
  pathname: string,
  options: BankrClientOptions
): URL {
  const baseUrl =
    getBaseUrl(
      options.baseUrl
    );

  return new URL(
    pathname,
    baseUrl.endsWith("/")
      ? baseUrl
      : `${baseUrl}/`
  );
}

function getResponsePreview(
  body: string
): string | null {
  const trimmed =
    body.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(
    0,
    500
  );
}

function isRetryableHttpStatus(
  status: number
): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function requestBankrJson<T>(
  pathname: string,
  schema: z.ZodType<T>,
  options: BankrClientOptions
): Promise<T> {
  const url =
    createBankrUrl(
      pathname,
      options
    );

  const timeoutMs =
    getTimeoutMs(
      options.timeoutMs
    );

  const fetcher =
    options.fetch ??
    globalThis.fetch;

  let response: Response;

  try {
    response =
      await fetcher(
        url,
        {
          method: "GET",

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
    throw new BankrClientError(
      "BANKR_REQUEST_FAILED",
      "Bankr request failed before a response was received.",
      {
        retryable: true,

        details: {
          url:
            url.toString(),

          timeoutMs
        },

        cause
      }
    );
  }

  let responseBody: string;

  try {
    responseBody =
      await response.text();
  } catch (cause) {
    throw new BankrClientError(
      "BANKR_INVALID_RESPONSE",
      "Bankr response body could not be read.",
      {
        upstreamStatus:
          response.status,

        retryable:
          isRetryableHttpStatus(
            response.status
          ),

        details: {
          url:
            url.toString()
        },

        cause
      }
    );
  }

  if (!response.ok) {
    throw new BankrClientError(
      "BANKR_HTTP_ERROR",
      `Bankr returned HTTP ${response.status}.`,
      {
        upstreamStatus:
          response.status,

        retryable:
          isRetryableHttpStatus(
            response.status
          ),

        details: {
          url:
            url.toString(),

          responseBody:
            getResponsePreview(
              responseBody
            )
        }
      }
    );
  }

  let parsedBody: unknown;

  try {
    parsedBody =
      JSON.parse(
        responseBody
      ) as unknown;
  } catch (cause) {
    throw new BankrClientError(
      "BANKR_INVALID_RESPONSE",
      "Bankr returned invalid JSON.",
      {
        upstreamStatus:
          response.status,

        details: {
          url:
            url.toString(),

          responseBody:
            getResponsePreview(
              responseBody
            )
        },

        cause
      }
    );
  }

  const parsed =
    schema.safeParse(
      parsedBody
    );

  if (!parsed.success) {
    throw new BankrClientError(
      "BANKR_INVALID_RESPONSE",
      "Bankr response did not match the expected schema.",
      {
        upstreamStatus:
          response.status,

        details: {
          url:
            url.toString(),

          issues:
            parsed.error.issues.map(
              (issue) => ({
                path:
                  issue.path.join("."),

                code:
                  issue.code,

                message:
                  issue.message
              })
            )
        }
      }
    );
  }

  return parsed.data;
}

function validateSort(
  sort: BankrProfileSort
): void {
  if (
    sort === "newest" ||
    sort === "marketCap"
  ) {
    return;
  }

  throw new BankrClientError(
    "BANKR_INVALID_ARGUMENT",
    `Unsupported Bankr profile sort: "${String(
      sort
    )}".`
  );
}

export async function
listApprovedBankrProfiles(
  options:
    ListApprovedBankrProfilesOptions = {}
): Promise<
  BankrAgentProfileSummary[]
> {
  const sort =
    options.sort ??
    "newest";

  validateSort(sort);

  const profiles:
  BankrAgentProfileSummary[] =
    [];

  let offset =
    0;

  for (
    let pageNumber = 0;
    pageNumber < MAX_BANKR_PAGES;
    pageNumber += 1
  ) {
    const searchParams =
      new URLSearchParams(
        {
          sort,

          limit:
            String(
              BANKR_PAGE_LIMIT
            ),

          offset:
            String(offset)
        }
      );

    const page =
      await requestBankrJson(
        `/agent-profiles?${searchParams.toString()}`,
        BankrAgentProfilesResponseSchema,
        options
      );

    profiles.push(
      ...page.profiles
    );

    if (
      profiles.length >=
      page.total
    ) {
      return profiles;
    }

    if (
      page.profiles.length ===
      0
    ) {
      throw new BankrClientError(
        "BANKR_INVALID_RESPONSE",
        "Bankr pagination stopped before all profiles were returned.",
        {
          details: {
            expectedTotal:
              page.total,

            received:
              profiles.length,

            offset
          }
        }
      );
    }

    offset +=
      page.profiles.length;
  }

  throw new BankrClientError(
    "BANKR_INVALID_RESPONSE",
    "Bankr pagination exceeded the safety limit.",
    {
      details: {
        pages:
          MAX_BANKR_PAGES,

        received:
          profiles.length
      }
    }
  );
}

export async function
getBankrAgentProfile(
  identifier: string,
  options:
    BankrClientOptions = {}
): Promise<
  BankrAgentProfileDetail
> {
  const normalizedIdentifier =
    identifier.trim();

  if (!normalizedIdentifier) {
    throw new BankrClientError(
      "BANKR_INVALID_ARGUMENT",
      "Bankr profile identifier must not be empty."
    );
  }

  return requestBankrJson(
    `/agent-profiles/${encodeURIComponent(
      normalizedIdentifier
    )}`,
    BankrAgentProfileDetailSchema,
    options
  );
}
