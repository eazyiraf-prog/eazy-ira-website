# Cloudflare Workers deployment draft

Complete every step marked **[MANUAL]** yourself. Do not put secret values in
Git or in this document.

1. **[MANUAL] Create a Cloudflare account.** Confirm you can access the
   Cloudflare dashboard and Workers & Pages.
2. **[MANUAL] Buy or connect your domain.** Add your domain to Cloudflare, set
   its DNS nameservers if needed, and decide the production hostname. Record
   the canonical origin (for example, `https://your-domain.example`); do not
   substitute that example for your domain.
3. **[MANUAL] Create a Turnstile widget.** In the Cloudflare dashboard, create
   a widget allowing your production hostname and any development hostnames
   you will use. Keep the site key and secret key separate. The site key is
   public; the secret key must remain secret.
4. **[MANUAL] Create an email-service account and verify the sending domain.**
   The Worker currently uses Resend's HTTP API by default. Create a Resend
   account, verify a domain you control for sending, and choose the sender
   address that the Foundation will use. The privacy policy's provider and
   retention details remain placeholders until confirmed.
5. **[MANUAL] Set the build variables and Worker variables/secrets.**
   - In Workers Builds **Build variables and secrets**, set
     `PUBLIC_SITE_URL` to the canonical site origin and
     `PUBLIC_TURNSTILE_SITE_KEY` to the Turnstile site key. The public site key
     is compiled into the form markup.
   - In the Worker **Settings > Variables & Secrets**, set
     `PUBLIC_TURNSTILE_SITE_KEY` to the same site key and `EMAIL_FROM` to the
     verified sender address.
   - Add the following as **Worker secrets**, not plain-text variables:
     `TURNSTILE_SECRET_KEY` (Turnstile verification secret) and
     `RESEND_API_KEY` (Resend API key).
   - Add these as **Worker variables** after the team inboxes are confirmed:
     `NEWSLETTER_TO`, `CONTACT_TO`, `PARTNERSHIP_ENQUIRY_TO`,
     `VOLUNTEER_APPLICATION_TO`, `PRAYER_REQUEST_TO`, and
     `PRAYER_PARTNER_TO`. Each value is the recipient inbox for that form.
     Prayer requests, including those marked private, are sent only to
     `PRAYER_REQUEST_TO`.
6. **[MANUAL] Connect GitHub for automatic builds.** In Cloudflare, open
   **Workers & Pages**, create or select this Worker, then choose **Settings >
   Builds > Connect** and authorize GitHub. Select this repository and its
   production branch. Set the build command to exactly `npm run build:prod`.
   Leave the deploy command as `npx wrangler deploy`, the default. Ensure the
   Worker name matches `name` in `wrangler.toml`.
7. **[MANUAL] Configure and test the domain.** Attach your domain to the Worker
   using its production route/custom-domain settings. After the first build,
   check the home page, an unknown URL (which should show the site's 404 page),
   `/api/forms/...`, and the security headers in a browser's network panel.
8. **[MANUAL] Set up and verify team inbox addresses.** Confirm the six
   recipient addresses with the Foundation team, set each variable in step 5,
   send one test submission for every form, and verify that each arrives at
   the intended inbox. Confirm the prayer inbox is restricted to the prayer
   team. Check that the sending domain's authentication is accepted by the
   email provider.
9. **[MANUAL] Test the full form flow.** Submit a newsletter signup and one
   example from each remaining form. Confirm server-side Turnstile rejection
   for missing/invalid tokens, successful redirection to `/thank-you`, and
   the expected email routing. Do not submit real sensitive prayer details
   while testing.

## Local Worker development

1. **[MANUAL]** Copy `.dev.vars.example` to `.dev.vars` and fill in local
   credentials and recipient addresses. Never commit `.dev.vars`.
2. **[MANUAL]** Set `PUBLIC_TURNSTILE_SITE_KEY` in the shell before building,
  because Astro compiles the public site key into static form markup. Also
  set `PUBLIC_SITE_URL` to your local Worker origin. `.dev.vars` is read by
  Wrangler, not by Astro's build process. A normal browser form POST is
  supported without the site's fetch enhancement; Turnstile still requires
  its own browser script to issue a verifiable token. In PowerShell:

  ```powershell
  $env:PUBLIC_SITE_URL = "http://localhost:8787"
  $env:PUBLIC_TURNSTILE_SITE_KEY = "<your Turnstile site key>"
   npm run build
   npx wrangler dev
   ```

   Use your own key in place of the placeholder. Wrangler loads Worker secrets
   and variables from `.dev.vars`.

## Content Security Policy allowances

The `public/_headers` file is copied into `dist` and applies to static asset
responses. `_headers` does not apply to responses created by Worker code, so
the form endpoint applies the same baseline security headers itself.

- `'self'` is allowed for this site's bundled scripts and styles, self-hosted
  fonts/images, Pagefind, and same-origin form requests.
- Astro emits first-party module scripts and component styles inline. The build
  hashes their exact contents into the corresponding CSP directives;
  `unsafe-inline` is not enabled, and inline style attributes are not allowed.
- `https://challenges.cloudflare.com` is allowed for Turnstile scripts and
  challenge frames. The script is included only by the shared footer form
  component, which is present on every page that displays a newsletter form.
- `https://www.google.com` is allowed only as a frame source for the Contact
  page's map, which is not loaded until a visitor clicks the map button.
- Arbitrary remote scripts/styles, plugins, and embedding this site in frames
  are not allowed. Inline scripts/styles require an exact build-generated
  SHA-256 hash in the matching CSP directive.

## Environment variable reference

| Name | Where | Purpose |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Build variable | Canonical origin for RSS and absolute canonical URLs. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Build variable and Worker variable | Public Turnstile widget key; also compiled into static form markup. |
| `TURNSTILE_SECRET_KEY` | Worker secret | Server-side Turnstile Siteverify requests. |
| `RESEND_API_KEY` | Worker secret | Authorization for Resend's email API. |
| `EMAIL_FROM` | Worker variable | Verified sender address for form notification emails. |
| `NEWSLETTER_TO` | Worker variable | Newsletter team inbox. |
| `CONTACT_TO` | Worker variable | General contact inbox. |
| `PARTNERSHIP_ENQUIRY_TO` | Worker variable | Partnership enquiries inbox. |
| `VOLUNTEER_APPLICATION_TO` | Worker variable | Volunteer applications inbox. |
| `PRAYER_REQUEST_TO` | Worker variable | Prayer request inbox; private prayer requests go only here. |
| `PRAYER_PARTNER_TO` | Worker variable | Prayer-partner signups inbox. |

## Documentation references

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Static asset redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)
- [Turnstile widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
