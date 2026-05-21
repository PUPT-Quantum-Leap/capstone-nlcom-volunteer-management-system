"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const dependency_1 = require("../../utility/dependency");
const latest_versions_1 = require("../../utility/latest-versions");
const workspace_1 = require("../../utility/workspace");
const workspace_models_1 = require("../../utility/workspace-models");
function default_1() {
    return async (tree) => {
        const workspace = await (0, workspace_1.getWorkspace)(tree);
        if (needsSourceMapSupport(workspace)) {
            return (0, dependency_1.addDependency)('source-map-support', latest_versions_1.latestVersions['source-map-support'], {
                type: dependency_1.DependencyType.Dev,
                existing: dependency_1.ExistingBehavior.Skip,
            });
        }
    };
}
function needsSourceMapSupport(workspace) {
    for (const [, project] of workspace.projects) {
        for (const [, target] of project.targets) {
            if (target.builder === workspace_models_1.Builders.Karma || target.builder === workspace_models_1.Builders.BuildKarma) {
                return true;
            }
            if (target.builder === workspace_models_1.Builders.BuildUnitTest) {
                for (const [, options] of (0, workspace_1.allTargetOptions)(target)) {
                    if (options['runner'] === 'karma') {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
//# sourceMappingURL=migration.js.map