/**
 * Copyright (c) 2026 Tarkashilpa Technologies
 * Licensed under the MIT License.
 */


import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import type { StrapiApp } from '@strapi/strapi/admin';
import { ValidatedMediaField, setNativeMediaField } from './components/ValidatedMediaField';
import ImageValidationInput from './components/ImageValidationInput';
import {
  buildImageValidationSchema,
  type ImageValidationValidator,
} from './utils/imageValidationSchema';

type CTBValidator = ImageValidationValidator;
type CTBFormsAPI = {
  components: {
    inputs: Record<string, unknown>;
    // CTB passes props at runtime so a precise compile-time type is not statically knowable.
    add: (params: { id: string; component: React.ComponentType<any> }) => void;
  };
  extendFields: (
    fields: string[],
    config: {
      validator?: CTBValidator;
      form: {
        advanced: (props: Record<string, unknown>) => Array<Record<string, unknown>>;
        base: (props: Record<string, unknown>) => Array<Record<string, unknown>>;
      };
    }
  ) => void;
};

type ContentTypeBuilderPlugin = {
  apis: {
    forms: CTBFormsAPI;
  };
};

const plugin: StrapiApp['appPlugins'][string] = {
  register(app) {
    // Put a link to this plugin in the left sidebar
    // app.addMenuLink({
    //   to: `plugins/${PLUGIN_ID}`,
    //   icon: PluginIcon,
    //   intlLabel: {
    //     id: `${PLUGIN_ID}.plugin.name`,
    //     defaultMessage: PLUGIN_ID,
    //   },
    //   Component: () => import('./pages/App'),
    //   permissions: [],
    // });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });

    const nativeMediaField = (app as { library?: { fields?: Record<string, React.ComponentType> } })
      .library?.fields?.media;

    if (!nativeMediaField) {
      console.warn(
        "[image-validation] Could not locate Strapi's native media field at app.library.fields.media. " +
          'The media field override was skipped and native behavior is retained; admin-side image validation will not run.'
      );

      return;
    }

    setNativeMediaField(nativeMediaField);

    app.addFields({
      type: 'media',
      Component: ValidatedMediaField as React.ComponentType<{}>,
    });
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(`./translations/${locale}.json`)) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch (error) {
          console.warn(
            `[image-validation] Failed to load translations for locale "${locale}"`,
            error
          );
          return { data: {}, locale };
        }
      })
    );
  },

  bootstrap(app) {
    /*--------------------------- Addition to Advanced Settings ------------------------------- */

    const contentTypeBuilder = app.getPlugin(
      'content-type-builder'
    ) as unknown as ContentTypeBuilderPlugin;

    if (!contentTypeBuilder) {
      console.error('[Image Validation] Content-Type Builder not found');
      return;
    }

    const forms = contentTypeBuilder.apis.forms;

    if (!forms) {
      console.error('[Image Validation] CTB forms API not found');
      return;
    }

    /*
     * Register the custom input that will be rendered by TabForm.
     *
     * The ID must match the `type` used in the Advanced Form item below.
     */
    forms.components.add({
      id: 'image-validation',
      component: ImageValidationInput,
    });

    /*
     * Extend the native Media field.
     *
     * Because there is no `sectionTitle`, Strapi's
     * addItemsToFormSection() adds this item to the existing
     * default Advanced Settings section.
     */
    forms.extendFields(['media'], {
      /*
       * The validation schema lives in `utils/imageValidationSchema.ts`.
       * The Content-Type Builder wraps the validator arguments in a single
       * packed array, so the `{ modifiedData, initialData }` options object
       * (used to read the field's `allowedTypes`) is at `args[0][3]`. The
       * schema builder normalizes this internally.
       */
      validator: (...args) => buildImageValidationSchema(args),

      form: {
        advanced: () => [
          {
            name: 'pluginOptions.imageValidation',
            type: 'image-validation',
            intlLabel: {
              id: 'image-validation.settings',
              defaultMessage: 'Image Validation',
            },
          },
        ],

        base: () => [],
      },
    });
  },
};

export default plugin;
