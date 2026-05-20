const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    '^@theme-original/(.*)$': '<rootDir>/node_modules/@cmfcmf/docusaurus-search-local/lib/client/theme/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@docusaurus/theme-common$': '<rootDir>/__mocks__/@docusaurus/theme-common.js',
    '^@docusaurus/(.*)$': '<rootDir>/node_modules/@docusaurus/$1',
    '^clsx$': 'clsx',
    '^@theme/Admonition/Layout$': '<rootDir>/__mocks__/@theme/Admonition/Layout.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      configFile: './babel.config.js',
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-syntax-highlighter|@react-spring|@lezer|@marijn/build-docusaurus|clsx|@docusaurus|@theme)/)'
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ]
};