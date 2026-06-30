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

const PUBLIC_ASSETS:
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
    }
  };

export function isPublicSitePath(
  pathname: string
): boolean {
  return Object.hasOwn(
    PUBLIC_ASSETS,
    pathname
  );
}

export async function servePublicSite(
  pathname: string,
  response: ServerResponse
): Promise<boolean> {
  const asset =
    PUBLIC_ASSETS[pathname];

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
