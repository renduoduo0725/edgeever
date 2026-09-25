# EdgeEver Manual Online Deployment Guide

Deploy EdgeEver through GitHub and Cloudflare in your browser, without installing code locally or configuring a server.

---

## Prerequisites

- **GitHub Account** (for Forking the repository and enabling automated updates)
- **Cloudflare Account** (for hosting Worker logic, SQLite D1 database, and R2 storage)

---

## First Deployment

### Step 1: Fork the Repository

1. Visit the official EdgeEver repository: `https://github.com/tianma-if/edgeever`.
2. Click the **Fork** button at the top right to fork the repository into your GitHub account.

---

### Step 2: Create Storage & Database Resources in Cloudflare

Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/). If an entry moves, see the official [D1](https://developers.cloudflare.com/d1/get-started/) and [R2](https://developers.cloudflare.com/r2/get-started/) guides:

1. **Create a D1 Database**:
   - Under **Storage & databases**, open **D1 SQL Database** and click **Create database**.
   - Database name: exactly `edgeever`, then click **Create**.
2. **Create an R2 Bucket** (for note attachments & images):
   - Under **Storage & databases**, open **R2** -> **Overview**. If R2 is not yet enabled, complete the subscription flow shown there; then click **Create bucket**.
   - Bucket name: exactly `edgeever-resources`, then click **Create bucket**.

---

### Step 3: Import the Project

1. Open **Workers & Pages**, click **Create application**, then **Get started** next to **Import a repository**. If the entry moves, see [Cloudflare's instructions](https://developers.cloudflare.com/workers/ci-cd/builds/#connect-a-new-worker).
2. Follow the prompts to connect your GitHub account, authorize access to your Fork, and select the Forked `edgeever` repository.
3. Project settings:
   - **Worker name**: `edgeever`, matching the `name` in the root `wrangler.toml`
   - **Git branch** (or **Production branch**): `main`
   - **Root directory**: Leave blank to use the repository root
   - Deploy command: npx wrangler deploy (keep Cloudflare's default; Workers Builds runs it online, not on your computer)
   - **API token**: The automatically generated token may lack D1 permissions. Select or create a User API Token scoped to the target account with D1 read and edit permissions; if permissions are insufficient, correct them based on the build log and retry.

The deployment command creates the `DB` and `RESOURCES` bindings and looks up the D1 UUID. Do not edit `wrangler.toml` or add duplicate bindings in the Dashboard.

---

### Step 4: Create the Project and Set the Administrator Password

Click **Save and Deploy** to create the Worker. The first build fails verification because the administrator Secret is missing; do not use the site URL yet. Under the Worker's **Settings** → **Variables and Secrets**, click **Add**, add this runtime Secret, and click **Deploy**:

| Type | Name | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Secret** | `EDGE_EVER_AUTH_PASSWORD` | Preferably at least 32 characters | Administrator login password |

`EDGE_EVER_AUTH_PASSWORD` is the variable name; its value is the administrator login password. It is a Worker runtime Secret, not a Workers Builds variable.

Return to the build history and retry. Confirm the build and live health check succeed.

---

### Step 5: Verify Deployment, Login & Automatic Updates

1. After deployment completes, Cloudflare will assign a default domain (e.g., `https://edgeever.your-subdomain.workers.dev`).
2. Visit the health check endpoint in your browser: `https://<your-domain>/api/health`, and confirm it returns HTTP `200` with:
   ```json
   { "ok": true }
   ```
3. Open the homepage, log in with your configured administrator username (default: `admin`) and `EDGE_EVER_AUTH_PASSWORD`, and start using EdgeEver!
4. Go back to your Fork's **Actions** tab on GitHub and click **I understand my workflows, go ahead and enable them**.
5. Manually run **Update deployed EdgeEver** once to ensure future upstream updates can sync, and confirm Cloudflare receives the resulting build event.

---

## Advanced Configuration: Update Channels

By default, **Update deployed EdgeEver** follows official stable Release tags. To follow upstream `main` (Edge preview builds), set this **GitHub Repository Variable** on the Fork (**Settings → Secrets and variables → Actions → Variables**):

```text
EDGE_EVER_UPDATE_CHANNEL=edge
```

You can also pick `stable` / `edge` when manually running the workflow.

## Advanced Configuration: Instance Settings

To customize an instance, add non-secret values under the Worker's **Settings → Build → Build variables and secrets**:

| Build variable | Purpose |
| :--- | :--- |
| `EDGE_EVER_AUTH_USERNAME` | Administrator username; defaults to `admin` |
| `EDGE_EVER_WORKER_NAME` | Worker name |
| `EDGE_EVER_D1_DATABASE_NAME` | D1 database name; its UUID is discovered automatically |
| `EDGE_EVER_D1_DATABASE_ID` | Optional UUID fallback when discovery is unavailable |
| `EDGE_EVER_R2_BUCKET_NAME` | Optional explicit production R2 bucket override; upgrades otherwise reuse the live binding |
| `EDGE_EVER_R2_PREVIEW_BUCKET_NAME` | Preview R2 bucket name |
| `EDGE_EVER_WORKERS_DEV` | Enable or disable the `workers.dev` route |
| `EDGE_EVER_CUSTOM_DOMAIN` / `EDGE_EVER_ROUTE_PATTERN` | Custom routing |

Set a custom administrator username before retrying the initial build; changing the variable after the account exists does not rename it.

Older deployments need not migrate a custom R2 bucket; upgrades reuse the live `RESOURCES` binding unless overridden. Existing explicit build commands remain supported; see [Workers Builds configuration](cloudflare-workers-builds.md).

---

## Troubleshooting

- **Initial build failed**: Check the Worker **Deployments** log for “routing it through EdgeEver's validated deployment pipeline”. Verify that the standard resources are named exactly `edgeever` and `edgeever-resources`, and that the Workers Builds API token has D1 read/edit permission. For an intentionally different D1 database, set `EDGE_EVER_D1_DATABASE_NAME`; add `EDGE_EVER_D1_DATABASE_ID` only if automatic UUID discovery is unavailable.
- **Updates not syncing**:
  1. On the Fork **Actions** tab, enable **Update deployed EdgeEver** (scheduled workflows are off by default on public forks).
  2. Run it once with **Run workflow**. Open the bilingual job **Summary**: it separately reports the upstream target, Git publish result, deployment trigger, and whether the live deployment was verified.
  3. A scheduled green run with *Already on upstream target* means Git already matches that channel — not a broken skip. A manual run automatically republishes the selected version when already aligned. If the live site is still old afterward, compare the Cloudflare **Deployments** commit SHA.
  4. Prefer this workflow over GitHub **Sync fork** for day-to-day upgrades.
  5. If an old updater fails with `without workflows permission`, use **Sync fork** once as the repository owner, then re-run **Update deployed EdgeEver**. The current updater preserves `.github/workflows/**`, so later product updates do not hit this permission boundary.
- **Push succeeded but site unchanged**: Confirm Workers Builds ran for the new `main` SHA. Optionally add repository secret `EDGE_EVER_CLOUDFLARE_DEPLOY_HOOK_URL` so the workflow can call a Deploy Hook after publish.
- **The Android or iOS app reports that Cloudflare or a security policy blocked sign-in**:
  1. Retry once and record the diagnostic code, Ray ID, and approximate time shown by the app. In Cloudflare, open **Security → Analytics → Events**, find the matching request, and check its **Service**, **Action**, and rule ID before changing any protection.
  2. Native apps call `/api/*` directly and cannot complete an interactive browser challenge. Do not try to solve this by embedding the challenge in the app. Keep EdgeEver authentication and its application-level login rate limits enabled, but make sure legitimate API traffic receives a machine-readable response instead of a Managed or Interactive Challenge.
  3. If a custom WAF rule issued the challenge, narrow that rule so it does not challenge the required `/api/*` requests. For Managed Rules or Super Bot Fight Mode false positives, create the smallest applicable [Skip rule or exception](https://developers.cloudflare.com/waf/custom-rules/skip/). Do not broadly disable unrelated security controls.
  4. Cloudflare's free Bot Fight Mode cannot be bypassed by a WAF Skip rule. If Security Events identifies Bot Fight Mode, follow Cloudflare's [false-positive guidance](https://developers.cloudflare.com/bots/troubleshooting/false-positives/) and either disable it or use a protection mode that supports scoped exceptions.
- **Reset or Manual Recovery**: See the [Cloudflare Manual Deployment Guide](manual-deploy.md).
