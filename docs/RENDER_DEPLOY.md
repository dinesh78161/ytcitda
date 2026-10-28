# Deploy to Render

The app deploys as one Node web service. It serves the built React PWA and `/api/*`
from the same HTTPS address. Supabase remains the database, Auth and private file
store. No patient files are saved on Render's local filesystem.

## Dashboard setup

1. In [Render](https://dashboard.render.com/), choose **New → Web Service** and
   connect `https://github.com/dinesh78161/ytcitda`.
2. Select branch `main`, language **Node**, and leave **Root Directory empty**.
3. Set **Build Command** to `npm ci --include=dev && npm run build:render`.
4. Set **Start Command** to `npm start` and **Health Check Path** to `/api/status`.
5. Select your region and instance plan. For always-on production hosting, choose
   a paid instance. Free instances can be used for the hackathon preview but sleep
   when idle. Review the plan shown in the dashboard before creating the service.
6. Add these environment variables, copying your Supabase values from your local
   ignored `.env.server`. Never commit that file or paste secrets into documentation.

| Variable                    | Value                                           |
| --------------------------- | ----------------------------------------------- |
| `NODE_ENV`                  | `production`                                    |
| `SUPABASE_URL`              | Your Supabase project URL                       |
| `SUPABASE_PUBLISHABLE_KEY`  | Your publishable key (or legacy anon key)       |
| `SUPABASE_SECRET_KEY`       | Your current server secret key                  |
| `REMINDER_DELIVERY_ENABLED` | `false` until a delivery provider is configured |

The build command sets the browser's Supabase mode, URL and publishable key from
these variables. The server secret stays on the server. The build needs development
dependencies, which is why `--include=dev` is included. Node is pinned by
`.node-version`. Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically.
Do not copy the local `API_HOST`, `API_PORT` or `APP_ORIGINS` into Render. The server
listens on `0.0.0.0` and automatically accepts its own Render HTTPS origin.

7. Click **Create Web Service**. Wait for the build and health check to succeed,
   then open the exact HTTPS URL shown by Render.
8. In Supabase **Authentication → URL Configuration**, set **Site URL** to that
   HTTPS URL. Add it to the allowed redirect URLs if you use email auth redirects.
9. Sign in with an existing confirmed staff account, such as `worker@aarohanytc.in`,
   and the password you chose in Supabase. The account must have an active profile
   and appropriate assignments. The deployed build does not show the demo-role selector.

An alternative is **New → Blueprint**, using the included `render.yaml`. It prompts
for the three Supabase values and defaults to a **free preview instance** to avoid
unexpected charges. Change the plan in the blueprint or dashboard when moving to
always-on operation. It does not create a separate Render database.

## After deployment

- Open `/api/status`; it should return JSON. This endpoint reports configuration
  presence and server liveness, not a fresh database connectivity check.
- Run `npm run db:check` locally against the same Supabase settings. All 20 tables
  must be accessible. Do not rerun `setup.sql` on an initialized database.
- Verify sign-in, assigned patient access, report upload/download and district
  aggregate access using the different accounts. Verify unauthorized access fails.
- Test the app on Android over HTTPS, including camera and offline registration.
- Keep video, AI and reminder delivery disabled until their providers are set up
  and tested. See [INTEGRATIONS.md](INTEGRATIONS.md).

If you add a custom domain, set `APP_ORIGINS` to its full HTTPS origin. The default
Render origin remains accepted. Rebuild after changing the Supabase project URL or
publishable key, because these are included in the browser bundle at build time.
Secrets previously shared or committed must be rotated in Supabase before public use.

## Local production check

With `.env.server` configured:

```powershell
npm run build:render
npm start
```

`npm start` serves both the PWA and API on port 8787 locally (or `PORT` when set).
Stop another API process first if it already owns that port. To automate verification:

```powershell
npm test
npm run build:render
npm run test:production
```

The production browser test runs on port 4180 and checks the sign-in page, mobile
layout, same-origin API, and protection of environment files. It does not sign into
staff accounts or mutate hosted data.

References: [Render web services](https://render.com/docs/web-services),
[environment variables](https://render.com/docs/environment-variables),
[Node version](https://render.com/docs/node-version),
[free instance limitations](https://render.com/docs/free).
