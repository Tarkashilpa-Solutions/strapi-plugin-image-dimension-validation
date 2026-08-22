export interface AspectRatio {
  width: number;
  height: number;
}

export interface AspectRatioRule {
  aspectRatio: AspectRatio;
  minWidth: number;
}

export interface AspectRatioValidation {
  rules: AspectRatioRule[];
}

export type ImageValidationOptions = AspectRatioValidation;

export interface ImageValidationResult {
  valid: boolean;
  message?: string;
}

const RATIO_TOLERANCE = 0.02;

const getRatio = (aspectRatio: AspectRatio): number | undefined => {
  const { width, height } = aspectRatio ?? {};

  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }

  return width / height;
};

const formatRatio = (aspectRatio: AspectRatio): string => {
  const { width, height } = aspectRatio ?? {};

  if (typeof width !== 'number' || typeof height !== 'number') {
    return 'unknown';
  }

  return `${width}:${height}`;
};

const formatRule = (rule: AspectRatioRule): string => {
  const width =
    typeof rule.minWidth === 'number' && Number.isFinite(rule.minWidth) && rule.minWidth > 0
      ? ` (min width ${rule.minWidth}px)`
      : '';

  return `${formatRatio(rule.aspectRatio)}${width}`;
};

export const validateImage = (
  file: { width?: number | null; height?: number | null },
  validation?: ImageValidationOptions
): ImageValidationResult => {
  if (!validation) {
    return { valid: true };
  }

  if (
    typeof file?.width !== 'number' ||
    typeof file?.height !== 'number' ||
    !Number.isFinite(file.width) ||
    !Number.isFinite(file.height) ||
    file.width <= 0 ||
    file.height <= 0
  ) {
    return {
      valid: false,
      message: 'Unable to determine the dimensions of the selected image.',
    };
  }

  const { rules } = validation;

  if (!rules?.length) {
    return { valid: true };
  }

  const actualRatio = file.width / file.height;
  const ratioMatchedRules = rules.filter((rule) => {
    const targetRatio = getRatio(rule.aspectRatio);
    return (
      targetRatio !== undefined &&
      typeof rule.minWidth === 'number' &&
      Number.isFinite(rule.minWidth) &&
      rule.minWidth >= 0 &&
      Math.abs(actualRatio - targetRatio) / targetRatio <= RATIO_TOLERANCE
    );
  });

  if (ratioMatchedRules.length === 0) {
    return {
      valid: false,
      message: `Image aspect ratio must be one of: ${rules.map(formatRule).join(' or ')}.`,
    };
  }

  const matchedRule = ratioMatchedRules.some((rule) => file.width >= rule.minWidth);

  if (!matchedRule) {
    const minWidthRule = ratioMatchedRules.reduce((a, b) => (a.minWidth <= b.minWidth ? a : b));
    return {
      valid: false,
      message: `Image is ${file.width}px wide, but the minimum width for ${formatRatio(minWidthRule.aspectRatio)} is ${minWidthRule.minWidth}px.`,
    };
  }

  return { valid: true };
};
