import { type FreshContext } from "$fresh/server.ts";

import { LOGGER_PREFIX } from "../main.ts";
import { createSupabaseClient } from "../lib/supabaseClient.ts";
import { bail, prepareResponse } from "../lib/utils.ts";

export async function logoutHandler(req: Request, _ctx: FreshContext) {
  const { headers, logger } = prepareResponse({
    req,
    loggerName: `${LOGGER_PREFIX}::logoutHandler`,
  });

  logger.debug(`Called`);

  const supabase = createSupabaseClient(req, headers);
  const { error } = await supabase.auth.signOut();

  if (error) return bail(headers, logger, error, true);

  logger.debug(`Success. Redirecting to: ${headers.get("location")}`);
  return new Response(null, {
    headers,
    status: 302,
  });
}
