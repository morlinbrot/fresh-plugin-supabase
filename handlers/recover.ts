import { type FreshContext } from "$fresh/server.ts";

import { LOGGER_PREFIX } from "../main.ts";
import { createSupabaseClient } from "../lib/supabaseClient.ts";
import { bail, prepareResponse } from "../lib/utils.ts";

export async function recoverHandler(req: Request, _ctx: FreshContext) {
  const { headers, logger } = prepareResponse({
    req,
    loggerName: `${LOGGER_PREFIX}::recoverHandler`,
  });

  const form = await req.formData();
  const email = form.get("email")?.toString();
  if (!email) {
    const error = new Error("Failed to parse email form field.");
    return bail(headers, logger, error);
  }

  logger.debug(`Called for email=${email}`);

  const supabase = createSupabaseClient(req, headers);
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return bail(headers, logger, error, true);

  logger.debug(`Success. Redirecting to location=${headers.get("location")}`);
  return new Response(null, { headers, status: 303 });
}
