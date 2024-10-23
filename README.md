# fresh-plugin-supabase

A [Fresh](https://fresh.deno.dev/) plugin providing authentication using [Supabase](https://supabase.com/) configured
for Server Side Rendering (SSR).

The plugin is meant to be a drop-in solution to add a simple SSR authentication scheme to any Fresh app. Just reference
the plugin in your `fresh.config.ts`, provide credentials of a Supabase project and keep developing your app.

The plugin provides some sensible defaults (which can be configured) and will

1. add auth handlers on the following routes:

```sh
/api/signup
/api/login
/api/logout
/api/confirm
/api/recover
```

2. intercept requests and will deny access to any route except

- the root (`new RegExp("^/$")`) (configurable)
- a public subset of the built-in routes above (`new RegExp("^/api/(signup|login|confirm).*")`)
- a default set of "frontend" routes (`new RegExp("^/(signup|login|confirm)$")`) (configurable)

# Usage

Add the following to your Fresh project's `fresh.config.ts`:

```ts
export default defineConfig({
  plugins: [supabase()],
});
```

Set your [Supabase credentials](.env.example) in the environment:

```sh
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

# Configuration

The plugin accepts a [`SupabasePluginOptions`](main.ts) object with the following options:

```ts
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
```

# Development

Run the project tests, optionally adding the `--watch` and/or `--quiet` flags:

```sh
deno task test --watch -q
```
