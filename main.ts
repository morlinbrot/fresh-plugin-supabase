import type { FreshContext, Plugin } from "$fresh/src/server/types.ts";
import { User } from "@supabase/supabase-js";

import { makeConfirmHandler } from "./handlers/confirm.ts";
import { makeLoginHandler } from "./handlers/login.ts";
import { logoutHandler } from "./handlers/logout.ts";
import { recoverHandler } from "./handlers/recover.ts";
import { makeSignupHandler } from "./handlers/signup.ts";
import type { Logger } from "./lib/logger.ts";
import { createSupabaseClient } from "./lib/supabaseClient.ts";
import { prepareResponse, setLocation } from "./lib/utils.ts";

export type SupabasePluginState = {
  supabaseUser: User | null;
  supabaseLogger: Logger;
};

export type SupabasePluginOptions = {
  /**
   * A regex for which routes to allow. Make sure this includes the frontend routes you need for authentication.
   * Defaults to `"^/(signup|login|confirm)$"`.
   */
  allowPattern?: RegExp;
  /**
   * A regex for which routes to protect. Defaults to all routes except root and the api routes provided by this plugin.
   * Note: If you specify this, the plugin will deny _only_ routes matching this pattern (overriding the plugin's defaults).
   * The built-in routes of the plugin are: "^/api/(signup|login|confirm).*".
   */
  denyPattern?: RegExp;
  /**
   * Whether to protect the root "/".
   */
  protectRoot?: boolean;
  /**
   * Specify where to redirect for different scenarios.
   */
  redirects?: Redirects;
};

export type Redirects = {
  /**
   * Where to redirect unauthorized requests when trying to access a protected route. Defaults to "/login".
   */
  forbidden?: string;
  /**
   * Where to redirect after a sign up. Defaults to "/login".
   */
  signupSuccess?: string;
  /**
   * Where to redirect to reset the password. Defaults to "/update-password".
   */
  passwordReset?: string;
};

export type SupabasePluginHandlerOptions = {
  redirects: Required<Redirects>;
};

export const LOGGER_PREFIX = "fresh-plugin-supabase";

export default function supabase(options: SupabasePluginOptions = {}): Plugin {
  return {
    name: "supabase",
    middlewares: [
      {
        path: "/",
        middleware: { handler: makeInterceptHandler(options) },
      },
    ],
  };
}

