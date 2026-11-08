# Hero slider guide

## Add or remove a slide

1. Open `src/data/hero-slides.json`.
2. Add an object with a unique `id` and the required fields: `type`, `src`,
   `poster`, `alt`, `eyebrow`, `headline`, `text`, `buttonLabel`, `buttonHref`,
   `consentConfirmed`, and `needsConfirmation`.
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
recorded. For any slide that contains children, set `containsChildren` to
`true` and `consentConfirmed` to `true` only after consent is recorded. A build
fails with a clear error if a slide is flagged as containing children without
confirmed consent. Until then, use placeholder imagery and set
`containsChildren` to `false`.
