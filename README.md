# image-validation

A Strapi 5 plugin that enforces aspect-ratio and minimum-width constraints on `media` fields, both in the admin UI and on the API, so content editors can't save images that don't fit a component's design.

## How it works

Add an `imageValidation` object to a `media` attribute's `options` in its schema (e.g. a component or content-type `schema.json`). Each rule pairs an accepted aspect ratio with the minimum width an image of that ratio must have:

```json
"background_image": {
  "type": "media",
  "multiple": false,
  "allowedTypes": ["images"],
  "options": {
    "imageValidation": {
      "mode": "aspectRatio",
      "rules": [
        { "aspectRatio": { "width": 16, "height": 9 }, "minWidth": 1920 },
        { "aspectRatio": { "width": 4, "height": 3 }, "minWidth": 1600 }
      ]
    }
  }
}
```

A field accepts any image matching one of the listed ratios, as long as it's at least that ratio's `minWidth` wide. Ratio comparison allows a small fixed tolerance internally to absorb floating-point rounding.

### Admin panel

`ValidatedMediaField` wraps Strapi's native media input (registered via `app.addFields({ type: 'media' })`). When an editor picks/changes an image:

- It reads `attribute.options.imageValidation` for that field.
- It runs the same validation logic against the asset's `width`/`height`.
- If validation fails, the change is reverted to the last valid value and a toast notification explains why.
- If the field has configured rules, a hint (e.g. "Allowed aspect ratios: 16:9 (min width 1920px), 4:3 (min width 1600px)") is shown beneath the input.

### Validation logic

The width/height/aspect-ratio check lives in two copies with identical logic:

- `admin/src/utils/validateImage.ts` — used by the admin field.
- `server/src/utils/validate-image.ts` — for server-side/API use.

Both export `validateImage(asset, imageValidation)` returning `{ valid, message? }`.

## Limitations

- Only aspect ratio and minimum width are checked — no file size, format, or content checks.
- The admin check relies on the asset object already carrying `width`/`height` (as returned by the Upload API); if those are missing, validation fails closed with an "unable to determine dimensions" message.
