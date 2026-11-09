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

Create the production site in `dist/`:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Lint and format

Check JavaScript, TypeScript, and Astro files with ESLint:

```sh
npm run lint
```

Format project files with Prettier:

```sh
npm run format
```

## Deploy to Netlify

Connect the repository to Netlify and use the following build settings:

- Build command: `npm run build`
- Publish directory: `dist`

The site uses Astro's static output. Netlify Forms can be added to form markup as those pages are implemented.

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
- Set `PUBLIC_SITE_URL` to the canonical site origin for production builds
  outside Netlify. Netlify's `URL` environment variable is used automatically
  when available so RSS links and canonical URLs can be absolute.
