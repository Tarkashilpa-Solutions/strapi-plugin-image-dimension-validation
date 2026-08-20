import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Divider,
  Flex,
  Field,
  NumberInput,
  Typography,
} from '@strapi/design-system';
import { WarningCircle } from '@strapi/icons';

type ImageValidationRule = {
  aspectRatio: {
    width?: number;
    height?: number;
  };
  minWidth?: number;
};

type ImageValidationValue = {
  rules: ImageValidationRule[];
};

type ImageValidationInputProps = {
  name: string;
  value?: ImageValidationValue | null;
  onChange: (event: {
    target: {
      name: string;
      value: ImageValidationValue;
    };
  }) => void;
  error?: string;
  intlLabel?: {
    id?: string;
    defaultMessage?: string;
  };
  description?: {
    id?: string;
    defaultMessage?: string;
  };
};

const createEmptyRule = (): ImageValidationRule => ({
  aspectRatio: {
    width: undefined,
    height: undefined,
  },
  minWidth: undefined,
});

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeValue = (value?: ImageValidationValue | null): ImageValidationValue => {
  if (!value || !Array.isArray(value.rules)) {
    return {
      rules: [],
    };
  }

  return {
    rules: value.rules.map((rule) => ({
      aspectRatio: {
        width: toOptionalNumber(rule?.aspectRatio?.width),
        height: toOptionalNumber(rule?.aspectRatio?.height),
      },
      minWidth: toOptionalNumber(rule?.minWidth),
    })),
  };
};

