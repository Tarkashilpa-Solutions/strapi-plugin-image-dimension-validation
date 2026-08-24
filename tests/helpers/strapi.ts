/**
 * Integration test harness for the image-validation plugin.
 *
 * Creates a temporary Strapi application, installs the plugin, and boots
 * a Strapi instance with an in-memory SQLite database.
 *
 * IMPORTANT: This requires Linux/macOS.  SQLite in-memory mode does not work
 * on Windows due to file-locking.  Integration tests are designed to run on
 * GitHub Actions (ubuntu-latest) only.
 *
 * Usage:
 *   import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
 *
 *   beforeAll(async () => { await setupStrapi(); });
 *   afterAll(async () => { await cleanupStrapi(); });
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let strapiInstance: any = null;
let tempDir: string | null = null;

/**
 * Bootstrap a Strapi instance for integration testing.
 *
 * Creates a minimal Strapi application in a temp directory, loads the
 * image-validation plugin along with required core plugins (upload,
 * users-permissions), and starts the server.
 */
export async function setupStrapi(): Promise<any> {
  // Resolve the plugin root (parent of tests/)
  const pluginRoot = path.resolve(__dirname, '..', '..');

  // Create a minimal Strapi app in a temp directory
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-test-'));
  const srcAdminDir = path.join(tempDir, 'src', 'admin');
  fs.mkdirSync(srcAdminDir, { recursive: true });

  // ----- package.json -------------------------------------------------------
  const pkgJson = {
    name: 'strapi-test-app',
    private: true,
    version: '0.0.0',
    scripts: { build: 'strapi build', develop: 'strapi develop' },
    dependencies: {
      '@strapi/strapi': '*',
      '@strapi/plugin-upload': '*',
      '@strapi/plugin-users-permissions': '*',
    },
    strapi: { uuid: 'test-app' },
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // src/admin/app.js (minimal — required by Strapi)
  fs.writeFileSync(
    path.join(srcAdminDir, 'app.js'),
    `export default { config: { locales: ['en'], translations: { en: {} } } };\n`
  );

  // ----- Symlink the plugin into node_modules -------------------------------
  const nodeModulesDir = path.join(tempDir, 'node_modules');
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  // Symlink @strapi packages from the plugin's own node_modules
  const localNodeModules = path.resolve(pluginRoot, 'node_modules');
  const strapiPackages = [
    '@strapi/strapi',
    '@strapi/utils',
    '@strapi/admin',
    '@strapi/database',
    '@strapi/permissions',
    '@strapi/typescript-utils',
    '@strapi/plugin-upload',
    '@strapi/plugin-users-permissions',
  ];

  for (const pkg of strapiPackages) {
    const srcPath = path.join(localNodeModules, pkg);
    const destPath = path.join(nodeModulesDir, pkg);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      // Use junction on Windows, symlink on Unix
      try {
        fs.symlinkSync(srcPath, destPath, 'dir');
      } catch {
        // Fallback for Windows: copy instead of symlink
        fs.cpSync(srcPath, destPath, { recursive: true });
      }
    }
  }

  // Link the image-validation plugin itself
  const pluginDest = path.join(
    nodeModulesDir,
    '@tarkashilpa',
    'strapi-plugin-image-dimension-validation'
  );
  fs.mkdirSync(path.dirname(pluginDest), { recursive: true });
  try {
    fs.symlinkSync(pluginRoot, pluginDest, 'dir');
  } catch {
    fs.cpSync(pluginRoot, pluginDest, { recursive: true });
  }

  // ----- Bootstrap Strapi ---------------------------------------------------
  // Dynamically require @strapi/strapi from the temp directory
  const strapiModulePath = path.join(nodeModulesDir, '@strapi', 'strapi');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const strapiFactory = require(strapiModulePath);

  // Create and load the Strapi instance
  const appDir = tempDir;
  const strapi = strapiFactory.createStrapi
    ? await strapiFactory
        .createStrapi({
          appDir,
          distDir: appDir,
          autoReload: false,
          serveAdminPanel: false,
        })
        .load()
    : await strapiFactory
        .default({
          appDir,
          distDir: appDir,
          autoReload: false,
          serveAdminPanel: false,
        })
        .load();

  strapiInstance = strapi;

  // Make strapi available globally for test assertions
  (global as any).strapi = strapi;

  return strapi;
}

/**
 * Tear down the Strapi instance and clean up the temp directory.
 */
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
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
}
