"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ngAdd = ngAdd;
const tasks_1 = require("@angular-devkit/schematics/tasks");
const dependencies_1 = require("@schematics/angular/utility/dependencies");
const fs_1 = require("fs");
const path_1 = require("path");
function getPackageVersion() {
    try {
        // Try to read the package.json from the distributed package
        const packagePath = (0, path_1.join)(__dirname, '../../package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packagePath, 'utf-8'));
        return `^${packageJson.version}`;
    }
    catch {
        // Fallback version if package.json can't be read
        return '^33.0.0';
    }
}
function ngAdd(options) {
    return (tree, context) => {
        context.logger.info('Adding ng-icons to your project...');
        const version = getPackageVersion();
        // Add the core dependency
        const coreDependency = {
            type: dependencies_1.NodeDependencyType.Default,
            name: '@ng-icons/core',
            version,
            overwrite: true,
        };
        (0, dependencies_1.addPackageJsonDependency)(tree, coreDependency);
        context.logger.info('Added @ng-icons/core dependency');
        // Add selected iconset dependencies
        if (options.iconsets && options.iconsets.length > 0) {
            for (const iconset of options.iconsets) {
                const iconsetDependency = {
                    type: dependencies_1.NodeDependencyType.Default,
                    name: `@ng-icons/${iconset}`,
                    version,
                    overwrite: true,
                };
                (0, dependencies_1.addPackageJsonDependency)(tree, iconsetDependency);
                context.logger.info(`Added @ng-icons/${iconset} dependency`);
            }
        }
        // Schedule package installation
        context.addTask(new tasks_1.NodePackageInstallTask());
        return tree;
    };
}
//# sourceMappingURL=index.js.map