# Hero slider guide

## Add or remove a slide

1. Open `src/data/hero-slides.json`, or use the Hero slides section of the
   editing screen at `/admin`.
2. Add an object with a unique `id` and these required fields: `type`, `src`,
   `alt`, `consentConfirmed`, `depictsChildren` and `consentNotes`. Also fill
   in the display fields: `poster` (video slides only), `eyebrow`, `headline`,
   `text`, `buttonLabel`, `buttonHref` and `needsConfirmation`.
3. Use `type: "image"` for an image, or `type: "video"` for a silent video.
   Video slides also need a poster image. Keep the text to one short sentence.
4. Set `needsConfirmation` to `true` for unconfirmed claims. Never type impact
   figures into slide text; read them from `src/data/impact.json`.
5. To remove a slide, remove its object from the JSON array.

The current hero artwork is abstract placeholder imagery. Replace it with
approved, descriptive images when they are available.

## Media recommendations

- Images: around 1920 × 1080 pixels in WebP or AVIF. Provide a useful alt
  description and use a crop that remains legible on mobile.
- Videos: MP4 using H.264, under 6 MB and under 15 seconds. Keep the video
  silent and omit its audio track; supply a poster image in the same visual
  style. The slider only loads video on screens wider than 768 pixels when
  Data Saver and slow-connection restrictions are not active.
- The slider's responsive image candidates currently use the bundled SVG
  placeholder files. Update the image `src` and responsive candidates in
  `src/components/HeroSlider.astro` when adding differently sized assets.

## Child-photo consent

Do not publish a child's photo or video until guardian consent has been
recorded. Every slide must have these three fields, and the build checks them:

- `depictsChildren`: `true` if any child can be seen in the image or video,
  even partly; otherwise `false`. Only use `false` when the image really shows
  no children. Never use `false` to get around the consent check.
- `consentConfirmed`: `true` only after a guardian has agreed to the photo or
  video being published. It must be `true` whenever `depictsChildren` is
  `true`.
- `consentNotes`: a short note saying who gave consent and how (for example,
  "guardian written consent on file"). It must not be empty whenever
  `depictsChildren` is `true`. Never write a child's full name here.

The build fails with a clear error, naming the slide, if a field is missing or
if a slide shows children without confirmed consent. Until consent is
recorded, use placeholder imagery that shows no children, with
`depictsChildren` set to `false`.