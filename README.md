# Strapi Image Validation

A Strapi plugin that validates images uploaded through Media fields based on their **aspect ratio** and **minimum width**.

The plugin helps define image requirements directly at the CMS field level, reducing the need for content editors to manually test different images on the website.

## Overview

Different sections of a website often require different types of images.

For example:

- A hero banner may require a wide `16:9` image.
- A card may require a `4:3` image.
- A profile or promotional image may require a square `1:1` image.

Without clear guidance in the CMS, content editors may upload images with incorrect dimensions or insufficient resolution. These issues are often discovered only after checking how the image appears on the frontend.

This can result in:

- Incorrect cropping
- Inconsistent layouts
- Distorted image presentation
- Low-quality or pixelated images
- Manual trial and error when selecting images

**Strapi Image Validation** addresses this by allowing image requirements to be configured directly on individual Media fields.

## How It Works

The plugin validates images using two criteria:

- **Aspect Ratio** — defines the expected shape of the image.
- **Minimum Width** — defines the minimum width, in pixels, required for the image.

For example:

```text
Aspect Ratio: 16:9
Minimum Width: 2048px
```

An image must satisfy both requirements to match this rule.

The following image would be valid:

```text
2048 × 1152
```

A larger image with the same aspect ratio would also be valid:

```text
2560 × 1440
3840 × 2160
```

## Why Aspect Ratio and Minimum Width?

Requiring an exact image width and height can be unnecessarily restrictive.

For example, all of the following images have a `16:9` aspect ratio:

```text
1920 × 1080
2048 × 1152
2560 × 1440
3840 × 2160
```

Instead of requiring one exact dimension, the plugin separates the requirements into:

```text
Image Shape
    ↓
Aspect Ratio

Image Resolution
    ↓
Minimum Width
```

This allows higher-resolution images to be used while ensuring that the image maintains the correct shape and has sufficient resolution.

For example:

```text
Aspect Ratio: 16:9
Minimum Width: 2048px
```

The following images are valid:

```text
2048 × 1152   ✓
2560 × 1440   ✓
3840 × 2160   ✓
```

The following image is invalid:

```text
1920 × 1080   ✗
```

Although it has the correct aspect ratio, its width is below the required minimum.

## Features

- Validate images in Strapi Media fields.
- Configure validation rules per Media field.
- Validate image aspect ratios.
- Define a minimum width for each validation rule.
- Support multiple aspect ratio and width combinations for a single field.
- Allow different Media fields to have different image requirements.
- Provide image requirements directly in the Content-Type Builder.
- Support flexible image resolutions while maintaining the required image shape.

## Installation

Install the plugin in your Strapi project:

```bash
npm install strapi-plugin-image-validation
```

After installation, rebuild the Strapi admin panel:

```bash
npm run build
```

Then start Strapi:

```bash
npm run develop
```

The plugin is registered in Strapi using the plugin name:

```text
image-validation
```

## Compatibility

This plugin supports:

```text
Strapi: ^5.31.3
Node.js types: ^20
```

The plugin is built for Strapi v5.

## Configuration

Image validation can be configured for individual Media fields from the Strapi Content-Type Builder.

Navigate to:

```text
Content-Type Builder
    → Select a Content Type
        → Select a Media Field
            → Advanced Settings
                → Image Validation
```

The **Image Validation** section allows validation rules to be added to the Media field.

Each rule contains:

| Property      | Description                                     |
| ------------- | ----------------------------------------------- |
| Aspect Ratio  | The required width-to-height ratio of the image |
| Minimum Width | The minimum width of the image in pixels        |

## Validation Rule Structure

The validation configuration is stored as part of the Media field configuration.

Example:

```json
{
  "imageValidation": {
    "rules": [
      {
        "aspectRatio": {
          "width": 16,
          "height": 9
        },
        "minWidth": 2048
      }
    ]
  }
}
```

The configuration above requires an image with:

```text
Aspect Ratio: 16:9
Minimum Width: 2048px
```

## Multiple Validation Rules

A Media field can support multiple valid image formats.

For example:

```json
{
  "imageValidation": {
    "rules": [
      {
        "aspectRatio": {
          "width": 16,
          "height": 9
        },
        "minWidth": 2048
      },
      {
        "aspectRatio": {
          "width": 4,
          "height": 3
        },
        "minWidth": 1600
      },
      {
        "aspectRatio": {
          "width": 1,
          "height": 1
        },
        "minWidth": 1200
      }
    ]
  }
}
```

In this example, the field accepts any image that satisfies **at least one** of the configured rules.

