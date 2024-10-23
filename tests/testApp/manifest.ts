import type { Manifest } from "$fresh/server.ts";

import * as $_app from "./routes/_app.tsx";
import * as $auth_login from "./routes/auth/login.tsx";
import * as $login from "./routes/login.tsx";
import * as $customredirect from "./routes/customredirect.tsx";
import * as $index from "./routes/index.tsx";
import * as $open from "./routes/open.tsx";
import * as $protected from "./routes/protected.tsx";

// Minimal test app manifest to be able to test protected and unprotected routes.
export const manifest = {
  routes: {
    "./routes/_app.tsx": $_app,
    "./routes/auth/login.tsx": $auth_login,
    "./routes/login.tsx": $login,
    "./routes/customredirect.tsx": $customredirect,
    "./routes/index.tsx": $index,
    "./routes/open.tsx": $open,
    "./routes/protected.tsx": $protected,
  },
  islands: {},
  baseUrl: import.meta.url,
} satisfies Manifest;
