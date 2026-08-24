/**
 * Integration tests for the image-validation plugin.
 *
 * Boots a real Strapi instance, configures a content type with image validation
 * rules, uploads test images, and validates the full create/update pipeline.
 *
 * ⚠️  These tests require Linux (Ubuntu).  SQLite in-memory is not available on
 *     Windows due to file-locking.  Run locally via WSL/Docker, or rely on CI.
 *
 * Run: npm run test:integration
 */

import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import request from 'supertest';
import {
  valid16x9,
  valid4x3,
  invalidSquare,
  validRatioSmallWidth,
} from '../fixtures/generate-test-images';

describe('Image Validation Plugin — Integration', () => {
  beforeAll(async () => {
    await setupStrapi();
  }, 60_000);

  afterAll(async () => {
    await cleanupStrapi();
  }, 15_000);

  // ---- Auth helper ---------------------------------------------------------
  let adminJwt: string;

  beforeAll(async () => {
    const strapi = (global as any).strapi;

    const superAdminRole = await strapi.query('admin::role').findOne({
      where: { code: 'strapi-super-admin' },
    });

    await strapi.query('admin::user').create({
      data: {
        firstname: 'Test',
        lastname: 'Admin',
        email: 'test-admin@test.com',
        password: 'TestPass123!',
        roles: [superAdminRole.id],
        isActive: true,
      },
    });

    const res = await request(strapi.server.httpServer)
      .post('/admin/login')
      .send({ email: 'test-admin@test.com', password: 'TestPass123!' });

    adminJwt = res.body?.data?.token || res.body?.token || '';
  }, 30_000);
  // ---- Upload test images --------------------------------------------------
  let validImageId: number;
  let altValidImageId: number;
  let invalidImageId: number;
  let smallImageId: number;

  beforeAll(async () => {
    const strapi = (global as any).strapi;

    const uploadImage = async (name: string, buffer: Buffer): Promise<number> => {
      const res = await request(strapi.server.httpServer)
        .post('/api/upload')
        .set('Authorization', `Bearer ${adminJwt}`)
        .attach('files', buffer, name);
      const body = res.body;
      const file = Array.isArray(body) ? body[0] : body;
      return file?.id ?? file?.data?.id ?? 0;
    };

    validImageId = await uploadImage('valid-16x9.png', valid16x9());
    altValidImageId = await uploadImage('valid-4x3.png', valid4x3());
    invalidImageId = await uploadImage('invalid-square.png', invalidSquare());
    smallImageId = await uploadImage('small-16x9.png', validRatioSmallWidth());
  }, 30_000);

  // ---- Create test content type --------------------------------------------
  let testContentType = 'api::test-item.test-item';

  beforeAll(async () => {
    const strapi = (global as any).strapi;

    const ctBody = {
      contentType: {
        singularName: 'test-item',
        pluralName: 'test-items',
        displayName: 'TestItem',
        attributes: {
          validatedMedia: {
            type: 'media',
            allowedTypes: ['images'],
            pluginOptions: {
              imageValidation: {
                rules: [
                  { aspectRatio: { width: 16, height: 9 }, minWidth: 800 },
                  { aspectRatio: { width: 4, height: 3 }, minWidth: 600 },
                ],
              },
            },
          },
        },
      },
    };

    try {
      const res = await request(strapi.server.httpServer)
        .post('/content-type-builder/content-types')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send(ctBody);
      testContentType = res.body?.data?.uid || testContentType;
    } catch {
      // Content type creation via CTB may fail if API changes
    }
  }, 30_000);

  function apiPath(): string {
    return `/api/${testContentType.replace('api::', '').replace('.', '/')}s`;
  }


  // ==========================================================================
  // Test Cases
  // ==========================================================================

  describe('content creation with validated media field', () => {
    it('should accept a valid 16:9 image meeting min width', async () => {
      const strapi = (global as any).strapi;
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ data: { validatedMedia: validImageId } });

      expect([200, 201]).toContain(res.status);
    });

    it('should accept a valid 4:3 image matching second rule', async () => {
      const strapi = (global as any).strapi;
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ data: { validatedMedia: altValidImageId } });

      expect([200, 201]).toContain(res.status);
    });

    it('should reject an image with wrong aspect ratio (square)', async () => {
      const strapi = (global as any).strapi;
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ data: { validatedMedia: invalidImageId } });

      expect(res.status).toBe(400);
    });

    it('should reject an image matching ratio but below min width', async () => {
      const strapi = (global as any).strapi;
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ data: { validatedMedia: smallImageId } });

      expect(res.status).toBe(400);
    });
  });
});
