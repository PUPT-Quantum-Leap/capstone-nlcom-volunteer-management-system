import { defineConfig } from 'vitest/config';
<<<<<<< HEAD

export default defineConfig({
=======
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
>>>>>>> origin/main
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
<<<<<<< HEAD
  },
  plugins: [
    {
      name: 'angular-component-resource-resolver',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('.ts') || id.endsWith('.spec.ts')) {
          return null;
        }

        // Inline template and styles for Angular components in Vitest
        let transformedCode = code;
        if (code.includes('templateUrl:')) {
          transformedCode = transformedCode.replace(
            /templateUrl:\s*['"](.*)['"]/g,
            "template: ''"
          );
        }
        if (code.includes('styleUrl:')) {
          transformedCode = transformedCode.replace(
            /styleUrl:\s*['"](.*)['"]/g,
            "styles: []"
          );
        }

        return {
          code: transformedCode,
          map: null
        };
      }
    }
  ]
=======
    include: ['src/**/*.spec.ts'],
    pool: 'forks'
  },
  resolve: {
    mainFields: ['module'],
  },
>>>>>>> origin/main
});
