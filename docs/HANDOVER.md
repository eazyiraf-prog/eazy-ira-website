# Foundation website handover

## Accounts and services

Access should belong to Foundation-controlled accounts with at least two
authorized maintainers. Prices and renewal dates are not recorded in the
repository; the responsible role should confirm them in each provider account.

| Account or service | Purpose | Owner (role) | Cost | Renewal/date to track | Secret or credential storage |
| --- | --- | --- | --- | --- | --- |
| Domain registrar and DNS | Domain registration, nameservers, DNS records | Foundation director / designated technical administrator | Unknown; confirm registrar plan | Domain expiry and renewal date | Registrar password manager; DNS/API tokens in the host's encrypted secrets store |
| Static hosting and Worker host (currently Cloudflare) | Serve `./dist`; run forms Worker and route requests | Designated technical administrator, with a second Foundation administrator | Unknown; confirm account plan and usage charges | Monthly usage review; plan and domain renewal dates | Host dashboard secret store; never Git |
| Email-sending provider (currently Resend) | Deliver form notifications | Communications lead and technical administrator | Unknown; confirm provider plan and usage charges | Billing renewal and sending-domain verification dates | Provider API key in Worker encrypted secrets; inbox credentials in the Foundation password manager |
| Foundation team inboxes | Receive contact, volunteer, partnership, newsletter, and prayer submissions | Relevant team leads; prayer inbox owned by safeguarding/prayer lead | Unknown; confirm email provider | Account recovery and subscription renewal dates | Approved team password manager; restrict prayer inbox access |
| Cloudflare Turnstile | Protect public forms from automated submissions | Technical administrator | Current cost unknown; confirm provider terms | Review widget hostnames and keys annually and after domain changes | Public site key in build/Worker variables; secret key in Worker encrypted secrets |
| GitHub organization/repository and CMS OAuth app | Source, pull requests, deployment integration, CMS OAuth routes | Foundation director owns organization; technical administrator manages repository access | Unknown; confirm plan | Review access monthly and when a role changes | `GITHUB_OAUTH_CLIENT_SECRET` in Worker encrypted secrets; `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_SCOPE` in Worker/build variables |
| MTN Mobile Money (MoMo) | Receive local donations | Treasurer, with Foundation director oversight | Provider charges unknown; confirm locally | Review account authority and payee details annually | Provider's approved secure account-recovery process; never place credentials in site content |
| Online fundraiser platform/account | Receive international fundraising; currently described as a US-based friend's fundraiser | Foundation director and treasurer; fundraiser organizer remains accountable for platform account | Platform and payment fees unknown; confirm with organizer | Review campaign access, payout schedule, and account recovery quarterly | Platform password manager; no access tokens in repository |
| Foundation records and document storage | Approved safeguarding, legal, financial, and handover documents | Foundation director and safeguarding lead | Unknown; confirm storage plan | Review access quarterly and retention requirements annually | Organization-controlled storage with role-based access; not public Git |

Do not record secret values in this table. Confirm actual providers, account
owners, costs, and renewal dates with the Foundation before launch.

## When someone leaves

- Remove their GitHub organization, repository, deployment, and CMS access.
- Revoke their OAuth authorizations and any personal access tokens; rotate the
  GitHub OAuth client secret if they could access it.
- Remove access to registrar/DNS, hosting, email, Turnstile, MoMo, fundraiser,
  inboxes, and shared storage.
- Rotate host, Worker, email-provider, Turnstile, and deployment keys they
  could access; update the encrypted host secret store and verify forms.
- Transfer ownership and recovery contacts to Foundation-controlled accounts;
  document the change without copying secret values.

## Monthly maintenance routine

1. Review and update verified impact numbers in `src/data/impact.json`; keep
   the required single source of truth and record its `lastUpdated` value.
2. Publish verified news and approved gallery items; confirm guardian consent
   is recorded before publishing any image depicting a child.
3. Review open pull requests, deployment status, and repository access.
4. Submit a safe test to each public form and confirm messages reach the
   correct inbox; do not use real sensitive prayer details.
5. Run `npm audit` and address production dependency advisories.
6. Run `npm run check:launch`, `npm run build`, `npm run build:prod`,
   `npm run lint`, `npx tsc --noEmit`, and `npm run test:worker`.
7. Check the live home page, donate flow, language switcher, legal pages, and
   form success/error paths; review host billing and renewal dates.

## Rollback

1. Identify the last known-good deployment in the hosting provider's deployment
   history and verify its commit and build output.
2. Redeploy that previous immutable build/version using the provider's rollback
   or promote-previous-deployment action. If redeployment is commit-based,
   select the known-good commit; do not rewrite shared Git history.
3. Confirm the production domain points to the restored version and test the
   home page, donation links, language routes, and forms.
4. Preserve logs and the failing commit reference, notify the Foundation
   director, and open a corrective pull request before deploying again.
5. If secrets or account access may be involved, revoke/rotate affected
   credentials before restoring service.
