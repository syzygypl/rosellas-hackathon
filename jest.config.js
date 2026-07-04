/**
 * Minimal Jest setup for pure unit tests (no Angular TestBed, no Nest e2e).
 * Specs live next to the code as *.spec.ts under apps/<app>/src/ and eval/framework/.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/apps/**/src/**/*.spec.ts', '<rootDir>/eval/framework/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Transpile-only: full type-checking happens in the app builds.
        diagnostics: false,
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
