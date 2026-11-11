# CMS administrator setup

The CMS is Sveltia CMS, served at `/admin/`. It edits only the collections
listed in its configuration. Changes use Sveltia's GitHub Editorial Workflow
and are reviewed as pull requests before they reach `main`.

## Manual setup steps

1. **[MANUAL] Deploy the Worker once and record its Cloudflare test address.**
   The Worker name in `wrangler.toml` is `eazy-ira-foundation`. Cloudflare
   assigns the account subdomain, so the exact test address is
   `https://eazy-ira-foundation.<your-account-subdomain>.workers.dev`. Replace
   the bracketed part with the subdomain shown in your Cloudflare dashboard.
   The OAuth callback address is
   `https://eazy-ira-foundation.<your-account-subdomain>.workers.dev/api/callback`.

2. **[MANUAL] Create a GitHub OAuth App.** In GitHub, go to **Settings >
   Developer settings > OAuth Apps > New OAuth App**. For the first setup,
   enter the test address from step 1 as **Homepage URL** and the callback
   address from step 1 as **Authorization callback URL**. GitHub allows up to
   10 callback URLs, so add the production callback too after the real domain
   is known. Change **Homepage URL** to the real origin at that time. Generate
   a client secret and copy the
   Client ID and secret securely. The Worker uses the standard authorization
   code flow; GitHub redirects the popup to `/api/callback`, where the Worker
   checks its one-time state cookie before exchanging the code.

   GitHub enables expiring user access tokens by default for new OAuth Apps.
   This authenticator protocol currently returns the access token to Sveltia
   but does not refresh it, so turn off **Expire user access tokens** in the
   OAuth App settings until refresh-token support is implemented. Editors may
   need to sign in again if GitHub revokes a token.

3. **[MANUAL] Set Worker secrets.** In Cloudflare, open the deployed Worker,
   then **Settings > Variables and Secrets**. Add both values as encrypted
   Worker secrets:
   - `GITHUB_OAUTH_CLIENT_ID`
   - `GITHUB_OAUTH_CLIENT_SECRET`

   Never put either value in `config.yml`, a build variable, or a committed
   file.

4. **[MANUAL] Set Worker variables.** Set `GITHUB_OAUTH_SCOPE` to `repo`
   (the default) because this repository is private. GitHub's `repo` scope is
   needed for private repositories; `public_repo` works only when the
   repository is public. If the repository later becomes public and you choose
   the narrower scope, set `GITHUB_OAUTH_SCOPE=public_repo` on both the Worker
   and Workers Builds so the generated CMS request and Worker agree.

   Also add these ordinary Worker variables:
   - `PUBLIC_SITE_URL`: the exact HTTPS origin editors will use, initially
     `https://eazy-ira-foundation.<your-account-subdomain>.workers.dev`.
     Later change it to the real production origin.
   - `PUBLIC_TURNSTILE_SITE_KEY`, `EMAIL_FROM`, `NEWSLETTER_TO`, `CONTACT_TO`,
     `PARTNERSHIP_ENQUIRY_TO`, `VOLUNTEER_APPLICATION_TO`, `PRAYER_REQUEST_TO`,
     and `PRAYER_PARTNER_TO`, as documented in `docs/DEPLOY.md`.

   The OAuth Worker accepts only the origin in `PUBLIC_SITE_URL`; it refuses
   other `site_id` values and sends the token only to that exact origin.

5. **[MANUAL] Set Cloudflare Workers Builds variables.** Set `PUBLIC_SITE_URL`
   to the exact HTTPS origin for this deployment. The build writes that origin
   into the CMS OAuth `base_url`. Set `GITHUB_OAUTH_SCOPE` to the same value
   as the Worker (normally `repo`). Also set `PRODUCTION_SITE_URL` to the
   final real production origin. The build compares normalized HTTPS origins:
   `X-Robots-Tag: noindex, nofollow` is emitted if `PUBLIC_SITE_URL` is unset,
   `PRODUCTION_SITE_URL` is unset, or the two origins differ. Thus the
   Cloudflare test address and preview builds stay out of search indexes. Only
   an exact match to the explicitly configured production origin removes the
   header.

6. **[MANUAL] Invite each editor as a repository collaborator.** In GitHub,
   open this repository's **Settings > Collaborators** and invite each
   editor's GitHub account with **Write** access. Sveltia requires repository
   write access; Write is the lowest collaborator role that works. Editors
   also need a GitHub account and must accept the invitation.

   Require editors to use a GitHub account used only for Foundation work. On
   shared computers, editors must sign out of GitHub when finished. When an
   editor leaves, the owner must remove their repository collaborator access
   and revoke the Foundation OAuth App authorization from that editor's GitHub
   account.

7. **[MANUAL] Protect `main`.** In GitHub, open **Settings > Rules > Rulesets**
   (or **Branches > Add branch protection rule**) and target `main`. Require a
   pull request before merging, require at least one approval, and enable
   **Require review from Code Owners**. `.github/CODEOWNERS` assigns all paths
   to `@eazyiraf-prog`. **[MANUAL] Verify this resolves to your own GitHub
   user account with write access.** If the repository owner is an
   organization, replace it with your GitHub username in `.github/CODEOWNERS`
   before enabling Code Owner review. Do not configure editor bypasses;
   disallow force pushes and deletion. This prevents a collaborator with Write
   access from pushing changes directly to `main`.

8. **[MANUAL] Review and approve a content change.** Open the pull request
   linked from Sveltia's Editorial Workflow. Review the text and media, check
   child-photo consent records and alt text, and inspect any report total
   warning. Approve only after the change is acceptable. Sveltia may still
   show an editor its Publish action even when GitHub branch rules prevent that
   editor from merging; GitHub enforces the required approval. Once approved,
   the authorized editor or administrator can merge the pull request.

