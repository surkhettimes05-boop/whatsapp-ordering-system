require('dotenv').config({ path: '.env.test' });

// Set NODE_ENV to test
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Suppress console logs unless CI
if (process.env.CI !== 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
}

// Reset Prisma mock before each test SUITE (via beforeAll in each suite)
// Individual test suites should call this if they need isolation
global.__PRISMA_MOCK_RESET__ = () => {
  try {
    const prismaMock = require('./jest.prisma-mock.js');
    if (prismaMock.__resetMockStore__) {
      prismaMock.__resetMockStore__();
    }
  } catch (e) {
    // Mock might not be loaded yet
  }
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});



