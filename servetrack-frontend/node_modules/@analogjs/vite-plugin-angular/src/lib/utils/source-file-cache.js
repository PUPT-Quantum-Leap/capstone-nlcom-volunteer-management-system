/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { platform } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
const USING_WINDOWS = platform() === 'win32';
const WINDOWS_SEP_REGEXP = new RegExp(`\\${path.win32.sep}`, 'g');
export class SourceFileCache extends Map {
    persistentCachePath;
    modifiedFiles = new Set();
    babelFileCache = new Map();
    typeScriptFileCache = new Map();
    referencedFiles;
    constructor(persistentCachePath) {
        super();
        this.persistentCachePath = persistentCachePath;
    }
    invalidate(files) {
        if (files !== this.modifiedFiles) {
            this.modifiedFiles.clear();
        }
        for (let file of files) {
            this.babelFileCache.delete(file);
            this.typeScriptFileCache.delete(pathToFileURL(file).href);
            // Normalize separators to allow matching TypeScript Host paths
            if (USING_WINDOWS) {
                file = file.replace(WINDOWS_SEP_REGEXP, path.posix.sep);
            }
            this.delete(file);
            this.modifiedFiles.add(file);
        }
    }
}
//# sourceMappingURL=source-file-cache.js.map