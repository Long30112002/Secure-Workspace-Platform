module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  },
  transform: {
    '^.+\.ts?$': ['ts-jest', { diagnostics: false }]
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  testTimeout: 15000
};