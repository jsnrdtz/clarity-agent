import {
  lookup
} from "node:dns/promises";

import {
  isIP
} from "node:net";

import {
  extractBankrGitHubRepositoriesFromEvidence
} from "./bankr-candidate.js";

import type {
  BankrGitHubRepository
} from "./bankr-candidate.js";

const DEFAULT_TIMEOUT_MS =
  8_000;

const DEFAULT_MAX_BYTES =
  1_000_000;

const DEFAULT_MAX_REDIRECTS =
  3;

const RESERVED_GITHUB_OWNERS =
  new Set(
    [
      "about",
      "collections",
      "customer-stories",
      "enterprise",
      "events",
      "explore",
      "features",
      "login",
      "marketplace",
      "notifications",
      "organizations",
      "pricing",
      "readme",
      "search",
      "security",
      "settings",
      "signup",
      "site",
      "sponsors",
      "topics",
      "actions",
      "apps",
      "codespaces",
      "discussions",
      "issues",
      "new",
      "orgs",
      "packages",
      "projects",
      "pulls",
      "releases",
      "stars",
      "users",
      "wiki"
    ]
  );

const SOCIAL_WEBSITE_HOSTS =
  new Set(
    [
      "x.com",
      "twitter.com",
      "t.me",
      "telegram.me",
      "discord.gg",
      "discord.com",
      "instagram.com",
      "facebook.com",
      "linkedin.com",
      "youtube.com"
    ]
  );

export function isBankrProjectWebsiteUrl(
  value: string
): boolean {
  let parsed: URL;

  try {
    parsed =
      new URL(
        value
      );
  } catch {
    return false;
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    return false;
  }

  const hostname =
    parsed
      .hostname
      .toLowerCase()
      .replace(
        /^www\./u,
        ""
      );

  return (
    !SOCIAL_WEBSITE_HOSTS.has(
      hostname
    )
  );
}

export type BankrWebsiteDiscoveryErrorCode =
  | "WEBSITE_INVALID_URL"
  | "WEBSITE_BLOCKED_ADDRESS"
  | "WEBSITE_DNS_FAILED"
  | "WEBSITE_TIMEOUT"
  | "WEBSITE_NETWORK_ERROR"
  | "WEBSITE_HTTP_ERROR"
  | "WEBSITE_REDIRECT_LIMIT"
  | "WEBSITE_INVALID_CONTENT_TYPE"
  | "WEBSITE_TOO_LARGE";

