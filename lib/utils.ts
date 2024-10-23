import { AuthError } from "@supabase/supabase-js";

// import { storeError } from "lib/messages.ts";
import { createLogger, Logger } from "./logger.ts";

/**
 * Prepare what almost every endpoint will want to use. `headers` object with `location` header set,
 * a `logger` intitalized with `loggerName`, and a new `url` constructed from `req.url`.
 * NOTE: This will erase the input url's `pathname` to "/" by default, if no other `path` is passed.
 */
export function prepareResponse({
  req,
  loggerName,
  path = "/",
  isSlug = false,
}: {
  req: Request;
  loggerName: string;
  // The pathname to set the return `url` to.
  path?: string;
  // Turns `pathname` into a slug, e.g. will append to path instead of overwriting.
  isSlug?: boolean;
}): { headers: Headers; logger: Logger; url: URL } {
  const logger = createLogger(loggerName);
  const headers = new Headers();
  const url = new URL(req.url);

  url.pathname = isSlug ? `${url.pathname}/${path.replace(/^\//, "")}` : path;
  headers.set("location", url.toString());

  return { headers, logger, url };
}

/**
 * Use to abort an operation on api endpoints. Logs the `error`, stores it as serer message and returns
 * a 303 Response. When `silent = true`, will not store a server message and return a 500 instead.
 */
export function bail(headers: Headers, logger: Logger, error: Error | AuthError, silent = false, statusText = "") {
  logger.error(error);
  let status = 500;

  if (!silent) {
    status = 303;
  }

  return new Response(null, { headers, status, statusText });
}

/** Construct an absolute URL from `url` and `path`, replacing `url`'s full `pathname`, then set it as
 * location header.
 * In accordance with RFC2616: https://datatracker.ietf.org/doc/html/rfc2616#section-14.30
 */
export function setLocation(headers: Headers, url: URL, path: string) {
  const stripped = path.startsWith("/") ? path.slice(1) : path;
  headers.set("location", `${url.origin}/${stripped}`);
}