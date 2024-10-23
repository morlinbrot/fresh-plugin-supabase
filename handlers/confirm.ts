import { type FreshContext } from "$fresh/server.ts";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseClient } from "../lib/supabaseClient.ts";
import { bail, prepareResponse, setLocation } from "../lib/utils.ts";
import { LOGGER_PREFIX, type SupabasePluginHandlerOptions } from "../main.ts";

export function makeConfirmHandler({ redirects }: SupabasePluginHandlerOptions) {
  return async function confirmHandler(req: Request, _ctx: FreshContext) {
    const { headers, logger, url } = prepareResponse({
      req,
      loggerName: `${LOGGER_PREFIX}::confirmHandler`,
    });

    const { searchParams } = url;
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    logger.debug(`Called with type=${type}, token_hash=${token_hash}`);

    let statusText = "";
    if (token_hash && type) {
      const supabase = createSupabaseClient(req, headers);
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      if (error) return bail(headers, logger, error);

      url.searchParams.delete("token_hash");

      switch (type) {
        case "signup": {
          logger.debug(`Case type=${type}`);
          setLocation(headers, url, redirects.forbidden);
          statusText = "Thanks for confirming your email address. You can now log in.";
          break;
        }
        case "recovery": {
          logger.debug(`Case type=${type}`);
          setLocation(headers, url, redirects.passwordReset);
          statusText = `Password reset. Please visit ${headers.get("location")} to set a new password.`;
          break;
        }
      }
    }

    logger.debug(`Success. Redirecting to: ${headers.get("location")}`);
    return new Response(null, { headers, status: 303, statusText });
  };
}
