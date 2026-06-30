import {
  readFile
} from "node:fs/promises";

import {
  join
} from "node:path";

import type {
  ServerResponse
} from "node:http";

type PublicAsset = {
  fileName: string;
  contentType: string;
  cacheControl: string;
};

const STATIC_PUBLIC_ASSETS:
  Record<
    string,
    PublicAsset
  > = {
    "/": {
      fileName:
        "index.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    },

    "/styles.css": {
      fileName:
        "styles.css",

      contentType:
        "text/css; charset=utf-8",

      cacheControl:
        "public, max-age=300"
    },

    "/app.js": {
      fileName:
        "app.js",

      contentType:
        "text/javascript; charset=utf-8",

      cacheControl:
        "public, max-age=300"
    },

    "/agent.js": {
      fileName:
        "agent.js",

      contentType:
        "text/javascript; charset=utf-8",

      cacheControl:
        "public, max-age=300"
    },

    "/candidates": {
      fileName:
        "candidates.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    },

    "/candidates/": {
      fileName:
        "candidates.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    },

    "/candidates.js": {
      fileName:
        "candidates.js",

      contentType:
        "text/javascript; charset=utf-8",

      cacheControl:
        "public, max-age=300"
    },

    "/candidates/admin": {
      fileName:
        "candidates-admin.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    },

    "/candidates/admin/": {
      fileName:
        "candidates-admin.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    },

    "/candidates-admin.js": {
      fileName:
        "candidates-admin.js",

      contentType:
        "text/javascript; charset=utf-8",

      cacheControl:
        "public, max-age=300"
    }
  };

const AGENT_PAGE_PATTERN =
  /^\/agents\/[a-z0-9][a-z0-9._-]*\/?$/i;

function resolvePublicAsset(
  pathname: string
): PublicAsset | null {
  const staticAsset =
    STATIC_PUBLIC_ASSETS[
      pathname
    ];

  if (staticAsset) {
    return staticAsset;
  }

  if (
    AGENT_PAGE_PATTERN.test(
      pathname
    )
  ) {
    return {
      fileName:
        "agent.html",

      contentType:
        "text/html; charset=utf-8",

      cacheControl:
        "no-cache"
    };
  }

  return null;
}

export function isPublicSitePath(
  pathname: string
): boolean {
  return (
    resolvePublicAsset(
      pathname
    ) !== null
  );
}

export async function servePublicSite(
  pathname: string,
  response: ServerResponse
): Promise<boolean> {
  const asset =
    resolvePublicAsset(
      pathname
    );

  if (!asset) {
    return false;
  }

  const content =
    await readFile(
      join(
        process.cwd(),
        "public",
        asset.fileName
      )
    );

  response.statusCode =
    200;

  response.setHeader(
    "Content-Type",
    asset.contentType
  );

  response.setHeader(
    "Content-Length",
    content.byteLength
  );

  response.setHeader(
    "Cache-Control",
    asset.cacheControl
  );

  response.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );

  response.end(
    content
  );

  return true;
}
