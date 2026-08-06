const jwt = require('jsonwebtoken');

// Set environment variables before requiring the module
process.env.LICENSE_JWT_SECRET = 'test-license-secret';

// Mock the database
const mockDb = {
  prepare: jest.fn(),
};

jest.mock('../../db', () => mockDb);

const { requireValidLicense, SECRET } = require('../../middleware/auth');

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireValidLicense', () => {
    test('should return 401 for missing token', () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        valid: false,
        reason: 'not_found',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 for oversized token', () => {
      const req = { headers: { authorization: `Bearer ${'x'.repeat(2049)}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'invalid',
        message: 'Token too large.',
      }));
    });

    test('should return 401 for invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'invalid',
      }));
    });

    test('should return 401 for expired token', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', type: 'access' }, SECRET, { expiresIn: '-1s' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'expired',
      }));
    });

    test('should return 401 for access token with missing claims', () => {
      const token = jwt.sign({ type: 'access' }, SECRET); // missing sub and plan
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'invalid',
      }));
    });

    test('should return 401 for non-existent user', () => {
      const token = jwt.sign({ sub: 999, plan: 'pro', type: 'access' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'not_found',
      }));
    });

    test('should return 401 for unverified email', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', type: 'access' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 1, plan: 'pro', email_verified: 0 }),
      });

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should call next for valid access token', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', type: 'access' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 1, plan: 'pro', email_verified: 1 }),
      });

      requireValidLicense(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({ id: 1, plan: 'pro' });
    });

    test('should return 401 for license token with missing claims', () => {
      const token = jwt.sign({ sub: 1 }, SECRET); // missing jti
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should return 401 for non-existent license', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', jti: 'LICENSE-123' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'not_found',
      }));
    });

    test('should return 401 for revoked license', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', jti: 'LICENSE-123' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 1, status: 'revoked', expires_at: '2099-01-01' }),
      });

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'revoked',
      }));
    });

    test('should return 401 for expired license', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', jti: 'LICENSE-123' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 1, status: 'active', expires_at: '2020-01-01' }),
        run: jest.fn(),
      });

      requireValidLicense(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'expired',
      }));
    });

    test('should call next for valid license token', () => {
      const token = jwt.sign({ sub: 1, plan: 'pro', jti: 'LICENSE-123' }, SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ id: 1, status: 'active', expires_at: '2099-01-01' }),
      });

      requireValidLicense(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({ id: 1, plan: 'pro', licenseId: 1 });
    });
  });

  describe('SECRET', () => {
    test('should be defined', () => {
      expect(SECRET).toBeDefined();
      expect(typeof SECRET).toBe('string');
    });
  });
});