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
  ClarityError
} from "../errors/clarity-error.js";

import type {
  BankrCandidateImportReport
} from "./bankr-candidate-import.js";

const MINIMUM_UPLOAD_TOKEN_LENGTH =
  32;

const DEFAULT_MAX_UPLOAD_BYTES =
  5 * 1024 * 1024;

const repositorySchema =
  z.object(
    {
      owner:
        z.string().min(1),

      repository:
        z.string().min(1),

      url:
        z.string().url(),

      sources:
        z.array(
          z.string().min(1)
        ),

      relationship:
        z.enum(
          [
            "primary",
            "component",
            "integration",
            "dependency",
            "example",
            "unknown"
          ]
        ),

      confidence:
        z.enum(
          [
            "high",
            "medium",
            "low"
          ]
        ),

      reasons:
        z.array(
          z.string()
        )
    }
  )
    .passthrough();

const candidateSchema =
  z.object(
    {
      source:
        z.literal(
          "bankr"
        ),

      bankrProfileId:
        z.string().min(1),

      bankrSlug:
        z.string().min(1),

      name:
        z.string().min(1),

      description:
        z.string().nullable(),

      website:
        z.string().nullable(),

      githubRepositories:
        z.array(
          repositorySchema
        ),

      warnings:
        z.array(
          z.string()
        )
    }
  )
    .passthrough();

const websiteDiscoverySchema =
  z.object(
    {
      skippedExistingGitHub:
        z.number().int().nonnegative(),

      skippedNoWebsite:
        z.number().int().nonnegative(),

      skippedSocialWebsite:
        z.number().int().nonnegative(),

      attempted:
        z.number().int().nonnegative(),

      found:
        z.number().int().nonnegative(),

      ownerOnly:
        z.number().int().nonnegative(),

      notFound:
        z.number().int().nonnegative(),

      failed:
        z.number().int().nonnegative(),

      repositoriesFound:
        z.number().int().nonnegative(),

      ownerPagesFound:
        z.number().int().nonnegative(),

      results:
        z.array(
          z.object(
            {
              bankrProfileId:
                z.string().min(1),

              bankrSlug:
                z.string().min(1),

              website:
                z.string().min(1),

              status:
                z.enum(
                  [
                    "found",
                    "owner-only",
                    "not-found",
                    "failed"
                  ]
                ),

              repositories:
                z.array(
                  z.string()
                ),

              ownerUrls:
                z.array(
                  z.string()
                )
            }
          )
            .passthrough()
        )
    }
  )
    .passthrough();

const ownerRepositoryMatchSchema =
  z.object(
    {
      owner:
        z.string().min(1),

      repository:
        z.string().min(1),

      url:
        z.string().url(),

      score:
        z.number()
          .min(0)
          .max(100),

      probable:
        z.boolean(),

      reasons:
        z.array(
          z.string()
        )
    }
  )
    .passthrough();

const ownerDiscoverySchema =
  z.object(
    {
      enabled:
        z.boolean(),

      skippedNoToken:
        z.number().int().nonnegative(),

      attempted:
        z.number().int().nonnegative(),

      probable:
        z.number().int().nonnegative(),

      review:
        z.number().int().nonnegative(),

      notFound:
        z.number().int().nonnegative(),

      failed:
        z.number().int().nonnegative(),

      candidatesFound:
        z.number().int().nonnegative(),

      results:
        z.array(
          z.object(
            {
              bankrProfileId:
                z.string().min(1),

              bankrSlug:
                z.string().min(1),

              ownerUrl:
                z.string().min(1),

              owner:
                z.string().min(1),

              status:
                z.enum(
                  [
                    "probable",
                    "review",
                    "not-found",
                    "failed"
                  ]
                ),

              candidates:
                z.array(
                  ownerRepositoryMatchSchema
                )
            }
          )
            .passthrough()
        )
    }
  )
    .passthrough();

const candidateReportSchema =
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

      profilesListed:
        z.number().int().nonnegative(),

      detailsLoaded:
        z.number().int().nonnegative(),

      failures:
        z.array(
          z.object(
            {
              bankrProfileId:
                z.string(),

              bankrSlug:
                z.string(),

              code:
                z.string(),

              message:
                z.string(),

              retryable:
                z.boolean()
            }
          )
            .passthrough()
        ),

      candidates:
        z.array(
          candidateSchema
        ),

      warnings:
        z.array(
          z.unknown()
        ),

      conflicts:
        z.object(
          {
            profileIds:
              z.array(
                z.unknown()
              ),

            slugs:
              z.array(
                z.unknown()
              ),

            tokenIdentities:
              z.array(
                z.unknown()
              )
          }
        )
          .passthrough(),

      websiteDiscovery:
        websiteDiscoverySchema,

      ownerDiscovery:
        ownerDiscoverySchema,

      githubEvidence:
        z.object(
          {
            candidatesWithGitHub:
              z.number().int().nonnegative(),

            candidatesWithoutGitHub:
              z.number().int().nonnegative(),

            classifiedRepositories:
              z.number().int().nonnegative(),

            uniqueRepositories:
              z.number().int().nonnegative(),

            relationships:
              z.record(
                z.string(),
                z.number().int().nonnegative()
              ),

            confidences:
              z.record(
                z.string(),
                z.number().int().nonnegative()
              )
          }
        )
          .passthrough()
    }
  )
    .passthrough();

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

