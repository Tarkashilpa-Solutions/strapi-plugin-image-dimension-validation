/**
 * Unit tests for admin/src/utils/imageValidationSchema.ts
 *
 * Validates the yup schema used by Content-Type Builder's advanced settings
 * form.  The schema validates the `imageValidation` plugin option.
 */

import buildImageValidationSchema from '../../../../admin/src/utils/imageValidationSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate what CTB passes to the validator.
 * CTB calls `makeValidator(['attribute', 'media'], shape, usedNames, reserved,
 * takenTargetAttrs, { modifiedData, initialData })`.
 *
 * The schema builder expects the packed-args array and extracts
 * `args[0][3]` for the attribute data.
 */
const callValidator = (
  value: unknown,
  attributeData?: {
    modifiedData?: { allowedTypes?: string[] };
    initialData?: { allowedTypes?: string[] };
  }
): Promise<any> => {
  // buildImageValidationSchema expects args from CTB's makeValidator.
  // CTB wraps arguments: makeValidator(['attribute', 'media'], shape,
  //   usedNames, reserved, takenTargetAttrs, { modifiedData, initialData })
  //
  // The schema reads: const optionsArray = Array.isArray(args[0]) ? args[0] : args;
  //                    const attributeData = optionsArray[3];
  //
  // So we pack everything into a single array as args[0], with the
  // { modifiedData, initialData } at index 3.
  const fullPacked = [
    ['attribute', 'media'],
    {},          // [1] shape
    [],          // [2] usedNames
    (attributeData ?? {}) as any, // [3] ← attributeData here
    [],          // [4] takenTargetAttrs
    {},          // [5] reserved
  ];

  // When called via (...args) => buildImageValidationSchema(args),
  // args = [fullPacked], so args[0] = fullPacked.
  const schema = buildImageValidationSchema([fullPacked]);
  return schema.imageValidation.validate(value, { abortEarly: false });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('imageValidationSchema', () => {
  // ---- Optional / empty ----------------------------------------------------
  describe('when no rules are configured', () => {
    it('accepts undefined (yup casts to empty object)', async () => {
      await expect(
        callValidator(undefined, {
          modifiedData: { allowedTypes: ['images'] },
        })
      ).resolves.toEqual({});
    });

    it('rejects null (yup object schema is not nullable)', async () => {
      await expect(
        callValidator(null, {
          modifiedData: { allowedTypes: ['images'] },
        })
      ).rejects.toThrow();
    });

    it('accepts an empty rules array', async () => {
      await expect(
        callValidator(
          { rules: [] },
          { modifiedData: { allowedTypes: ['images'] } }
        )
      ).resolves.toEqual({ rules: [] });
    });
  });

  // ---- Valid single / multiple rules ---------------------------------------
  it('accepts a complete valid rule (16:9, minWidth 800)', async () => {
    const value = {
      rules: [
        { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
      ],
    };

    await expect(
      callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
    ).resolves.toEqual(value);
  });

  it('accepts multiple valid rules', async () => {
    const value = {
      rules: [
        { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
        { aspectRatio: { width: 4, height: 3 }, minWidth: 600 },
        { aspectRatio: { width: 1, height: 1 }, minWidth: 300 },
      ],
    };

    await expect(
      callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
    ).resolves.toEqual(value);
  });

  // ---- Required fields -----------------------------------------------------
  describe('required fields', () => {
    it('rejects when aspectRatio.width is missing', async () => {
      const value = {
        rules: [{ aspectRatio: { height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/requires an aspect ratio width, height, and a minimum width/i);
    });

    it('rejects when aspectRatio.height is missing', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/requires an aspect ratio width, height, and a minimum width/i);
    });

    it('rejects when minWidth is missing', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 } }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/requires an aspect ratio width, height, and a minimum width/i);
    });
  });

  // ---- Positive values -----------------------------------------------------
  describe('positive value constraints', () => {
    it('rejects zero width in aspect ratio', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 0, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/must both be greater than zero/i);
    });

    it('rejects zero height in aspect ratio', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 0 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/must both be greater than zero/i);
    });

    it('allows zero in minWidth (meaning no minimum)', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: 0 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).resolves.toEqual(value);
    });
  });

  // ---- Non-negative constraint ---------------------------------------------
  describe('non-negative constraint', () => {
    it('rejects negative width', async () => {
      const value = {
        rules: [{ aspectRatio: { width: -16, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow();
    });

    it('rejects negative height', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: -9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow();
    });

    it('rejects negative minWidth', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: -100 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/cannot be negative/i);
    });
  });
  // ---- Duplicate ratio detection -------------------------------------------
  describe('duplicate ratio detection', () => {
    it('rejects duplicate ratios (exact same values)', async () => {
      const value = {
        rules: [
          { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
          { aspectRatio: { width: 16, height: 9 }, minWidth: 600 },
        ],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/must only be used once/i);
    });

    it('rejects equivalent ratios (32:18 normalizes to 16:9)', async () => {
      const value = {
        rules: [
          { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
          { aspectRatio: { width: 32, height: 18 }, minWidth: 800 },
        ],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/must only be used once/i);
    });

    it('rejects equivalent ratios (1920:1080 = 16:9 after normalization)', async () => {
      const value = {
        rules: [
          { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
          { aspectRatio: { width: 1920, height: 1080 }, minWidth: 800 },
        ],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow(/must only be used once/i);
    });

    it('rejects duplicate 0:0 ratios (both width and height are zero)', async () => {
      const value = {
        rules: [
          { aspectRatio: { width: 0, height: 0 }, minWidth: 100 },
          { aspectRatio: { width: 0, height: 0 }, minWidth: 200 },
        ],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).rejects.toThrow();
    });

    it('accepts different normalized ratios (16:9 and 4:3)', async () => {
      const value = {
        rules: [
          { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
          { aspectRatio: { width: 4, height: 3 }, minWidth: 800 },
        ],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).resolves.toEqual(value);
    });
  });

  // ---- allowedTypes constraint ---------------------------------------------
  describe('allowedTypes constraint', () => {
    it('rejects when allowedTypes does not include "images"', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['videos'] } })
      ).rejects.toThrow(/allow images/i);
    });

    it('rejects when allowedTypes is undefined', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: {} })
      ).rejects.toThrow(/allow images/i);
    });

    it('accepts when "images" is in allowedTypes with other types', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, {
          modifiedData: { allowedTypes: ['images', 'videos', 'files'] },
        })
      ).resolves.toEqual(value);
    });

    it('accepts when allowedTypes is only ["images"]', async () => {
      const value = {
        rules: [{ aspectRatio: { width: 16, height: 9 }, minWidth: 800 }],
      };
      await expect(
        callValidator(value, { modifiedData: { allowedTypes: ['images'] } })
      ).resolves.toEqual(value);
    });

    it('does not enforce allowedTypes when no rules are configured', async () => {
      await expect(
        callValidator(undefined, { modifiedData: { allowedTypes: ['videos'] } })
      ).resolves.toEqual({});
    });
  });

  // ---- Close describe ------------------------------------------------------
});

