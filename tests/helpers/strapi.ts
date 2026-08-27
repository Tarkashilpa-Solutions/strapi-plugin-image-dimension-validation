/**
 * Integration test harness — creates a temp Strapi app, installs the plugin,
 * boots the server, and initializes a test admin user for API authentication.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import request from 'supertest';

let strapiInstance: any = null;
let tempDir: string | null = null;

/** Symlink a directory; fall back to a recursive copy (Windows / permission-limited). */
function linkOrCopy(src: string, dest: string, copyFilter?: (name: string) => boolean): void {
  try {
    fs.symlinkSync(src, dest, 'dir');
  } catch {
    fs.cpSync(src, dest, {
      recursive: true,
      filter: copyFilter
        ? (s) => copyFilter(path.basename(s))
        : undefined,
    });
  }
}

/** Content type definition to be written to disk before Strapi boots. */
export interface ContentTypeDef {
  singularName: string;
  pluralName: string;
  displayName: string;
  kind?: string;
  options?: Record<string, unknown>;
  attributes: Record<string, unknown>;
}

/** Write a content-type scaffold under src/api/ so Strapi loads it natively. */
function writeContentType(ct: ContentTypeDef): void {
  const apiDir = path.join(tempDir!, 'src', 'api', ct.singularName);
  const ctDir = path.join(apiDir, 'content-types', ct.singularName);
  fs.mkdirSync(ctDir, { recursive: true });

  // schema.json
  const collectionName = ct.pluralName.replace(/-/g, '_');
  const schema = {
    kind: ct.kind || 'collectionType',
    collectionName,
    info: {
      singularName: ct.singularName,
      pluralName: ct.pluralName,
      displayName: ct.displayName,
    },
    options: ct.options || { draftAndPublish: true },
    pluginOptions: {},
    attributes: ct.attributes,
  };
  fs.writeFileSync(path.join(ctDir, 'schema.json'), JSON.stringify(schema, null, 2));

  // controller stub
  fs.mkdirSync(path.join(apiDir, 'controllers'), { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, 'controllers', `${ct.singularName}.js`),
    `'use strict';\nconst { createCoreController } = require('@strapi/core').factories;\nmodule.exports = createCoreController('api::${ct.singularName}.${ct.singularName}');\n`
  );

  // routes stub
  fs.mkdirSync(path.join(apiDir, 'routes'), { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, 'routes', `${ct.singularName}.js`),
    `'use strict';\nconst { createCoreRouter } = require('@strapi/core').factories;\nmodule.exports = createCoreRouter('api::${ct.singularName}.${ct.singularName}');\n`
  );

  // service stub
  fs.mkdirSync(path.join(apiDir, 'services'), { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, 'services', `${ct.singularName}.js`),
    `'use strict';\nconst { createCoreService } = require('@strapi/core').factories;\nmodule.exports = createCoreService('api::${ct.singularName}.${ct.singularName}');\n`
  );
}

