module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.config.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  transformIgnorePatterns: [
    'node_modules/(?!(@prisma/client)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '@prisma/client': '<rootDir>/jest.prisma-mock.js'
  },
  testTimeout: 30000,
  verbose: true,
  bail: false,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Prisma mock configuration
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  
  // CommonJS configuration - DO NOT use ESM
  extensionsToTreatAsEsm: [],
  transform: {},
  
  // Suppress warnings
  errorOnDeprecated: false
};
