import { FreshContext } from "$fresh/server.ts";

import { createSupabaseClient } from "../lib/supabaseClient.ts";
import { bail, prepareResponse, setLocation } from "../lib/utils.ts";
import { LOGGER_PREFIX, type SupabasePluginHandlerOptions } from "../main.ts";

export function makeSignupHandler({ redirects }: SupabasePluginHandlerOptions) {
  return async function signupHandler(req: Request, _ctx: FreshContext) {
    const {
      headers,
      logger,
      url: resUrl,
    } = prepareResponse({
      req,
      loggerName: `${LOGGER_PREFIX}::signupHandler`,
    });

    const form = await req.formData();
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();
    if (!email || !password) {
      const error = new Error("Failed to parse email or password form fields.");
      return bail(headers, logger, error, false, "Failed to parse email or password form fields.");
    }

    logger.debug(`Called with email=${email}`);

    const supabase = createSupabaseClient(req, headers);
    const { error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) return bail(headers, logger, error, true);

    logger.debug(`Success. Redirecting to: ${headers.get("location")}`);
    setLocation(headers, resUrl, redirects.signupSuccess);
    return new Response(null, {
      headers,
      status: 303,
      statusText: "Thanks for signing up. Your email address must be confirmed before you can log in.",
    });
  };
}
