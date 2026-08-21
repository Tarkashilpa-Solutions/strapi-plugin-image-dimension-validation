import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

import { validateImage, type ImageValidationOptions } from './utils/validate-image';

const extractFileIds = (value: unknown): number[] => {
  if (value == null) {
    return [];
  }

  const entries = Array.isArray(value) ? value : [value];

  return entries
    .flatMap((entry): number | number[] | undefined => {
      if (typeof entry === 'number') return entry;
      if (typeof entry === 'object' && entry !== null) {
        if ('id' in entry) {
          return (entry as { id: number }).id;
        }
        if (Array.isArray((entry as { set?: unknown }).set)) {
          return extractFileIds((entry as { set: unknown }).set);
        }
        if (Array.isArray((entry as { connect?: unknown }).connect)) {
          return extractFileIds((entry as { connect: unknown }).connect);
        }
      }
      return undefined;
    })
    .filter((id): id is number => typeof id === 'number');
};

const allowsImages = (allowedTypes: unknown): boolean =>
  Array.isArray(allowedTypes) && allowedTypes.includes('images');

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.documents.use(async (context, next) => {
    if (context.action !== 'create' && context.action !== 'update') {
      return next();
    }

    const attributes = context.contentType?.attributes ?? {};
    const data = (context.params as { data?: Record<string, unknown> })?.data;

    if (!data) {
      return next();
    }

    const mediaFieldsToValidate = Object.entries(attributes).filter(
      ([fieldName, attribute]: [string, any]) =>
        attribute?.type === 'media' &&
        attribute?.options?.imageValidation &&
        allowsImages(attribute.allowedTypes) &&
        Object.prototype.hasOwnProperty.call(data, fieldName)
    );

    for (const [fieldName, attribute] of mediaFieldsToValidate) {
      const validation: ImageValidationOptions = (attribute as any).options.imageValidation;
      const fileIds = extractFileIds(data[fieldName]);

      if (fileIds.length === 0) {
        continue;
      }

      const files = await strapi.query('plugin::upload.file').findMany({
        where: { id: { $in: fileIds } },
        select: ['id', 'width', 'height'],
      });

      for (const file of files) {
        const result = validateImage(file, validation);

        if (!result.valid) {
          throw new errors.ValidationError(
            `${fieldName}: ${result.message ?? 'The selected image does not meet the required dimensions.'}`
          );
        }
      }
    }

    return next();
  });
};

export default bootstrap;
