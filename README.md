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
