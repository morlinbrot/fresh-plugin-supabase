import { createHandler, defineConfig, ServeHandlerInfo } from "$fresh/server.ts";
import { assert, assertEquals } from "$std/assert/mod.ts";
import { assertMatch } from "$std/assert/assert_match.ts";

import supabase from "../main.ts";
import { manifest } from "./testApp/manifest.ts";

const hostname = "127.0.0.1";
const port = 53496;

const CONN_INFO: ServeHandlerInfo = {
  remoteAddr: { hostname, port, transport: "tcp" },
  completed: new Promise(() => {}),
};

Deno.test("route /api/login", async (t) => {
  const config = defineConfig({
    plugins: [supabase()],
  });
  const handler = await createHandler(manifest, config);

  await t.step("logs a user in and lets user access protected route", async () => {
    const formData = new FormData();
    formData.append("email", "morlintest@mailbox.org");
    formData.append("password", "sechszeichenlang");

    const req = new Request(`http://${hostname}/api/login`, { method: "POST", body: formData });
    const res = await handler(req, CONN_INFO);

    assertEquals(res.status, 303);

    const cookie = res.headers.get("set-cookie");
    const re = new RegExp("^sb.*-auth-token=base64-eyJh");
    assertMatch(cookie!, re);

    // const reqProtected = new Request(`http://${hostname}/protected`, {
    //   // headers.set()
    // });
    // const resProtected = await handler(reqProtected, CONN_INFO);
    // console.log("GOT: ", resProtected);
    // assertEquals(resProtected.status, 200);
  });

  await t.step("informs and redirects for wrong credentials", async () => {
    const formData = new FormData();
    formData.append("email", "morlintest@mailbox.org");
    formData.append("password", "wrongpassword");

    const req = new Request(`http://${hostname}/api/login`, { method: "POST", body: formData });
    const res = await handler(req, CONN_INFO);

    const { statusText } = res;
    assert(!!statusText.length);
    assert(statusText.toLocaleLowerCase().includes("invalid"));

    const location = `http://${hostname}/login`;
    assertEquals(res.headers.get("location"), location);

    assertEquals(res.status, 303);
  });

  await t.step("informs about pending email confirmation", async () => {
    // TODO
  });

  await t.step("lets user access a protected route", async () => {
    // TODO
  });
});
