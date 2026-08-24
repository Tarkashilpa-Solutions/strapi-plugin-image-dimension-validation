/**
 * Unit tests for server/src/utils/validate-image.ts
 *
 * Tests the pure validation logic — no Strapi dependency needed.
 * Run locally: npm run test:unit
 */

import { validateImage } from '../../../../server/src/utils/validate-image';
import type {
  AspectRatioRule,
  ImageValidationOptions,
} from '../../../../server/src/utils/validate-image';

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

describe('validateImage (server)', () => {
  // ---- No / empty validation -----------------------------------------------
  describe('when validation is absent or empty', () => {
    it('returns valid when validation is undefined', () => {
      const result = validateImage({ width: 100, height: 100 }, undefined);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns valid when rules array is empty', () => {
      const result = validateImage({ width: 100, height: 100 }, { rules: [] });
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns valid when validation has no rules property', () => {
      const result = validateImage(
        { width: 100, height: 100 },
        {} as ImageValidationOptions
      );
      expect(result.valid).toBe(true);
    });
  });

  // ---- Invalid file dimensions ---------------------------------------------
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
      ['Infinity width', Infinity, 100],
      ['Infinity height', 100, Infinity],
    ])('returns invalid for %s', (_label, width, height) => {
      const result = validateImage(
        { width: width as any, height: height as any },
        validation
      );
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/Unable to determine/i);
    });

    it('returns invalid when both dimensions are missing', () => {
      const result = validateImage({}, validation);
      expect(result.valid).toBe(false);
    });
  });

  describe('exact aspect ratio match', () => {
    it('accepts a perfect 16:9 image', () => {
      const result = validateImage(
        { width: 1920, height: 1080 },
        opts(rule(16, 9, 800))
      );
      expect(result.valid).toBe(true);
    });

    it('accepts a perfect 4:3 image', () => {
      const result = validateImage(
        { width: 1024, height: 768 },
        opts(rule(4, 3, 800))
      );
      expect(result.valid).toBe(true);
    });

    it('accepts a perfect 1:1 square image', () => {
      const result = validateImage(
        { width: 500, height: 500 },
        opts(rule(1, 1, 300))
      );
      expect(result.valid).toBe(true);
    });

    it('accepts non-standard ratio 3:2', () => {
      const result = validateImage(
        { width: 1500, height: 1000 },
        opts(rule(3, 2, 500))
      );
      expect(result.valid).toBe(true);
    });
  });

  // ---- Tolerance (within ±2%) ----------------------------------------------
  describe('aspect ratio within 2% tolerance', () => {
    const validation = opts(rule(16, 9, 800));

    it('accepts slightly narrower image (within tolerance)', () => {
      // 1882 / 1080 ≈ 1.7426; 16/9 ≈ 1.7778; diff ≈ 1.98%
      const result = validateImage({ width: 1882, height: 1080 }, validation);
      expect(result.valid).toBe(true);
    });

    it('accepts slightly wider image (within tolerance)', () => {
      const result = validateImage({ width: 1958, height: 1080 }, validation);
      expect(result.valid).toBe(true);
    });

    it('rejects image outside tolerance (too narrow)', () => {
      const result = validateImage({ width: 1600, height: 1080 }, validation);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/must be one of/i);
    });

    it('rejects image outside tolerance (too wide)', () => {
      const result = validateImage({ width: 2500, height: 1080 }, validation);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/must be one of/i);
    });
  });

  // ---- Minimum width -------------------------------------------------------
  describe('minimum width enforcement', () => {
    it('accepts image at exactly the minimum width', () => {
      const result = validateImage(
        { width: 800, height: 450 },
        opts(rule(16, 9, 800))
      );
      expect(result.valid).toBe(true);
    });

    it('accepts image above the minimum width', () => {
      const result = validateImage(
        { width: 1600, height: 900 },
        opts(rule(16, 9, 800))
      );
      expect(result.valid).toBe(true);
    });

    it('rejects image below the minimum width with explicit message', () => {
      const result = validateImage(
        { width: 640, height: 360 },
        opts(rule(16, 9, 800))
      );
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/is 640px wide/i);
      expect(result.message).toMatch(/minimum width for 16:9 is 800px/i);
    });

    it('rejects image below min width even with perfect ratio', () => {
      const result = validateImage(
        { width: 320, height: 180 },
        opts(rule(16, 9, 500))
      );
      expect(result.valid).toBe(false);
    });

    it('accepts image when minWidth is 0 (any width allowed)', () => {
      const result = validateImage(
        { width: 1, height: 1 },
        opts(rule(1, 1, 0))
      );
      expect(result.valid).toBe(true);
    });
  });

  // ---- Multiple rules ------------------------------------------------------
  describe('multiple aspect ratio rules', () => {
    const validation = opts(rule(16, 9, 800), rule(4, 3, 600));

    it('accepts image matching the first rule', () => {
      const result = validateImage({ width: 1920, height: 1080 }, validation);
      expect(result.valid).toBe(true);
    });

    it('accepts image matching the second rule', () => {
      const result = validateImage({ width: 1024, height: 768 }, validation);
      expect(result.valid).toBe(true);
    });

    it('rejects image matching neither rule', () => {
      const result = validateImage({ width: 500, height: 500 }, validation);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/must be one of:/i);
      expect(result.message).toMatch(/16:9/);
      expect(result.message).toMatch(/4:3/);
    });

    it('picks the lower minWidth when two rules match ratio but image is below both', () => {
      const rules = opts(rule(16, 9, 2000), rule(16, 9, 1000));
      const result = validateImage({ width: 960, height: 540 }, rules);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/1000px/i);
    });

    it('accepts when one of two matching ratio rules has satisfied minWidth', () => {
      const rules = opts(rule(16, 9, 2000), rule(16, 9, 800));
      const result = validateImage({ width: 960, height: 540 }, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ---- Edge cases for rule validation --------------------------------------
  describe('edge cases in rule definitions', () => {
    it('skips rules with invalid aspect ratio (NaN)', () => {
      const validation = opts(
        { aspectRatio: { width: NaN, height: 9 }, minWidth: 800 },
        rule(4, 3, 600)
      );
      const result = validateImage({ width: 1024, height: 768 }, validation);
      expect(result.valid).toBe(true);
    });

    it('skips rules with zero aspect ratio dimension', () => {
      const validation = opts(
        { aspectRatio: { width: 0, height: 9 }, minWidth: 800 },
        rule(4, 3, 600)
      );
      const result = validateImage({ width: 1024, height: 768 }, validation);
      expect(result.valid).toBe(true);
    });

    it('skips rules with non-finite minWidth', () => {
      const validation = opts(
        { aspectRatio: { width: 16, height: 9 }, minWidth: NaN },
        rule(4, 3, 600)
      );
      const result = validateImage({ width: 1024, height: 768 }, validation);
      expect(result.valid).toBe(true);
    });
  });

  // ---- Error message content -----------------------------------------------
  describe('error message formatting', () => {
    it('includes all rule descriptions in the rejection message', () => {
      const validation = opts(rule(16, 9, 800), rule(4, 3, 600));
      const result = validateImage({ width: 100, height: 100 }, validation);
      expect(result.message).toMatch(/16:9/);
      expect(result.message).toMatch(/4:3/);
    });

    it('includes min width hint for rules that have one', () => {
      const validation = opts(rule(16, 9, 800));
      const result = validateImage({ width: 100, height: 100 }, validation);
      expect(result.message).toMatch(/min width 800px/);
    });

    it('reports the actual image width in min-width violation', () => {
      const result = validateImage(
        { width: 400, height: 300 },
        opts(rule(4, 3, 800))
      );
      expect(result.message).toMatch(/400px wide/i);
    });
  });

  // ---- Large images --------------------------------------------------------
  describe('large images', () => {
    it('accepts 4K image with correct ratio', () => {
      const result = validateImage(
        { width: 3840, height: 2160 },
        opts(rule(16, 9, 1000))
      );
      expect(result.valid).toBe(true);
    });

    it('accepts 8K image with correct ratio', () => {
      const result = validateImage(
        { width: 7680, height: 4320 },
        opts(rule(16, 9, 1000))
      );
      expect(result.valid).toBe(true);
    });
  });
});
