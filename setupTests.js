// setupTests.js
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock CSS modules
const mockStyle = {};
jest.mock('*.css', () => mockStyle);

// Import testing library matchers after setting up globals
require('@testing-library/jest-dom');