import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
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
});