export class BankrWebsiteDiscoveryError
extends Error {
  public readonly code:
    BankrWebsiteDiscoveryErrorCode;

  public readonly retryable:
    boolean;

  public readonly details:
    Record<string, unknown> | null;

  public constructor(
    code:
      BankrWebsiteDiscoveryErrorCode,

    message: string,

    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name =
      "BankrWebsiteDiscoveryError";

    this.code =
      code;

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

export type BankrWebsiteGitHubDiscovery = {
  requestedUrl: string;
  finalUrl: string;

  redirects: number;
  bytesRead: number;

  repositories:
    BankrGitHubRepository[];

  ownerUrls:
    string[];
};

export type BankrWebsiteGitHubDependencies = {
  fetchWebsite?: typeof fetch;

  lookupHost?: (
    hostname: string
  ) => Promise<
    Array<{
      address: string;
    }>
  >;

  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

function readPositiveInteger(
  explicitValue:
    number |
    undefined,

  environmentValue:
    string |
    undefined,

  fallback: number
): number {
  if (
    Number.isInteger(
      explicitValue
    ) &&
    (
      explicitValue ??
      0
    ) > 0
  ) {
    return explicitValue as number;
  }

  const parsed =
    Number(
      environmentValue
    );

  if (
    Number.isInteger(parsed) &&
    parsed > 0
  ) {
    return parsed;
  }

  return fallback;
}

function parseIpv4(
  address: string
): number[] | null {
  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return null;
  }

  return parts;
}

function isBlockedIpv4(
  address: string
): boolean {
  const parts =
    parseIpv4(
      address
    );

  if (!parts) {
    return true;
  }

  const [
    first,
    second
  ] = parts;

  if (
    first === undefined ||
    second === undefined
  ) {
    return true;
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (
      first === 100 &&
      second >= 64 &&
      second <= 127
    ) ||
    (
      first === 169 &&
      second === 254
    ) ||
    (
      first === 172 &&
      second >= 16 &&
      second <= 31
    ) ||
    (
      first === 192 &&
      second === 0
    ) ||
    (
      first === 192 &&
      second === 168
    ) ||
    (
      first === 192 &&
      second === 0 &&
      parts[2] === 2
    ) ||
    (
      first === 198 &&
      (
        second === 18 ||
        second === 19 ||
        second === 51
      )
    ) ||
    (
      first === 203 &&
      second === 0 &&
      parts[2] === 113
    ) ||
    first >= 224
  );
}

function isBlockedIpAddress(
  address: string
): boolean {
  const normalized =
    address
      .trim()
      .toLowerCase();

  const version =
    isIP(
      normalized
    );

  if (version === 4) {
    return isBlockedIpv4(
      normalized
    );
  }

  if (version !== 6) {
    return true;
  }

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith(
      "::ffff:"
    ) ||
    normalized.startsWith(
      "fc"
    ) ||
    normalized.startsWith(
      "fd"
    ) ||
    /^fe[89ab]/u.test(
      normalized
    ) ||
    normalized.startsWith(
      "ff"
    ) ||
    normalized.startsWith(
      "2001:db8:"
    )
  ) {
    return true;
  }

  return false;
}

function isBlockedHostname(
  hostname: string
): boolean {
  const normalized =
    hostname
      .toLowerCase()
      .replace(
        /\.$/u,
        ""
      );

  return (
    normalized ===
      "localhost" ||
    normalized.endsWith(
      ".localhost"
    ) ||
    normalized.endsWith(
      ".local"
    ) ||
    normalized.endsWith(
      ".internal"
    ) ||
    normalized.endsWith(
      ".lan"
    ) ||
    normalized.endsWith(
      ".home.arpa"
    )
  );
}

async function validateWebsiteUrl(
  value: string,

  lookupHost:
    NonNullable<
      BankrWebsiteGitHubDependencies[
        "lookupHost"
      ]
    >
): Promise<URL> {
  let parsed: URL;

  try {
    parsed =
      new URL(
        value
      );
  } catch {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_INVALID_URL",
      `Invalid website URL: "${value}".`
    );
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_INVALID_URL",
      "Website URL must use HTTP or HTTPS."
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_INVALID_URL",
      "Website URLs containing credentials are not allowed."
    );
  }

  const allowedPort =
    (
      !parsed.port ||
      (
        parsed.protocol ===
          "http:" &&
        parsed.port ===
          "80"
      ) ||
      (
        parsed.protocol ===
          "https:" &&
        parsed.port ===
          "443"
      )
    );

  if (!allowedPort) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_INVALID_URL",
      "Website URL uses a blocked network port."
    );
  }

  const hostname =
    parsed
      .hostname
      .toLowerCase();

  if (
    !hostname ||
    isBlockedHostname(
      hostname
    )
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_BLOCKED_ADDRESS",
      "Website hostname is not publicly routable."
    );
  }

  const ipVersion =
    isIP(
      hostname
    );

  if (ipVersion > 0) {
    if (
      isBlockedIpAddress(
        hostname
      )
    ) {
      throw new BankrWebsiteDiscoveryError(
        "WEBSITE_BLOCKED_ADDRESS",
        "Website IP address is not publicly routable."
      );
    }

    return parsed;
  }

  let addresses:
    Array<{
      address: string;
    }>;

  try {
    addresses =
      await lookupHost(
        hostname
      );
  } catch (error) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_DNS_FAILED",
      `Could not resolve website hostname "${hostname}".`,
      {
        retryable:
          true,

        cause:
          error
      }
    );
  }

  if (
    addresses.length ===
    0
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_DNS_FAILED",
      `Website hostname "${hostname}" returned no addresses.`,
      {
        retryable:
          true
      }
    );
  }

  if (
    addresses.some(
      (entry) =>
        isBlockedIpAddress(
          entry.address
        )
    )
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_BLOCKED_ADDRESS",
      `Website hostname "${hostname}" resolves to a blocked address.`
    );
  }

  return parsed;
}

