/**
 * Unit tests for admin/src/utils/validateImage.ts
 *
 * Validates the client-side mirror of the validation logic.  The admin version
 * uses a shared `isValidDimension` helper — these tests ensure the two
 * implementations stay behaviourally identical.
 */

import { validateImage, formatRule } from '../../../../admin/src/utils/validateImage';
import type {
  AspectRatioRule,
  ImageValidationOptions,
} from '../../../../admin/src/utils/validateImage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rule = (
  width: number,
  height: number,
  minWidth: number
): AspectRatioRule => ({
  aspectRatio: { width, height },
  minWidth,
});

const opts = (...rules: AspectRatioRule[]): ImageValidationOptions => ({
  rules,
});

// ---------------------------------------------------------------------------
// validateImage
// ---------------------------------------------------------------------------

describe('validateImage (admin)', () => {
  describe('when validation is absent or empty', () => {
    it('returns valid when validation is undefined', () => {
      const result = validateImage({ width: 100, height: 100 }, undefined);
      expect(result.valid).toBe(true);
    });

    it('returns valid when rules array is empty', () => {
      const result = validateImage({ width: 100, height: 100 }, { rules: [] });
      expect(result.valid).toBe(true);
    });

    it('returns valid when validation has no rules property', () => {
      const result = validateImage(
        { width: 100, height: 100 },
        {} as ImageValidationOptions
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('when file dimensions are invalid', () => {
    const validation = opts(rule(16, 9, 800));

    it.each([
      ['undefined width', undefined, 100],
      ['undefined height', 100, undefined],
      ['null width', null, 100],
      ['null height', 100, null],
      ['zero width', 0, 100],
      ['zero height', 100, 0],
      ['negative width', -100, 100],
      ['negative height', 100, -100],
      ['NaN width', NaN, 100],
      ['NaN height', 100, NaN],
    ])('returns invalid for %s', (_label, width, height) => {
      const result = validateImage(
        { width: width as any, height: height as any },
        validation
      );
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/Unable to determine/i);
    });
  });

  it('returns invalid when asset is null', () => {
    const result = validateImage(null as any, opts(rule(16, 9, 800)));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Unable to determine/i);
  });

  // ---- Exact ratio / tolerance / min width ---------------------------------
  it('accepts perfect 16:9 (1920×1080)', () => {
    expect(validateImage({ width: 1920, height: 1080 }, opts(rule(16, 9, 800))).valid).toBe(true);
  });

  it('accepts perfect 4:3 (1024×768)', () => {
    expect(validateImage({ width: 1024, height: 768 }, opts(rule(4, 3, 800))).valid).toBe(true);
  });

  it('accepts 1:1 square', () => {
    expect(validateImage({ width: 500, height: 500 }, opts(rule(1, 1, 300))).valid).toBe(true);
  });

  it('accepts within 2% tolerance (narrower)', () => {
    expect(validateImage({ width: 1882, height: 1080 }, opts(rule(16, 9, 800))).valid).toBe(true);
  });

  it('rejects outside 2% tolerance', () => {
    const result = validateImage({ width: 1600, height: 1080 }, opts(rule(16, 9, 800)));
    expect(result.valid).toBe(false);
  });

  it('rejects when below min width', () => {
    const result = validateImage({ width: 640, height: 360 }, opts(rule(16, 9, 800)));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/640px wide/i);
  });

  it('rejects when below both matching min widths (exercises reduce callback)', () => {
    const result = validateImage(
      { width: 640, height: 360 },
      opts(rule(16, 9, 2000), rule(16, 9, 1000))
    );
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/1000px/i);
  });

  it('accepts when exactly at min width', () => {
    expect(validateImage({ width: 800, height: 450 }, opts(rule(16, 9, 800))).valid).toBe(true);
  });

  // ---- Multiple rules ------------------------------------------------------
  it('matches second rule when first does not match', () => {
    expect(validateImage({ width: 1024, height: 768 }, opts(rule(16, 9, 800), rule(4, 3, 600))).valid).toBe(true);
  });

  it('rejects when no rules match, listing all options', () => {
    const result = validateImage({ width: 500, height: 500 }, opts(rule(16, 9, 800), rule(4, 3, 600)));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/16:9/);
    expect(result.message).toMatch(/4:3/);
  });

  // ---- Edge cases ----------------------------------------------------------
  it('accepts 8K image', () => {
    expect(validateImage({ width: 7680, height: 4320 }, opts(rule(16, 9, 1000))).valid).toBe(true);
  });

  it('skips rule with NaN aspect ratio', () => {
    const rules = opts(
      { aspectRatio: { width: NaN, height: 9 }, minWidth: 800 },
      rule(4, 3, 600)
    );
    expect(validateImage({ width: 1024, height: 768 }, rules).valid).toBe(true);
  });

  it('skips rule with undefined aspectRatio', () => {
    const rules = opts(
      { aspectRatio: undefined as any, minWidth: 800 },
      rule(4, 3, 600)
    );
    expect(validateImage({ width: 1024, height: 768 }, rules).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatRule
// ---------------------------------------------------------------------------

describe('formatRule (admin)', () => {
  it('formats ratio with min width hint', () => {
    expect(formatRule(rule(16, 9, 800))).toBe('16:9 (min width 800px)');
  });

  it('formats ratio without min width when minWidth is 0', () => {
    expect(formatRule(rule(4, 3, 0))).toBe('4:3');
  });

  it('formats ratio without min width when minWidth is negative', () => {
    expect(formatRule(rule(3, 2, -1))).toBe('3:2');
  });

  it('formats ratio without min width when minWidth is NaN', () => {
    expect(formatRule({ aspectRatio: { width: 1, height: 1 }, minWidth: NaN })).toBe('1:1');
  });

  it('formats unknown ratio for non-number dimensions', () => {
    expect(
      formatRule({ aspectRatio: { width: 'a' as any, height: 'b' as any }, minWidth: 100 })
    ).toBe('unknown (min width 100px)');
  });

  it('formats unknown ratio when aspectRatio is undefined', () => {
    expect(
      formatRule({ aspectRatio: undefined as any, minWidth: 100 })
    ).toBe('unknown (min width 100px)');
  });
});

