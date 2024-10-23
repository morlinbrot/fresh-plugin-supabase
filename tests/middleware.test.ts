import { createHandler, defineConfig, ServeHandlerInfo } from "$fresh/server.ts";
import { assert, assertEquals, assertMatch } from "$std/assert/mod.ts";

import supabase from "../main.ts";
import { manifest } from "./testApp/manifest.ts";

const hostname = "127.0.0.1";
const port = 12345;

const CONN_INFO: ServeHandlerInfo = {
  remoteAddr: { hostname, port, transport: "tcp" },
  completed: new Promise(() => {}),
};

Deno.test("config option 'denyPattern'", async (t) => {
  const config = defineConfig({
    plugins: [supabase({ denyPattern: new RegExp("^/(protected|api/login)") })],
  });

  const handler = await createHandler(manifest, config);

  await t.step("protects specified routes", async () => {
    const url = `http://${hostname}/protected`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 303);
    assert(res.statusText.includes("403 Unauthorized"));
  });

  await t.step("always protects certain auth routes", async () => {
    // Some built-in routes are required for the plugin to function and are protected. These must not be overridden.
    const url1 = `http://${hostname}/api/logout`;
    const res1 = await handler(new Request(url1), CONN_INFO);
    assertEquals(res1.status, 303);
    assertEquals(res1.statusText, "403 Unauthorized");
    const url2 = `http://${hostname}/api/recover`;
    const res2 = await handler(new Request(url2), CONN_INFO);
    assertEquals(res2.status, 303);
    assertEquals(res1.statusText, "403 Unauthorized");
  });

  await t.step("never protects required auth routes", async () => {
    // We tried passing `/api/login` as protected route but it should always be allowed.
    const formData = new FormData();
    formData.append("email", "morlintest@mailbox.org");
    formData.append("password", "sechszeichenlang");

    const req = new Request(`http://${hostname}/api/login`, { method: "POST", body: formData });
    const res = await handler(req, CONN_INFO);

    assertEquals(res.status, 303);

    const cookie = res.headers.get("set-cookie");
    const re = new RegExp("^sb.*-auth-token=base64-eyJh");
    assertMatch(cookie!, re);
  });
});

Deno.test("config option 'allowPattern'", async (t) => {
  const defaultConfig = defineConfig({});
  const defaultHandler = await createHandler(manifest, defaultConfig);

  await t.step("allows certain non-api routes per default' ", async () => {
    // Some non-api routes are required to interact with the api routes defined by the plugin. A default set is hence
    // allowed but can be overridden.
    const url = `http://${hostname}/login`;
    const res = await defaultHandler(new Request(url), CONN_INFO);
    assertEquals(res.status, 200);
  });

  const config = defineConfig({
    // Allowing a /login route that has been moved to behind /auth;
    // Trying to allow /api/recover which should always be denied.
    plugins: [supabase({ allowPattern: new RegExp("^(/auth/login|/api/recover)$") })],
  });

  const handler = await createHandler(manifest, config);

  await t.step("allows specified routes", async () => {
    // Any non-api route except root should be denied per default.
    const url = `http://${hostname}/auth/login`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 200);
  });

  await t.step("does not allow certain allowed-per-default non-api routes if 'allowPattern' is set", async () => {
    // With setting /auth/login as our allowed login route, we want the default /signup to not be allowed anymore.
    // NOTE: Not testing with /login here as that is part of the default 'redirects' config which are also allowed.
    const url = `http://${hostname}/signup`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 303);
  });

  await t.step("does not allow certain always denied routes", async () => {
    const url = `http://${hostname}/api/recover`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 303);
  });
});

Deno.test("config option 'redirect'", async (t) => {
  const customRedirect = "customredirect";
  const redirects = {
    forbidden: customRedirect,
  };
  const config = defineConfig({
    plugins: [supabase({ redirects })],
  });

  const handler = await createHandler(manifest, config);

  await t.step("redirects to specified url", async () => {
    // `api/recover` is protected as per default.
    const url = `http://${hostname}/api/recover`;
    const res = await handler(new Request(url, { method: "POST", body: new FormData() }), CONN_INFO);
    assertEquals(res.status, 303);
    assertEquals(res.headers.get("location"), `http://${hostname}/${redirects.forbidden}`);
  });

  await t.step("does not protect routes specified in 'redirects'", async () => {
    const url = `http://${hostname}/${customRedirect}`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 200);
  });
});

Deno.test("config option 'protectRoot'", async (t) => {
  await t.step("does not protect root route as per default", async () => {
    const handler = await createHandler(manifest, defineConfig({ plugins: [supabase()] }));
    const url = `http://${hostname}/`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 200);
  });

  await t.step("does protect root if 'protectRoot' is set", async () => {
    const handler = await createHandler(manifest, defineConfig({ plugins: [supabase({ protectRoot: true })] }));
    const url = `http://${hostname}/`;
    const res = await handler(new Request(url), CONN_INFO);
    assertEquals(res.status, 303);
  });
});

// TODO: Actually implement.
Deno.test.ignore("config option 'prefix'", async (t) => {
  await t.step("applies only to auth routes", async () => {
    // TODO
  });
});
