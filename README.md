# EAZY-IRA Charity Foundation Website

The official website for EAZY-IRA Charity Foundation, built with Astro and Tailwind CSS.

## Requirements

- Node.js 22.23.4 or newer
- npm 9.6.5 or newer

## Setup

Install the project dependencies:

```sh
npm install
```

## Run locally

Start the development server:

```sh
npm run dev
```

## Build and preview

Create the production site in `dist/` and generate the Pagefind search index:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Languages

English is served at the site root; French and Kinyarwanda are served under
`/fr` and `/rw`. The home, About overview, and Donate pages have localized
content. Other pages show an English fallback notice, while legal content and
donation/payment instructions remain in English with a notice. French and
Kinyarwanda entries in `src/i18n/fr.json` and `src/i18n/rw.json` are marked
`needsNativeReview: true` until checked by a native speaker.

The selected language is remembered in the browser. `npm run build` checks
that every key in `src/i18n/en.json` exists in both translated dictionaries.

Production guard: `npm run build` validates when `NODE_ENV=production` or
`CI=true`; `npm run build:prod` always validates before building and is the
required production build command.

## Lint and format

Check JavaScript, TypeScript, and Astro files with ESLint:

```sh
npm run lint
```

Format project files with Prettier:

```sh
npm run format
```

## Deploy to Cloudflare Workers

The site is deployed as a Cloudflare Worker with static assets from `dist/`.
The Worker handles form submissions at `/api/forms/<formName>`. See
[`docs/DEPLOY.md`](docs/DEPLOY.md) for the manual Cloudflare setup.

For local Worker development, copy `.dev.vars.example` to `.dev.vars`, fill in
local credentials, build with `PUBLIC_TURNSTILE_SITE_KEY` set in the shell, and
run `npx wrangler dev`. `.dev.vars` is ignored by Git.

The site uses Astro's static output and Pagefind for site-wide search. The
build creates the search index in `dist/pagefind/`. The Contact page's map is
not requested from Google Maps unless a visitor chooses to load it.

Content editors save approved changes to GitHub. Run `git pull` before every
push so your local branch includes the latest reviewed content.

## Gallery and news content

- Add album JSON files under `src/content/albums/`. Each album requires:
  - `title`: the album's name.
  - `date`: the album date in ISO format (for example, `2026-11-09`).
  - `category`: the album's category.
  - `consentConfirmed`: `true` only when guardian consent has been recorded for
    the child photos in the album; otherwise use `false`.
  - `published`: `true` when the album is being published and `false` while it
    is not ready for publication.
  - `images`: at least one image, each with:
    - `src`: the image path.
    - `alt`: a useful description for people using screen readers. Published
      albums cannot have blank alt text.
    - `caption`: the caption displayed with the image.
    - `depictsChildren`: `true` if the image shows children; otherwise `false`.
      This field is required for every image.
    - `consentNotes`: a required text field. For an image showing children,
      explain who gave consent and how (for example, `guardian written consent
      on file`). It cannot be blank when `depictsChildren` is `true`. If the
      image does not show children, an empty string is acceptable.
  The build fails if consent is not confirmed for an album containing child
  photos, if consent notes are missing for a child photo, or if a published
  album has blank alt text.
- Add news Markdown files under `src/content/news/`. Frontmatter requires
  `title`, ISO `date`, `category`, `summary`, an `image` with `src` and
  non-empty `alt`, `author`, and `draft`. Posts marked `draft: true` are not
  published or included in the RSS feed at `/news/rss.xml`.
- Sample posts and the sample album are clearly identified in their content
  and on the site; replace them only with verified, safeguarding-reviewed
  content.
- Set `PUBLIC_SITE_URL` to the canonical site origin for production builds so
  RSS links and canonical URLs can be absolute.