9. **[MANUAL] Verify the deployment.** A merge to `main` triggers the existing
   Cloudflare Worker build and deployment. The build runs the site's existing
   content checks; a failing build does not publish the new static site. The
   current production build also requires the contact email in
   `src/data/site.json` to be confirmed before it can pass its production
   guard.

10. **[MANUAL] Switch from the test address to the real domain.** Once the
    production domain is connected to the Worker, change the OAuth App
    Homepage URL to the real HTTPS origin, add or replace the callback URL
    with `<real-origin>/api/callback`, and set the Worker and Workers Builds
    `PUBLIC_SITE_URL` values to that same origin. Set
    `PRODUCTION_SITE_URL` to the same origin. Rebuild and verify `/admin/`,
    sign-in, and the `X-Robots-Tag` response header.

## Current CMS and GitHub constraints

- Sveltia's GitHub backend requires Write, Maintain, or Admin repository
  access. Its Editorial Workflow creates a pull request for each entry and
  stages it as Draft, In Review, or Ready to Publish. These are Sveltia
  workflow stages/labels; do not assume they are GitHub's native Draft PR
  status.
- With a protected branch, the CMS can still show Publish to an editor who
  cannot merge; GitHub rejects the merge until branch rules are met.
- This repository is private, so the authenticator requests the `repo` OAuth
  scope. `public_repo` works only for a public repository. GitHub OAuth scopes
  are not repository-specific: `repo` covers the user's repositories, not
  only this one repository. The collaborator invitation and branch rules
  remain necessary.
- GitHub recommends GitHub Apps for fine-grained permissions, but this
  integration uses an OAuth App as required for Sveltia's authorization-code
  flow.
- Current Sveltia documentation marks the CMS beta. It also says client-side
  PKCE authentication for GitHub is not implemented while GitHub's PKCE work
  is on hold. This setup keeps the OAuth secret on the Worker and uses the
  documented server-side authorization-code flow instead.
- Sveltia is pinned to version `0.253.0`, published October 26, 2026. Its
  bundle, runtime chunks, locales, schema, and dynamically loaded editor
  modules are copied into `public/admin` during builds; the version check is
  local too. UI fonts are served from `cdn.jsdelivr.net`. The beta status means
  its behavior may change. The login flow can only be fully tested after the
  Worker and OAuth App are deployed and configured.

## Admin Content Security Policy

The admin rule is limited to `/admin/*`; the public-page CSP is generated on
the public route patterns and does not overlap the admin rule. The current
Sveltia bundle's status check also needs `www.githubstatus.com`. The exact
admin-only allowances are:

- `script-src`: `'self'`
- `style-src`: `'self'`, `'unsafe-inline'` (needed for CMS-generated styles;
  limited to `/admin/*`)
- `img-src`: `'self'`, `blob:`, `data:`, `https://avatars.githubusercontent.com`
- `font-src`: `'self'`, `https://cdn.jsdelivr.net`
- `connect-src`: `'self'`, `https://api.github.com`,
  `https://www.githubstatus.com`, `blob:`, `data:`
- `media-src`: `blob:`
- `frame-src`: `'self'`, `blob:`

`default-src 'self'` remains the fallback. No `unsafe-eval` is enabled. The
public pages do not receive these CMS-specific sources.

## Worker secrets and variables

| Name                         | Cloudflare setting                 | Purpose                                                               |
| ---------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `GITHUB_OAUTH_CLIENT_ID`     | Worker secret                      | GitHub OAuth App client ID                                            |
| `GITHUB_OAUTH_CLIENT_SECRET` | Worker secret                      | GitHub OAuth App client secret                                        |
| `PUBLIC_SITE_URL`            | Worker variable and build variable | Exact origin allowed to receive a token; also sets CMS OAuth base URL |
| `GITHUB_OAUTH_SCOPE`         | Worker and build variable          | Must match; use `repo` for this private repository                     |
| `PUBLIC_TURNSTILE_SITE_KEY`  | Worker variable and build variable | Turnstile public key                                                  |
| `TURNSTILE_SECRET_KEY`       | Worker secret                      | Turnstile verification                                                |
| `RESEND_API_KEY`             | Worker secret                      | Resend API access                                                     |
| `EMAIL_FROM`                 | Worker variable                    | Verified sender                                                       |
| `NEWSLETTER_TO`              | Worker variable                    | Newsletter inbox                                                      |
| `CONTACT_TO`                 | Worker variable                    | Contact inbox                                                         |
| `PARTNERSHIP_ENQUIRY_TO`     | Worker variable                    | Partnership inbox                                                     |
| `VOLUNTEER_APPLICATION_TO`   | Worker variable                    | Volunteer inbox                                                       |
| `PRAYER_REQUEST_TO`          | Worker variable                    | Prayer request inbox                                                  |
| `PRAYER_PARTNER_TO`          | Worker variable                    | Prayer partner inbox                                                  |
| `PRODUCTION_SITE_URL`        | Workers Builds variable only       | Expected real HTTPS origin used to remove noindex on production       |

## Documentation checked

- [Sveltia CMS Getting Started](https://sveltiacms.app/en/docs/start)
- [Sveltia GitHub backend](https://sveltiacms.app/en/docs/backends/github)
- [Sveltia Editorial Workflow](https://sveltiacms.app/en/docs/workflows/editorial)
- [Sveltia Security and CSP](https://sveltiacms.app/en/docs/security)
- [Sveltia Authenticator setup](https://github.com/sveltia/sveltia-cms-auth)
- [GitHub: Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [GitHub: Authorizing OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub: OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub: Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