function normalizeHtml(
  html: string
): string {
  return html
    .replaceAll(
      "&amp;",
      "&"
    )
    .replaceAll(
      "&#38;",
      "&"
    )
    .replaceAll(
      "&#x2F;",
      "/"
    )
    .replaceAll(
      "&#47;",
      "/"
    )
    .replace(
      /(?<!:)\/\/(?:www\.)?github\.com\//gi,
      "https://github.com/"
    );
}

function extractGitHubOwnerUrls(
  text: string
): string[] {
  const matches =
    text.match(
      /\b(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9_.-]+)?(?:[^\s"'<>]*)?/gi
    ) ??
    [];

  const owners =
    new Map<
      string,
      string
    >();

  for (
    const match
    of matches
  ) {
    const value =
      /^https?:\/\//i.test(
        match
      )
        ? match
        : `https://${match}`;

    let parsed: URL;

    try {
      parsed =
        new URL(
          value
        );
    } catch {
      continue;
    }

    const hostname =
      parsed
        .hostname
        .toLowerCase();

    if (
      hostname !==
        "github.com" &&
      hostname !==
        "www.github.com"
    ) {
      continue;
    }

    const pathParts =
      parsed
        .pathname
        .split("/")
        .filter(Boolean);

    if (
      pathParts.length !== 1
    ) {
      continue;
    }

    const owner =
      pathParts[0];

    if (
      !owner ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(
        owner
      ) ||
      RESERVED_GITHUB_OWNERS.has(
        owner.toLowerCase()
      )
    ) {
      continue;
    }

    owners.set(
      owner.toLowerCase(),
      `https://github.com/${owner}`
    );
  }

  return [
    ...owners.values()
  ].sort(
    (
      left,
      right
    ) =>
      left.localeCompare(
        right,
        "en",
        {
          sensitivity:
            "base"
        }
      )
  );
}

async function readHtmlBody(
  response: Response,
  maxBytes: number
): Promise<{
  html: string;
  bytesRead: number;
}> {
  const contentLength =
    Number(
      response.headers.get(
        "content-length"
      )
    );

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      maxBytes
  ) {
    throw new BankrWebsiteDiscoveryError(
      "WEBSITE_TOO_LARGE",
      `Website response exceeds ${maxBytes} bytes.`,
      {
        details: {
          contentLength,
          maxBytes
        }
      }
    );
  }

  if (!response.body) {
    return {
      html:
        "",

      bytesRead:
        0
    };
  }

  const reader =
    response.body.getReader();

  const chunks:
    Uint8Array[] =
    [];

  let bytesRead =
    0;

  while (true) {
    const {
      done,
      value
    } =
      await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    bytesRead +=
      value.byteLength;

    if (
      bytesRead >
      maxBytes
    ) {
      await reader
        .cancel()
        .catch(
          () => undefined
        );

      throw new BankrWebsiteDiscoveryError(
        "WEBSITE_TOO_LARGE",
        `Website response exceeds ${maxBytes} bytes.`,
        {
          details: {
            bytesRead,
            maxBytes
          }
        }
      );
    }

    chunks.push(
      value
    );
  }

  return {
    html:
      Buffer
        .concat(
          chunks.map(
            (chunk) =>
              Buffer.from(
                chunk
              )
          )
        )
        .toString(
          "utf8"
        ),

    bytesRead
  };
}

export async function discoverBankrWebsiteGitHub(
  websiteUrl: string,

  dependencies:
    BankrWebsiteGitHubDependencies = {}
): Promise<
  BankrWebsiteGitHubDiscovery
