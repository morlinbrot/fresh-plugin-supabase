import type { FreshContext } from "$fresh/server.ts";

import { LOGGER_PREFIX, type SupabasePluginHandlerOptions } from "../main.ts";
import { createSupabaseClient } from "../lib/supabaseClient.ts";
import { bail, prepareResponse, setLocation } from "../lib/utils.ts";

export function makeLoginHandler({ redirects }: SupabasePluginHandlerOptions) {
  return async function loginHandler(req: Request, _ctx: FreshContext) {
    const { headers, logger, url } = prepareResponse({ req, loggerName: `${LOGGER_PREFIX}::loginHandler` });

    const form = await req.formData();
    const email = form.get("email")?.toString() || "";
    const password = form.get("password")?.toString() || "";

    if (!email || !password) {
      const error = new Error("Failed to parse email or password form fields.");
      return bail(headers, logger, error);
    }

    logger.debug(`Called with email=${email}`);

    const supabase = createSupabaseClient(req, headers);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error?.status === 400 && error.message.includes("not confirmed")) {
      logger.debug(`Email not confirmed. Redirecting to: ${headers.get("location")}`);
      const statusText = "Email not confirmed. Please confirm your email address before signing in.";
      return new Response(null, { headers, status: 303, statusText });
    }

    if (error?.status === 400 && error.code === "invalid_credentials") {
      setLocation(headers, url, redirects.forbidden);
      logger.debug(`Invalid login credentials. Redirecting to: ${headers.get("location")}`);
      const statusText = "Invalid login credentials.";
      return new Response(null, { headers, status: 303, statusText });
    }

    if (error) {
      return bail(headers, logger, error, true);
    }

    logger.debug(`Success. Redirecting to: ${headers.get("location")}`);

    const statusText = `Welcome back ${data.user?.email}`;
    return new Response(null, { headers, status: 303, statusText });
  };
}