const ImageValidationInput: React.FC<ImageValidationInputProps> = ({
  name,
  value,
  onChange,
  error,
}) => {
  const currentValue = useMemo(() => normalizeValue(value), [value]);

  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();

  // Show an error popup whenever the Content-Type Builder form validation fails
  // (the `error` prop is set). It only re-opens when a *new* error message
  // arrives, so dismissing it won't trigger an immediate popup loop for the
  // same message.
  useEffect(() => {
    if (error && error !== lastError) {
      setLastError(error);
      setIsErrorDialogOpen(true);
    }
  }, [error, lastError]);

  const errorMessage = Array.isArray(error) ? error.join(' ') : error;

  const updateValue = useCallback(
    (nextValue: ImageValidationValue) => {
      onChange({
        target: {
          name,
          value: nextValue,
        },
      });
    },
    [name, onChange]
  );

  const updateRule = useCallback(
    (
      index: number,
      changes: Partial<Omit<ImageValidationRule, 'aspectRatio'>> & {
        aspectRatio?: Partial<ImageValidationRule['aspectRatio']>;
      }
    ) => {
      const nextRules = currentValue.rules.map((rule, ruleIndex) => {
        if (ruleIndex !== index) {
          return rule;
        }

        return {
          ...rule,
          ...changes,
          aspectRatio: {
            ...rule.aspectRatio,
            ...changes.aspectRatio,
          },
        };
      });

      updateValue({
        rules: nextRules,
      });
    },
    [currentValue.rules, updateValue]
  );

  const addRule = useCallback(() => {
    updateValue({
      rules: [...currentValue.rules, createEmptyRule()],
    });
  }, [currentValue.rules, updateValue]);

  const removeRule = useCallback(
    (index: number) => {
      updateValue({
        rules: currentValue.rules.filter((_, ruleIndex) => ruleIndex !== index),
      });
    },
    [currentValue.rules, updateValue]
  );

  // Tracks which individual fields the user has interacted with (blurred). A
  // required-error is only shown for a field after it has been touched, so a
  // freshly added (blank) rule doesn't immediately light up with errors.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((index: number, field: 'width' | 'height' | 'minWidth') => {
    setTouched((prev) => {
      const key = `${index}-${field}`;
      if (prev[key]) {
        return prev;
      }
      return { ...prev, [key]: true };
    });
  }, []);

  const fieldError = (
    index: number,
    field: 'width' | 'height' | 'minWidth',
    value: number | undefined
  ): string | undefined => {
    if (!touched[`${index}-${field}`]) {
      return undefined;
    }

    if (value === undefined || value === null) {
      return 'This field is required.';
    }

    if (!Number.isFinite(Number(value))) {
      return 'Must be a valid number.';
    }

    return undefined;
  };

  return (
    <>
      <Field.Root
        name={name}
        error={error}
        hint="Define the aspect ratio and minimum width required for uploaded images."
      >
        <Field.Label>Image Validation</Field.Label>

        <Box paddingTop={2}>
          {currentValue.rules.length === 0 ? (
            <Box padding={4} background="neutral100" borderRadius="4px">
              <Typography textColor="neutral600">No image validation rules configured.</Typography>
            </Box>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={4}>
              {currentValue.rules.map((rule, index) => (
                <Box key={index} padding={4} background="neutral100" borderRadius="4px">
                  <Flex direction="column" alignItems="stretch" gap={4}>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography variant="delta">Rule {index + 1}</Typography>

                      <Button variant="tertiary" size="S" onClick={() => removeRule(index)}>
                        Remove
                      </Button>
                    </Flex>

                    <Divider />

                    {/* Ratio */}
                    <Box>
                      <Typography variant="pi" fontWeight="semiBold">
                        Ratio
                      </Typography>

                      <Flex gap={4} paddingTop={2} alignItems="start">
                        <Box flex="1">
                          <Field.Root error={fieldError(index, 'width', rule?.aspectRatio?.width)}>
                            <Field.Label>W</Field.Label>

                            <NumberInput
                              value={rule?.aspectRatio?.width ? rule.aspectRatio.width : 'NaN'}
                              min={1}
                              step={1}
                              onValueChange={(width: number | undefined) => {
                                updateRule(index, {
                                  aspectRatio: {
                                    width: width,
                                  },
                                });
                              }}
                              onBlur={() => markTouched(index, 'width')}
                            />
                            <Field.Error />
                          </Field.Root>
                        </Box>

                        <Box flex="1">
                          <Field.Root
                            error={fieldError(index, 'height', rule?.aspectRatio?.height)}
                          >
                            <Field.Label>H</Field.Label>

                            <NumberInput
                              value={rule?.aspectRatio?.height ? rule.aspectRatio.height : 'NaN'}
                              min={1}
                              step={1}
                              onValueChange={(height: number | undefined) => {
                                updateRule(index, {
                                  aspectRatio: {
                                    height: height,
                                  },
                                });
                              }}
                              onBlur={() => markTouched(index, 'height')}
                            />
                            <Field.Error />
                          </Field.Root>
                        </Box>
                      </Flex>
                    </Box>

                    {/* Minimum width */}
                    <Field.Root error={fieldError(index, 'minWidth', rule?.minWidth)}>
                      <Field.Label>Minimum Width</Field.Label>

                      <NumberInput
                        value={rule?.minWidth ? rule.minWidth : 'NaN'}
                        min={0}
                        step={1}
                        onValueChange={(minWidth: number | undefined) => {
                          updateRule(index, {
                            minWidth: minWidth,
                          });
                        }}
                        onBlur={() => markTouched(index, 'minWidth')}
                      />

                      <Field.Hint>Minimum image width in pixels.</Field.Hint>
                      <Field.Error />
                    </Field.Root>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}

          <Box paddingTop={4}>
            <Button variant="secondary" onClick={addRule}>
              + Add rule
            </Button>
          </Box>
        </Box>

        <Field.Error />
      </Field.Root>

      <Dialog.Root open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>Image Validation Error</Dialog.Header>

          <Dialog.Body icon={<WarningCircle fill="danger600" />}>
            <Dialog.Description>
              {errorMessage ||
                'The configured image validation rules are invalid. Please review the fields highlighted in red.'}
            </Dialog.Description>
          </Dialog.Body>

          <Dialog.Footer>
            <Button onClick={() => setIsErrorDialogOpen(false)}>Close</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};

export default ImageValidationInput;