function makeInterceptHandler({
  allowPattern,
  denyPattern,
  protectRoot = false,
  redirects: optionsRedirects,
}: SupabasePluginOptions) {
  return async function interceptHandler(req: Request, ctx: FreshContext) {
    // We don't care about internal and static routes.
    // NOTE: `/api` routes have the destination "notFound" for some reason.
    if (ctx.destination !== "route" && ctx.destination !== "notFound") {
      return ctx.next();
    }

    const reqUrl = new URL(req.url);

    const {
      headers,
      logger,
      url: resUrl,
    } = prepareResponse({
      req,
      loggerName: `${LOGGER_PREFIX}::interceptHandler`,
    });

    logger.debug(`Called for route=${reqUrl.pathname}`);

    const redirectDefaults: Redirects = {
      forbidden: "login",
      signupSuccess: "login",
      passwordReset: "update-password",
    };

    const redirects = Object.entries(redirectDefaults).reduce(
      (acc, [key_, defaultVal]) => {
        const key = key_ as keyof Redirects;
        const setVal = (optionsRedirects || {})[key];

        const val = setVal ? setVal : defaultVal;
        const slashed = val.startsWith("/") ? val : `/${val}`;

        acc[key] = slashed;

        return acc;
      },
      {} as Redirects,
    ) as Required<Redirects>;

    let isProtectedRoute = false;

    const rootPattern = new RegExp("^/$");
    const alwaysAllowPattern = new RegExp("^/api/(signup|login|confirm).*");
    const alwaysDenyPattern = new RegExp("^/api/(logout|recover).*");

    // Edge case: root
    const matchesRoot = !!reqUrl.pathname.match(rootPattern)?.length;
    const isProtectedByRoot = matchesRoot && protectRoot;
    // console.log("PROT ROOT: ", isProtectedByRoot);

    isProtectedRoute = isProtectedByRoot;

    // Edge case: found in 'redirects'
    const mapped = Object.values(redirects).join("|");
    const redirectPattern = new RegExp(`^(${mapped})`);
    const matchesRedirect = !!reqUrl.pathname.match(redirectPattern);
    // console.log("PROT REDIRECT: ", matchesRedirect);

    // Plugin defined.
    const matchesAlwaysAllow = !!reqUrl.pathname.match(alwaysAllowPattern)?.length || matchesRedirect;
    const matchesAlwaysDeny = !!reqUrl.pathname.match(alwaysDenyPattern)?.length;

    const isProtectedByDefaults = matchesAlwaysDeny && !matchesAlwaysAllow;
    // console.log("PROT DEFAULT: ", isProtectedByDefaults, !matchesAlwaysAllow);

    if (isProtectedByDefaults) {
      isProtectedRoute = isProtectedByDefaults;
    }

    // User defined.
    // This different to `alwaysAllowPattern` in that these are frontend routes.
    const defaultAllowPattern = new RegExp("^/(signup|login|confirm)$");

    const matchesAllow = allowPattern
      ? !!reqUrl.pathname.match(allowPattern)?.length
      : !!reqUrl.pathname.match(defaultAllowPattern)?.length;
    const matchesDeny = denyPattern ? !!reqUrl.pathname.match(denyPattern)?.length : false;

    const isProtectedByUser = matchesDeny || !matchesAllow;
    // console.log("PROT USER: ", isProtectedByUser, matchesDeny, !matchesAllow);

    if (isProtectedByUser && !matchesRoot && !matchesAlwaysAllow) {
      isProtectedRoute = isProtectedByUser;
    }

    // console.log("PROT ALL: ", isProtectedRoute, isProtectedByRoot, isProtectedByDefaults, isProtectedByUser);

    if (isProtectedRoute) {
      logger.debug(`Protected route detected: ${reqUrl.pathname}`);
    }

    const supabase = createSupabaseClient(req, headers);

    const { error, data } = await supabase.auth.getUser();
    const { user } = data;

    logger.debug(
      `Authenticated user.email=${user?.email} for route=${reqUrl.pathname}`,
    );

    // 400 AuthSessionMissingError, e.g. no session data in cookies, we just want to redirect below.
    if (error && error.status !== 400) {
      // return bail(headers, logger, error, true);
      return new Response(null, { status: 500, headers });
    }

    if (isProtectedRoute && !user) {
      // Classic case of 403 but instead of just throwing that and leaving the UI busted, we want to redirect somewhere.
      setLocation(headers, resUrl, redirects.forbidden);
      const statusText = "403 Unauthorized";
      logger.debug(`403 caught. Redirecting to ${headers.get("location")}`);
      return new Response(null, { headers, status: 303, statusText });
    }

    ctx.state.user = user;

    if (reqUrl.pathname.startsWith("/api/signup")) {
      return makeSignupHandler({ redirects })(req, ctx);
    } else if (reqUrl.pathname.startsWith("/api/login")) {
      return makeLoginHandler({ redirects })(req, ctx);
    } else if (reqUrl.pathname.startsWith("/api/logout")) {
      return logoutHandler(req, ctx);
    } else if (reqUrl.pathname.startsWith("/api/confirm")) {
      return makeConfirmHandler({ redirects })(req, ctx);
    } else if (reqUrl.pathname.startsWith("/api/recover")) {
      return recoverHandler(req, ctx);
    }

    logger.debug(
      `Calling next for user.email=${user?.email}, location=${headers.get("location")}`,
    );

    return ctx.next();
  };
}
