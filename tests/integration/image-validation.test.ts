/**
 * Integration tests for the image-validation plugin.
 * Boots a real Strapi instance and validates the create/update pipeline.
 * Run: npm run test:integration
 */

import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import type { ContentTypeDef } from '../helpers/strapi';
import request from 'supertest';
import {
  valid16x9,
  valid4x3,
  invalidSquare,
  validRatioSmallWidth,
} from '../fixtures/generate-test-images';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const testContentTypeDef: ContentTypeDef = {
  singularName: 'test-item',
  pluralName: 'test-items',
  displayName: 'TestItem',
  options: { draftAndPublish: true },
  attributes: {
    validatedMedia: {
      type: 'media',
      multiple: false,
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
};

describe('Image Validation Plugin — Integration', () => {
  let adminJwt: string;
  const testContentType = 'api::test-item.test-item';

  beforeAll(async () => {
    const result = await setupStrapi([testContentTypeDef]);
    adminJwt = result.adminJwt;
  }, 36_0000);

  afterAll(async () => {
    await cleanupStrapi();
  }, 15_000);

  // ---- Helpers ----

  /** Returns the live Strapi instance, verifying the server is listening. */
  function getStrapi(): any {
    const strapi = (global as any).strapi;
    if (!strapi) {
      throw new Error('[test] strapi instance missing from global');
    }
    const httpServer = strapi.server?.httpServer;
    if (!httpServer || !httpServer.listening) {
      throw new Error('[test] strapi HTTP server is not listening');
    }
    return strapi;
  }

  // ---- Grant permissions for the content type ----
  // Content-type permissions must be explicitly assigned so the admin
  // RBAC middleware allows requests to the Content Manager API.
  beforeAll(async () => {
    const strapi = getStrapi();

    const superAdminRole = await strapi.service('admin::role').getSuperAdmin();

    const actions = [
      'plugin::content-manager.explorer.create',
      'plugin::content-manager.explorer.read',
      'plugin::content-manager.explorer.update',
      'plugin::content-manager.explorer.delete',
      'plugin::content-manager.explorer.publish',
      'plugin::content-manager.collection-types.configure-view',
    ];

    const permissions = actions.map((action) => ({
      action,
      subject: testContentType,
      properties: {},
      conditions: [],
      actionParameters: {},
      role: superAdminRole.id,
    }));

    await strapi.service('admin::permission').createMany(permissions);
  }, 15_000);

  // ---- Upload test images ----
  let validImageId: number;
  let altValidImageId: number;
  let invalidImageId: number;
  let smallImageId: number;

  beforeAll(async () => {
    const strapi = getStrapi();

    const uploadImage = async (name: string, buffer: Buffer): Promise<number> => {
      const res = await request(strapi.server.httpServer)
        .post('/upload')
        .set('Authorization', `Bearer ${adminJwt}`)
        .attach('files', buffer, name);
      const body = res.body;

      // Strapi v5 upload response can vary. Try known shapes.
      if (Array.isArray(body)) {
        return body[0]?.id ?? body[0]?.attributes?.id ?? 0;
      }
      if (body?.data) {
        const file = Array.isArray(body.data) ? body.data[0] : body.data;
        return file?.id ?? file?.attributes?.id ?? 0;
      }
      const id = body?.id ?? body?.attributes?.id ?? 0;
      if (id === 0) {
        throw new Error(
          `[test] Could not extract file ID from upload response (status ${res.status}): ${JSON.stringify(body)}`
        );
      }
      return id;
    };

    validImageId = await uploadImage('valid-16x9.png', valid16x9());
    await sleep(500);

    altValidImageId = await uploadImage('valid-4x3.png', valid4x3());
    await sleep(500);

    invalidImageId = await uploadImage('invalid-square.png', invalidSquare());
    await sleep(500);

    smallImageId = await uploadImage('small-16x9.png', validRatioSmallWidth());
  }, 60_000);

  // ---- Final server probe ----
  beforeAll(async () => {
    const strapi = getStrapi();
    await request(strapi.server.httpServer)
      .get('/_health')
      .set('Authorization', `Bearer ${adminJwt}`)
      .ok(() => true);
  }, 10_000);

  // ---- Derived helpers ----
  function apiPath(): string {
    return `/content-manager/collection-types/${testContentType}`;
  }

  // ---- Test Cases ----

  describe('content creation with validated media field', () => {
    it('should accept a valid 16:9 image meeting min width', async () => {
      const strapi = getStrapi();
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ validatedMedia: [validImageId] });

      expect([200, 201]).toContain(res.status);
    });

    it('should accept a valid 4:3 image matching second rule', async () => {
      const strapi = getStrapi();
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ validatedMedia: [altValidImageId] });

      expect([200, 201]).toContain(res.status);
    });

    it('should reject an image with wrong aspect ratio (square)', async () => {
      const strapi = getStrapi();
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ validatedMedia: [invalidImageId] });

      expect(res.status).toBe(400);
    });

    it('should reject an image matching ratio but below min width', async () => {
      const strapi = getStrapi();
      const res = await request(strapi.server.httpServer)
        .post(apiPath())
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({ validatedMedia: [smallImageId] });

      expect(res.status).toBe(400);
    });
  });
});
