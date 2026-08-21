import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Divider,
  Flex,
  Field,
  NumberInput,
  Tooltip,
  Typography,
} from '@strapi/design-system';
import { WarningCircle } from '@strapi/icons';

type ImageValidationRule = {
  id: string;
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

let nextRuleId = 0;

const MAX_RULES = 10;

const createEmptyRule = (): ImageValidationRule => ({
  id: `rule-${++nextRuleId}-${Math.random().toString(36).slice(2, 9)}`,
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
      id: rule?.id ?? `rule-${Math.random().toString(36).slice(2, 9)}`,
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
  intlLabel,
  description,
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
    if (!error) {
      setLastError(undefined);
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
    if (currentValue.rules.length >= MAX_RULES) {
      return;
    }

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

  const markTouched = useCallback((ruleId: string, field: 'width' | 'height' | 'minWidth') => {
    setTouched((prev) => {
      const key = `${ruleId}-${field}`;
      if (prev[key]) {
        return prev;
      }
      return { ...prev, [key]: true };
    });
  }, []);

  const fieldError = (
    ruleId: string,
    field: 'width' | 'height' | 'minWidth',
    value: number | undefined
  ): string | undefined => {
    if (!touched[`${ruleId}-${field}`]) {
      return undefined;
    }

    if (value === undefined) {
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
        hint={
          description?.defaultMessage ??
          description?.id ??
          'Define the aspect ratio and minimum width required for uploaded images.'
        }
      >
        <Field.Label variant="omega" fontWeight="regular">
          {intlLabel?.defaultMessage ?? intlLabel?.id ?? 'Image Validation'}
        </Field.Label>
        <Typography variant="pi" textColor="neutral400">
          Define the required aspect ratio and minimum width for images
        </Typography>

        <Box paddingTop={2}>
          {currentValue.rules.length === 0 ? (
            <Box padding={2} background="neutral100" borderRadius="4px">
              <Typography textColor="neutral600" variant="pi">
                No image validation rules configured.
              </Typography>
            </Box>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={4}>
              {currentValue.rules.map((rule, index) => (
                <Box key={rule.id} padding={4} background="neutral100" borderRadius="4px">
                  <Flex direction="column" alignItems="stretch" gap={4}>
                    <Flex justifyContent="space-between" alignItems="center">
                      <Typography variant="omega">Rule {index + 1}</Typography>

                      <Button variant="tertiary" size="S" onClick={() => removeRule(index)}>
                        Remove
                      </Button>
                    </Flex>

                    <Flex
                      direction={{ initial: 'row', medium: 'row', large: 'column' }}
                      gap={4}
                      alignItems="start"
                    >
                      {/* Ratio */}
                      <Flex direction="column" gap={1} alignItems="start">
                        <Typography variant="pi" fontWeight="semiBold">
                          Ratio
                        </Typography>

                        <Flex gap={4} alignItems="start">
                          <Box flex="1">
                            <Field.Root
                              error={fieldError(rule.id, 'width', rule?.aspectRatio?.width)}
                            >
                              <NumberInput
                                value={rule?.aspectRatio?.width}
                                min={1}
                                step={1}
                                onValueChange={(width: number | undefined) => {
                                  updateRule(index, {
                                    aspectRatio: {
                                      width: width,
                                    },
                                  });
                                }}
                                onBlur={() => markTouched(rule.id, 'width')}
                                size="S"
                              />
                              <Field.Error />
                            </Field.Root>
                          </Box>

                          <Box flex="1">
                            <Field.Root
                              error={fieldError(rule.id, 'height', rule?.aspectRatio?.height)}
                            >
                              <NumberInput
                                value={rule?.aspectRatio?.height}
                                min={1}
                                step={1}
                                onValueChange={(height: number | undefined) => {
                                  updateRule(index, {
                                    aspectRatio: {
                                      height: height,
                                    },
                                  });
                                }}
                                onBlur={() => markTouched(rule.id, 'height')}
                                size="S"
                              />
                              <Field.Error />
                            </Field.Root>
                          </Box>
                        </Flex>
                      </Flex>

                      {/* Minimum width */}
                      <Box flex="1" width="100%">
                        <Field.Root
                          error={fieldError(rule.id, 'minWidth', rule?.minWidth)}
                          hint="Minimum image width in pixels."
                        >
                          <Field.Label>Minimum Width</Field.Label>

                          <NumberInput
                            value={rule?.minWidth}
                            min={0}
                            step={1}
                            onValueChange={(minWidth: number | undefined) => {
                              updateRule(index, {
                                minWidth: minWidth,
                              });
                            }}
                            onBlur={() => markTouched(rule.id, 'minWidth')}
                            size="S"
                          />
                          <Field.Error />
                        </Field.Root>
                      </Box>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}

          <Box paddingTop={4}>
            <Tooltip
              label={`Maximum number of rules added. You cannot add more than ${MAX_RULES} image validation rules.`}
              open={currentValue.rules.length >= MAX_RULES ? undefined : false}
            >
              <Button
                variant="secondary"
                onClick={addRule}
                disabled={currentValue.rules.length >= MAX_RULES}
              >
                + Add rule
              </Button>
            </Tooltip>
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