> {
  const fetchWebsite =
    dependencies.fetchWebsite ??
    fetch;

  const lookupHost =
    dependencies.lookupHost ??
    (
      async (
        hostname: string
      ) =>
        lookup(
          hostname,
          {
            all:
              true,

            verbatim:
              true
          }
        )
    );

  const timeoutMs =
    readPositiveInteger(
      dependencies.timeoutMs,

      process.env
        .CLARITY_BANKR_WEBSITE_TIMEOUT_MS,

      DEFAULT_TIMEOUT_MS
    );

  const maxBytes =
    readPositiveInteger(
      dependencies.maxBytes,

      process.env
        .CLARITY_BANKR_WEBSITE_MAX_BYTES,

      DEFAULT_MAX_BYTES
    );

  const maxRedirects =
    readPositiveInteger(
      dependencies.maxRedirects,

      process.env
        .CLARITY_BANKR_WEBSITE_MAX_REDIRECTS,

      DEFAULT_MAX_REDIRECTS
    );

  const requested =
    await validateWebsiteUrl(
      websiteUrl.trim(),
      lookupHost
    );

  const requestedHostname =
    requested
      .hostname
      .toLowerCase();

  if (
    requestedHostname ===
      "github.com" ||
    requestedHostname ===
      "www.github.com"
  ) {
    const text =
      normalizeHtml(
        requested.toString()
      );

    return {
      requestedUrl:
        requested.toString(),

      finalUrl:
        requested.toString(),

      redirects:
        0,

      bytesRead:
        0,

      repositories:
        extractBankrGitHubRepositoriesFromEvidence(
          [
            {
              source:
                "website-page",

              text
            }
          ]
        ),

      ownerUrls:
        extractGitHubOwnerUrls(
          text
        )
    };
  }

  let currentUrl =
    requested;

  let redirects =
    0;

  while (true) {
    currentUrl =
      await validateWebsiteUrl(
        currentUrl.toString(),
        lookupHost
      );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },

        timeoutMs
      );

    timeout.unref();

    let response: Response;

    try {
      response =
        await fetchWebsite(
          currentUrl,
          {
            method:
              "GET",

            redirect:
              "manual",

            signal:
              controller.signal,

            headers: {
              Accept:
                "text/html,application/xhtml+xml",

              "User-Agent":
                "Clarity-Agent-Discovery/1.0"
            }
          }
        );
    } catch (error) {
      const errorName =
        (
          typeof error ===
            "object" &&
          error !== null &&
          "name" in error
        )
          ? String(
              error.name
            )
          : "";

      if (
        errorName ===
          "AbortError" ||
        errorName ===
          "TimeoutError"
      ) {
        throw new BankrWebsiteDiscoveryError(
          "WEBSITE_TIMEOUT",
          `Website request timed out after ${timeoutMs} ms.`,
          {
            retryable:
              true,

            cause:
              error
          }
        );
      }

      throw new BankrWebsiteDiscoveryError(
        "WEBSITE_NETWORK_ERROR",
        "Website request failed before a response was received.",
        {
          retryable:
            true,

          cause:
            error
        }
      );
    } finally {
      clearTimeout(
        timeout
      );
    }

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get(
          "location"
        );

      if (!location) {
        throw new BankrWebsiteDiscoveryError(
          "WEBSITE_HTTP_ERROR",
          `Website returned redirect status ${response.status} without a location.`
        );
      }

      if (
        redirects >=
        maxRedirects
      ) {
        throw new BankrWebsiteDiscoveryError(
          "WEBSITE_REDIRECT_LIMIT",
          `Website exceeded the redirect limit of ${maxRedirects}.`
        );
      }

      currentUrl =
        new URL(
          location,
          currentUrl
        );

      redirects +=
        1;

      continue;
    }

    if (!response.ok) {
      throw new BankrWebsiteDiscoveryError(
        "WEBSITE_HTTP_ERROR",
        `Website returned HTTP ${response.status}.`,
        {
          retryable:
            response.status >= 500,

          details: {
            status:
              response.status
          }
        }
      );
    }

    const contentType =
      (
        response.headers.get(
          "content-type"
        ) ??
        ""
      ).toLowerCase();

    if (
      !contentType.includes(
        "text/html"
      ) &&
      !contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      throw new BankrWebsiteDiscoveryError(
        "WEBSITE_INVALID_CONTENT_TYPE",
        `Website returned unsupported content type "${contentType || "unknown"}".`
      );
    }

    const {
      html,
      bytesRead
    } =
      await readHtmlBody(
        response,
        maxBytes
      );

    const normalizedHtml =
      normalizeHtml(
        html
      );

    return {
      requestedUrl:
        requested.toString(),

      finalUrl:
        currentUrl.toString(),

      redirects,
      bytesRead,

      repositories:
        extractBankrGitHubRepositoriesFromEvidence(
          [
            {
              source:
                "website-page",

              text:
                normalizedHtml
            }
          ]
        ),

      ownerUrls:
        extractGitHubOwnerUrls(
          normalizedHtml
        )
    };
  }
}
