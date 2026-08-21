import * as yup from 'yup';

/**
 * Shape returned by the Content-Type Builder's `extendFields` validator.
 *
 * The schema keys must match the `pluginOptions.*` option names used in the
 * advanced form items (e.g. `pluginOptions.imageValidation` ↔ `imageValidation`).
 */
export type ImageValidationValidator = (...args: any[]) => Record<string, yup.AnySchema>;

type AttributeFormData = {
  modifiedData?: {
    allowedTypes?: string[];
  };
  initialData?: {
    allowedTypes?: string[];
  };
};

type ImageValidationRuleValue = {
  aspectRatio?: {
    width?: number;
    height?: number;
  };
  minWidth?: number;
};

type ImageValidationValue = {
  rules: ImageValidationRuleValue[];
};

/**
 * Whether validation should run at all. The whole configuration is completely
 * optional: validation only kicks in once at least one rule has been added via
 * the "Add rule" button. When `imageValidation` is `undefined`, yup skips the
 * object tests entirely, so media fields without any configuration stay valid.
 */
const hasRules = (value: unknown): value is ImageValidationValue =>
  Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as ImageValidationValue).rules) &&
    (value as ImageValidationValue).rules.length > 0
  );

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Whether a value is an actual, present finite number. Used for required-field
 * checks so that a missing field (undefined) is rejected while an explicit `0`
 * is still treated as "filled in".
 */
const isPresentNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value);

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x;
};

/**
 * Normalizes an aspect ratio to its lowest terms so that equivalent ratios
 * compare equal (e.g. 16:9, 32:18 and 1920:1080 all become "16:9").
 */
const aspectRatioKey = (width: number, height: number): string => {
  if (width === 0 && height === 0) {
    return '0:0';
  }
  if (width === 0) {
    return '0:1';
  }
  if (height === 0) {
    return '1:0';
  }
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

/**
 * Builds the `imageValidation` yup schema for the Content-Type Builder.
 *
 * IMPORTANT: the Content-Type Builder only displays an error whose yup path
 * exactly matches the form input name (`pluginOptions.imageValidation`). Errors
 * raised on nested fields (e.g. `pluginOptions.imageValidation.rules`) are never
 * forwarded to the custom input. Every check is therefore attached to the
 * `imageValidation` object itself via `.test()`, which produces the error
 * exactly at `pluginOptions.imageValidation`.
 *
 * The validator is invoked by CTB's `makeValidator([...], ...)` as:
 *
 *     makeValidator(['attribute', 'media'], shape, usedNames, reserved,
 *                   takenTargetAttrs, { modifiedData, initialData })
 *the current "Allowed media types" selection) is located at `args[0][3]`.
 *
 * To tolerate both call shapes (packed single-array from CTB, and the flat
 * spread shape historically expected), the extractor below normalizes first.
 */
export const buildImageValidationSchema = (args: any[]): Record<string, yup.AnySchema> => {
  const optionsArray = Array.isArray(args?.[0]) ? args[0] : args;
  const attributeData = optionsArray?.[3] as AttributeFormData | undefined;
  const allowedTypes = attributeData?.modifiedData?.allowedTypes;

  const imageValidation = yup
    .object({
      rules: yup.array().of(
        yup.object({
          aspectRatio: yup.object({
            width: yup.number().required(),
            height: yup.number().required(),
          }),
          minWidth: yup.number().required(),
        })
      ),
    })
    .test(
      'image-validation-required',
      'Every rule requires an aspect ratio width, height, and a minimum width.',
      (value) => {
        if (!hasRules(value)) {
          return true;
        }
        return value.rules.every((rule) => {
          const width = rule?.aspectRatio?.width;
          const height = rule?.aspectRatio?.height;
          const minWidth = rule?.minWidth;
          return isPresentNumber(width) && isPresentNumber(height) && isPresentNumber(minWidth);
        });
      }
    )
    .test(
      'image-validation-ratio-valid',
      'The aspect ratio width and height must both be greater than zero.',
      (value) => {
        if (!hasRules(value)) {
          return true;
        }
        return value.rules.every((rule) => {
          const width = toFiniteNumber(rule?.aspectRatio?.width);
          const height = toFiniteNumber(rule?.aspectRatio?.height);
          return width !== 0 && height !== 0;
        });
      }
    )
    .test('image-validation-non-negative', 'Validation values cannot be negative.', (value) => {
      if (!hasRules(value)) {
        return true;
      }
      return value.rules.every((rule) => {
        const width = toFiniteNumber(rule?.aspectRatio?.width);
        const height = toFiniteNumber(rule?.aspectRatio?.height);
        const minWidth = toFiniteNumber(rule?.minWidth);
        return width >= 0 && height >= 0 && minWidth >= 0;
      });
    })
    .test(
      'image-validation-unique-ratios',
      'Each aspect ratio must only be used once.',
      (value) => {
        if (!hasRules(value)) {
          return true;
        }
        const seen = new Set<string>();
        return value.rules.every((rule) => {
          const key = aspectRatioKey(
            toFiniteNumber(rule?.aspectRatio?.width),
            toFiniteNumber(rule?.aspectRatio?.height)
          );
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      }
    )
    .test(
      'image-validation-allowed-types',
      'Image validation rules require the media field to allow images.',
      (value) => {
        if (!hasRules(value)) {
          return true;
        }
        // Image validation rules require 'images' to be explicitly present
        // in `allowedTypes`.
        return Array.isArray(allowedTypes) && allowedTypes.includes('images');
      }
    );

  return { imageValidation };
};

export default buildImageValidationSchema;
