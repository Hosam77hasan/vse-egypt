// Test setup file - Mock database for testing

// Mock environment variables before any imports
process.env.LICENSE_JWT_SECRET = 'test-secret-key-for-jwt';
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-key';
process.env.ADMIN_PASSCODE_HASH = '$2a$12$test-hash-for-admin-passcode';
process.env.PAYMENT_PORTAL_INTERNAL_SECRET = 'test-internal-secret';
process.env.NODE_ENV = 'test';

// Mock the database module
jest.mock('../db', () => {
  const mockDb = {
    prepare: jest.fn(() => ({
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
    })),
    exec: jest.fn(),
    pragma: jest.fn(),
    transaction: jest.fn((fn) => fn()),
  };
  return mockDb;
});