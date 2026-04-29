import { Plugin } from 'vite';
/**
 * Sets up test config for Vitest
 * and downlevels any dependencies that use
 * async/await to support zone.js testing
 * and tests w/fakeAsync
 */
export declare function angularVitestPlugin(): Plugin;
/**
 * This eagerly disables esbuild so Vitest
 * disables it when its internal plugin
 * is configured.
 */
export declare function angularVitestEsbuildPlugin(): Plugin;
/**
 * This plugin does post-processing with esbuild
 * instead of preprocessing to re-align
 * the sourcemaps so breakpoints and coverage reports
 * work correctly.
 */
export declare function angularVitestSourcemapPlugin(): Plugin;
export declare function angularVitestPlugins(): Plugin<any>[];