/** Bootstrap a Strapi instance for integration testing. */
export async function setupStrapi(
  contentTypes: ContentTypeDef[] = []
): Promise<{ strapi: any; adminJwt: string }> {
  const pluginRoot = path.resolve(__dirname, '..', '..');

  // Ensure the plugin has been built
  const distServer = path.join(pluginRoot, 'dist', 'server', 'index.js');
  const distAdmin = path.join(pluginRoot, 'dist', 'admin', 'index.js');
  if (!fs.existsSync(distServer) || !fs.existsSync(distAdmin)) {
    throw new Error(`Plugin dist/ not found. Run "npm run build" first.`);
  }

  // Create a minimal Strapi app in a temp directory
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-test-'));
  const srcAdminDir = path.join(tempDir, 'src', 'admin');
  fs.mkdirSync(srcAdminDir, { recursive: true });

  // ---- package.json ----
  const pkgJson = {
    name: 'strapi-test-app',
    private: true,
    version: '0.0.0',
    scripts: { build: 'strapi build', develop: 'strapi develop' },
    dependencies: {
      '@strapi/strapi': '*',
      '@strapi/upload': '*',
      '@strapi/plugin-users-permissions': '*',
      '@tarkashilpa/strapi-plugin-image-dimension-validation': '*',
    },
    strapi: { uuid: 'test-app' },
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // src/admin/app.js
  fs.writeFileSync(
    path.join(srcAdminDir, 'app.js'),
    `export default { config: { locales: ['en'], translations: { en: {} } } };\n`
  );

  // ---- Symlink plugin into node_modules ----
  const nodeModulesDir = path.join(tempDir, 'node_modules');
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  // Link plugin so @tarkashilpa/<name> resolves (satisfies package.json dependency check)
  const pluginDest = path.join(
    nodeModulesDir,
    '@tarkashilpa',
    'strapi-plugin-image-dimension-validation'
  );
  fs.mkdirSync(path.dirname(pluginDest), { recursive: true });
  linkOrCopy(pluginRoot, pluginDest, (name) => name !== '.git' && name !== 'node_modules');

  // Strapi v5's plugin loader scans node_modules/<name>, node_modules/@strapi/plugin-<name>,
  // or node_modules/strapi-plugin-<name>.  It does NOT traverse arbitrary scoped packages
  // like @tarkashilpa/…, so we create an unscoped alias for the strapi.name "image-validation".
  // (The @tarkashilpa/<name> entry in package.json satisfies the dependency validation only.)
  const unscopedDest = path.join(nodeModulesDir, 'image-validation');
  if (!fs.existsSync(unscopedDest)) {
    linkOrCopy(pluginRoot, unscopedDest, (name) => name !== '.git' && name !== 'node_modules');
  }

  // ---- Database configuration ----
  // Strapi v5 requires config/database.js to initialize @strapi/database
  const configDir = path.join(tempDir, 'config');
  fs.mkdirSync(configDir, { recursive: true });

  // SQLite with WAL journal mode — single-connection pool for reliability
  const dbPath = path.join(tempDir, 'data.db').replace(/\\/g, '\\\\');
  fs.writeFileSync(
    path.join(configDir, 'database.js'),
    [
      'module.exports = {',
      '  connection: {',
      "    client: 'sqlite',",
      '    connection: {',
      `      filename: '${dbPath}',`,
      '    },',
      '    useNullAsDefault: true,',
      '    pool: {',
      '      min: 1,',
      '      max: 1,',
      '      afterCreate: (conn, cb) => {',
      "        conn.pragma('journal_mode = WAL');",
      '        cb(null, conn);',
      '      },',
      '    },',
      '  },',
      '};',
      '',
    ].join('\n')
  );

  // ---- Server configuration ----
  // Bind to 127.0.0.1:1337 to avoid IPv6 issues after internal Strapi reloads
  fs.writeFileSync(
    path.join(configDir, 'server.js'),
    [
      'module.exports = {',
      "  host: '127.0.0.1',",
      '  port: 1337,',
      '  app: {',
      "    keys: ['test-key-1', 'test-key-2'],",
      '  },',
      '};',
      '',
    ].join('\n')
  );

  // ---- Plugins configuration ----
  // users-permissions requires jwtSecret; generate a random one
  const jwtSecret = crypto.randomBytes(16).toString('base64');
  fs.writeFileSync(
    path.join(configDir, 'plugins.js'),
    [
      'module.exports = {',
      "  'users-permissions': {",
      '    config: {',
      `      jwtSecret: '${jwtSecret}',`,
      '    },',
      '  },',
      "  'image-validation': {",
      '    enabled: true,',
      '  },',
      '};',
      '',
    ].join('\n')
  );

  // ---- Admin configuration ----
  // Random values for apiToken salt, transfer token salt, auth secret, encryption key
  const apiTokenSalt = crypto.randomBytes(16).toString('base64');
  const transferTokenSalt = crypto.randomBytes(16).toString('base64');
  const authSecret = crypto.randomBytes(16).toString('base64');
  const encryptionKey = crypto.randomBytes(16).toString('base64');
  fs.writeFileSync(
    path.join(configDir, 'admin.js'),
    [
      'module.exports = {',
      '  apiToken: {',
      `    salt: '${apiTokenSalt}',`,
      '  },',
      '  transfer: {',
      '    token: {',
      `      salt: '${transferTokenSalt}',`,
      '    },',
      '  },',
      '  auth: {',
      `    secret: '${authSecret}',`,
      '  },',
      '  secrets: {',
      `    encryptionKey: '${encryptionKey}',`,
      '  },',
      '};',
      '',
    ].join('\n')
  );

  // ---- Uploads directory ----
  // Local upload provider requires public/uploads/ before init
  fs.mkdirSync(path.join(tempDir, 'public', 'uploads'), { recursive: true });

  // Link packages from plugin's own node_modules so all dependencies resolve
  const localNodeModules = path.resolve(pluginRoot, 'node_modules');
  const allEntries = fs.readdirSync(localNodeModules);

  // Scoped packages: link entire scope directories (@strapi/, @types/, etc.)
  const scopedDirs = allEntries.filter(
    (entry) =>
      entry.startsWith('@') && fs.lstatSync(path.join(localNodeModules, entry)).isDirectory()
  );
  for (const scope of scopedDirs) {
    const srcPath = path.join(localNodeModules, scope);
    const destPath = path.join(nodeModulesDir, scope);
    if (fs.existsSync(destPath)) continue;
    linkOrCopy(srcPath, destPath);
  }

  // Unscoped packages: link each top-level dependency, skip dot-files
  const unscopedDirs = allEntries.filter(
    (entry) =>
      !entry.startsWith('.') &&
      !entry.startsWith('@') &&
      fs.lstatSync(path.join(localNodeModules, entry)).isDirectory()
  );
  for (const pkg of unscopedDirs) {
    const srcPath = path.join(localNodeModules, pkg);
    const destPath = path.join(nodeModulesDir, pkg);
    if (fs.existsSync(destPath)) continue;
    linkOrCopy(srcPath, destPath);
  }

  // ---- Bootstrap Strapi ----
  const strapiModulePath = path.join(nodeModulesDir, '@strapi', 'strapi');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const strapiFactory = require(strapiModulePath);

  const appDir = tempDir;
  const strapi = strapiFactory.createStrapi
    ? await strapiFactory.createStrapi({
        appDir,
        distDir: appDir,
        autoReload: false,
        serveAdminPanel: false,
      })
    : await strapiFactory.default({
        appDir,
        distDir: appDir,
        autoReload: false,
        serveAdminPanel: false,
      });

  strapiInstance = strapi;

  // Make strapi available globally for tests
  (global as any).strapi = strapi;

  // Write content-type scaffolds to src/api/ before load
  for (const ct of contentTypes) {
    writeContentType(ct);
  }

  try {
    await strapi.load();
  } catch (err: any) {
    console.error('[setupStrapi] strapi.load() THREW:', err?.message);
    console.error('[setupStrapi] stack:', err?.stack);
    throw err;
  }

  const httpServer = strapi.server?.httpServer;
  if (!httpServer?.listening) {
    await strapi.start();
  }

  // ---- Admin initialization ----
  const adminJwt = await createTestAdmin(strapi);

  return { strapi, adminJwt };
}

/** Create a test admin user and return a JWT for API authentication. */
export async function createTestAdmin(strapi: any): Promise<string> {
  const roleService: any = strapi.service('admin::role');
  const userService: any = strapi.service('admin::user');

  await roleService.createRolesIfNoneExist();

  const superAdminRole = await strapi.query('admin::role').findOne({
    where: { code: 'strapi-super-admin' },
  });

  if (!superAdminRole) {
    throw new Error('Super admin role not found after createRolesIfNoneExist');
  }

  const testEmail = 'test-admin@test.com';
  const testPassword = 'TestPass123!';

  try {
    await userService.createFirstAdmin({
      firstname: 'Test',
      lastname: 'Admin',
      email: testEmail,
      password: testPassword,
    });
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    if (!msg.includes('already registered') && !msg.includes('already exists')) {
      await userService.create({
        firstname: 'Test',
        lastname: 'Admin',
        email: testEmail,
        password: testPassword,
        roles: [superAdminRole.id],
        isActive: true,
      });
    }
  }

  const loginRes = await request(strapi.server.httpServer)
    .post('/admin/login')
    .send({ email: testEmail, password: testPassword });

  const token: string = loginRes.body?.data?.token || loginRes.body?.token || '';

  if (!token) {
    throw new Error(
      `Admin login failed — status ${loginRes.status}, body: ${JSON.stringify(loginRes.body)}`
    );
  }

  return token;
}

/** Tear down the Strapi instance and clean up the temp directory. */
export async function cleanupStrapi(): Promise<void> {
  if (strapiInstance) {
    try {
      await strapiInstance.destroy();
    } catch {
      // Swallow destroy errors
    }
    strapiInstance = null;
    delete (global as any).strapi;
  }

  if (tempDir && fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err: any) {
      // On Windows, DLLs (e.g. libvips-42.dll) stay loaded after destroy()
      // and can't be deleted until process exit. Warn and move on.
      if (err?.code === 'EPERM' && process.platform === 'win32') {
        console.warn(
          `[strapi-test-harness] Could not fully clean up ${tempDir} — DLLs still locked. The OS will reclaim later.`
        );
      } else {
        throw err;
      }
    }
    tempDir = null;
  }
}
