/**
 * Jest manual mock for @strapi/strapi.
 *
 * Provides minimal stubs needed by unit tests.  Integration tests use the
 * real Strapi via the dynamic harness in tests/helpers/strapi.ts and are
 * unaffected by this mock (they resolve @strapi/strapi via the real
 * node_modules at runtime).
 */

const mockStrapi: any = {
  // Commonly-used APIs that unit-tested server utilities may call
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  config: {
    get: jest.fn(),
    set: jest.fn(),
  },
  query: jest.fn().mockReturnValue({
    findOne: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),
  service: jest.fn().mockReturnValue({}),
  plugin: jest.fn().mockReturnValue({}),
  entityService: {
    findOne: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  server: {
    httpServer: {},
  },
  db: {
    query: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }),
  },
};

module.exports = mockStrapi;
