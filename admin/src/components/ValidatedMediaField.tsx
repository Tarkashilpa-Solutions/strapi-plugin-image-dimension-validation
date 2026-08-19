import { Box, Typography } from '@strapi/design-system';
import { useField, useNotification } from '@strapi/admin/strapi-admin';
import React from 'react';

import { validateImage, formatRule, type ImageValidationOptions } from '../utils/validateImage';

let NativeMediaField: React.ComponentType<any> | undefined;

export const setNativeMediaField = (component: React.ComponentType<any>) => {
  NativeMediaField = component;
};

let warnedMissingNativeField = false;

const warnMissingNativeField = () => {
  if (warnedMissingNativeField) {
    return;
  }

  warnedMissingNativeField = true;
  console.warn(
    "[image-validation] Could not locate Strapi's native media field, so the media input cannot be rendered. " +
      "Ensure the plugin's register() ran and that app.library.fields.media is exposed by this Strapi version."
  );
};

const MissingNativeFieldNotice = () => (
  <Box padding={2} background="danger100" borderColor="danger500" hasRadius>
    <Typography variant="pi" textColor="danger600">
      Image Validation plugin failed to initialize &mdash; media field unavailable.
    </Typography>
  </Box>
);

const getAspectRatioHint = (validation: ImageValidationOptions | undefined) => {
  if (!validation?.rules?.length) {
    return null;
  }

  const rules = validation.rules.map(formatRule).join(' or ');

  return `Allowed aspect ratios: ${rules}`;
};

const toAssetArray = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
};

export const ValidatedMediaField = (props: any) => {
  const { name, attribute } = props;

  const imageValidation: ImageValidationOptions | undefined =
    attribute?.pluginOptions?.imageValidation;

  // Fields without image-validation rules need no validation, hooks, or wrapper
  // markup.
  if (!imageValidation) {
    if (!NativeMediaField) {
      warnMissingNativeField();

      return <MissingNativeFieldNotice />;
    }

    return <NativeMediaField {...props} />;
  }

  const hint = getAspectRatioHint(imageValidation);

  const { value, onChange } = useField(name);
  const { toggleNotification } = useNotification();

  const lastValidValueRef = React.useRef(value);
  const revertingRef = React.useRef(false);

  React.useEffect(() => {
    if (revertingRef.current) {
      revertingRef.current = false;
      return;
    }

    if (value === lastValidValueRef.current) {
      return;
    }

    const assets = toAssetArray(value);
    const failure = assets
      .map((asset) => validateImage(asset, imageValidation))
      .find((result) => !result.valid);

    if (failure) {
      revertingRef.current = true;
      onChange(name, lastValidValueRef.current);
      toggleNotification({
        type: 'danger',
        timeout: 4000,
        message: failure.message ?? 'The selected image does not meet the required dimensions.',
      });
      return;
    }

    lastValidValueRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!NativeMediaField) {
    warnMissingNativeField();

    return <MissingNativeFieldNotice />;
  }

  return (
    <Box>
      <NativeMediaField {...props} />

      {hint && (
        <Box paddingTop={1}>
          <Typography variant="pi" textColor="neutral600">
            {hint}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