The validation logic can be represented as:

```text
Rule 1
   OR
Rule 2
   OR
Rule 3
```

Within each rule, both conditions must be satisfied:

```text
Aspect Ratio
      AND
Minimum Width
```

For example:

```text
16:9 + minimum width 2048px
```

is one complete validation rule.

## Minimum Width Is Rule-Specific

Minimum width is configured independently for each aspect ratio rule.

For example:

```text
16:9 → Minimum Width: 2048px

4:3 → Minimum Width: 1600px

1:1 → Minimum Width: 1200px
```

This allows each supported image format to have its own resolution requirement.

An image does not need to satisfy the minimum width requirements of every rule. It only needs to satisfy the minimum width associated with the aspect ratio rule it matches.

For example:

```text
Rule 1
16:9
Minimum Width: 2048px

Rule 2
4:3
Minimum Width: 1600px
```

A `4:3` image with a width of `1600px` can pass Rule 2 without needing to meet the `2048px` minimum width defined for Rule 1.

## Aspect Ratio Tolerance

Aspect ratio validation uses a fixed tolerance of:

```text
0.02
```

The tolerance allows small variations when comparing an image's actual aspect ratio with the configured aspect ratio.

For example, an image does not need to match the configured ratio using exact mathematical equality.

The tolerance is fixed and cannot currently be configured.

## Example Validation

Consider the following rule:

```json
{
  "aspectRatio": {
    "width": 16,
    "height": 9
  },
  "minWidth": 2048
}
```

### Valid Image

```text
2048 × 1152
```

✓ Correct aspect ratio
✓ Meets the minimum width requirement

### Valid Higher Resolution Image

```text
3840 × 2160
```

✓ Correct aspect ratio
✓ Exceeds the minimum width requirement

### Invalid: Width Too Small

```text
1920 × 1080
```

✓ Correct aspect ratio
✗ Width is below `2048px`

### Invalid: Incorrect Aspect Ratio

```text
2048 × 1536
```

✓ Meets the minimum width requirement
✗ Does not match the configured `16:9` aspect ratio within the allowed tolerance

## Example Use Cases

### Hero Banner

A hero banner may require a wide, high-resolution image:

```text
Aspect Ratio: 16:9
Minimum Width: 2048px
```

This helps ensure that images used in large sections have sufficient resolution.

### Content Card

A card component may require:

```text
Aspect Ratio: 4:3
Minimum Width: 1600px
```

This ensures consistent image proportions across card layouts.

### Square Image

For square promotional images, tiles, or profile-style content:

```text
Aspect Ratio: 1:1
Minimum Width: 1200px
```

## Validation Behavior

When an image is selected for a Media field with Image Validation configured, the plugin checks the image against the configured validation rules.

An image is considered valid when:

1. Its aspect ratio matches one of the configured aspect ratios within the fixed tolerance of `0.02`.
2. Its width meets or exceeds the `minWidth` configured for that matching rule.

If multiple rules are configured, satisfying any one rule is sufficient.

## Non-Image Media

Image validation is intended for Media fields where images are required or allowed.

The validation is based on image dimensions and therefore applies only to image assets.

For Media fields intended exclusively for images, image validation can be used to ensure that uploaded or selected assets meet the required dimensions.

## Benefits

### For Content Editors

Content editors can see the image requirements directly while configuring content instead of relying on separate documentation or manually testing images on the website.

### For Developers

Image requirements can be configured at the content-model level and kept close to the Media field that uses them.

### For Designers

Aspect ratios provide a clear and reusable way to communicate the expected image shape.

### For Websites

Consistent image requirements can help reduce:

- Unexpected image cropping
- Layout inconsistencies
- Low-resolution images
- Incorrect image selection
- Manual image testing

## Important Notes

Image validation ensures that an image meets the configured aspect ratio and minimum width requirements.

It does not guarantee that an image will always appear correctly in every frontend implementation.

The frontend may still apply:

- Cropping
- `object-fit`
- Responsive image sizing
- Different container dimensions
- Additional transformations

This plugin should therefore be used as a **CMS-level validation layer** to ensure that uploaded or selected images meet the expected baseline requirements.

## Roadmap

Possible future improvements include:

- Maximum width validation
- Minimum and maximum height validation
- Exact dimension validation
- Image file size validation
- Image format validation

## License

```text
MIT
```

## Repository

Add the source repository URL here.

## Issues and Contributions

If you encounter a bug, have a feature request, or would like to contribute, please use the project's repository.

Contributions and feedback are welcome.