function getMaximumUploadBytes():
number {
  const parsed =
    Number(
      process.env
        .CLARITY_CANDIDATE_UPLOAD_MAX_BYTES
    );

  if (
    Number.isInteger(parsed) &&
    parsed > 0
  ) {
    return parsed;
  }

  return DEFAULT_MAX_UPLOAD_BYTES;
}

function validateCandidateReport(
  value: unknown,
  statusCode: number
): BankrCandidateImportReport {
  const result =
    candidateReportSchema.safeParse(
      value
    );

  if (!result.success) {
    throw new ClarityError(
      "CANDIDATE_REPORT_INVALID",

      "Bankr candidate report failed runtime validation.",

      statusCode,

      {
        details: {
          issues:
            result.error.issues
              .slice(
                0,
                12
              )
              .map(
                (issue) => ({
                  path:
                    issue.path.join(
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

  return (
    result.data as
      BankrCandidateImportReport
  );
}

export function authenticateCandidateUpload(
  authorizationHeader:
    string |
    undefined,

  configuredToken:
    string |
    undefined =
      process.env
        .CLARITY_CANDIDATE_UPLOAD_TOKEN
): void {
  const normalizedConfiguredToken =
    configuredToken?.trim();

  if (
    !normalizedConfiguredToken ||
    normalizedConfiguredToken.length <
      MINIMUM_UPLOAD_TOKEN_LENGTH
  ) {
    throw new ClarityError(
      "CANDIDATE_UPLOAD_NOT_CONFIGURED",

      "Administrative candidate report upload is not configured.",

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
      "CANDIDATE_UPLOAD_AUTHENTICATION_FAILED",

      "Valid candidate upload Bearer authentication is required.",

      401
    );
  }
}

export function getPublishedCandidateReportPath():
string {
  return (
    process.env
      .CLARITY_BANKR_PUBLISHED_REPORT_PATH ??
    "data/candidates/published-bankr.json"
  );
}

export async function readCandidateReportRequest(
  request:
    IncomingMessage
): Promise<
  BankrCandidateImportReport
> {
  const maximumBytes =
    getMaximumUploadBytes();

  const contentLength =
    Number(
      request.headers[
        "content-length"
      ]
    );

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      maximumBytes
  ) {
    throw new ClarityError(
      "CANDIDATE_REPORT_TOO_LARGE",

      `Candidate report exceeds the ${maximumBytes} byte upload limit.`,

      413,

      {
        details: {
          contentLength,
          maximumBytes
        }
      }
    );
  }

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
      maximumBytes
    ) {
      request.resume();

      throw new ClarityError(
        "CANDIDATE_REPORT_TOO_LARGE",

        `Candidate report exceeds the ${maximumBytes} byte upload limit.`,

        413,

        {
          details: {
            bytesRead,
            maximumBytes
          }
        }
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
      "CANDIDATE_REPORT_INVALID",
      "Candidate report request body is empty.",
      400
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
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
      "CANDIDATE_REPORT_INVALID",
      "Candidate report request body is not valid JSON.",
      400,
      {
        cause:
          error
      }
    );
  }

  return validateCandidateReport(
    parsed,
    400
  );
}

export async function savePublishedCandidateReport(
  report:
    BankrCandidateImportReport,

  outputPath =
    getPublishedCandidateReportPath()
): Promise<string> {
  const validated =
    validateCandidateReport(
      report,
      400
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

export async function loadPublishedCandidateReport(
  inputPath =
    getPublishedCandidateReportPath()
): Promise<
  BankrCandidateImportReport
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
      throw new ClarityError(
        "CANDIDATE_REPORT_NOT_FOUND",
        "No published Bankr candidate report is available yet.",
        404
      );
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
      "CANDIDATE_REPORT_INVALID",
      "Stored Bankr candidate report is not valid JSON.",
      500,
      {
        cause:
          error
      }
    );
  }

  return validateCandidateReport(
    parsed,
    500
  );
}
