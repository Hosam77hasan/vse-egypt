const request = require('supertest');
const express = require('express');

// Mock the database with a shared mock object
const mockDb = {
  prepare: jest.fn(),
};

jest.mock('../../db', () => mockDb);

// Mock the tokenGuard middleware
jest.mock('../../middleware/tokenGuard', () => ({
  requireTokenBudget: (req, res, next) => next(),
  recordUsage: jest.fn(),
  PLAN_LIMITS: {
    free: 0,
    pro: 2000000,
    team: 8000000,
  },
}));

// Mock the models config
jest.mock('../../config/models', () => ({
  getPublicCatalog: () => ({
    driver: { label: 'Driver', labelEn: 'Driver', description: 'Fast code writing' },
    leader: { label: 'Leader', labelEn: 'Leader', description: 'Architecture' },
    innovator: { label: 'Innovator', labelEn: 'Innovator', description: 'Complex refactors' },
  }),
}));

// Create a mock auth middleware that doesn't use jwt
const mockAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ valid: false, reason: 'not_found' });
  }
  
  // Simple token validation for testing
  if (token === 'invalid-token') {
    return res.status(401).json({ valid: false, reason: 'invalid' });
  }
  
  // Parse user info from token (simplified for testing)
  req.user = { id: 1, plan: 'pro' };
  next();
};

const billingRouter = require('../../routes/billing');

describe('Billing Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Apply mock auth middleware to all billing routes
    app.use('/v1/billing', mockAuthMiddleware, billingRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /v1/billing/summary', () => {
    test('should return billing summary for authenticated user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'pro',
        created_at: '2024-01-01',
      };
      
      const mockUsage = {
        prompt_tokens: 100000,
        completion_tokens: 50000,
        request_count: 25,
      };
      
      const mockByModel = [
        {
          model_alias: 'driver',
          prompt_tokens: 80000,
          completion_tokens: 40000,
          request_count: 20,
        },
      ];

      // Create mock prepare function that returns different values based on call
      let callCount = 0;
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return mockUser; // User lookup
          if (callCount === 2) return mockUsage; // Usage lookup
          if (callCount === 3) return null; // No active license
          return null;
        }),
        all: jest.fn().mockReturnValue(mockByModel),
        run: jest.fn(),
      });

      const response = await request(app)
        .get('/v1/billing/summary')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.plan).toBe('pro');
      expect(response.body.usage.totalTokens).toBe(150000);
      expect(response.body.usage.limitTokens).toBe(2000000);
    });

    test('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/v1/billing/summary');

      expect(response.status).toBe(401);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/v1/billing/summary')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should calculate usage percentage correctly', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        plan: 'pro',
        created_at: '2024-01-01',
      };
      
      const mockUsage = {
        prompt_tokens: 1500000,
        completion_tokens: 500000,
        request_count: 100,
      };

      let callCount = 0;
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return mockUser;
          if (callCount === 2) return mockUsage;
          if (callCount === 3) return null;
          return null;
        }),
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      });

      const response = await request(app)
        .get('/v1/billing/summary')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.usage.percentUsed).toBe(100);
    });

    test('should handle free plan with no tokens', async () => {
      const mockUser = {
        id: 2,
        email: 'free@example.com',
        plan: 'free',
        created_at: '2024-01-01',
      };
      
      const mockUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        request_count: 0,
      };

      let callCount = 0;
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return mockUser;
          if (callCount === 2) return mockUsage;
          if (callCount === 3) return null;
          return null;
        }),
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      });

      // Use a simple token for testing
      const response = await request(app)
        .get('/v1/billing/summary')
        .set('Authorization', 'Bearer test-token-free');

      expect(response.status).toBe(200);
      expect(response.body.plan).toBe('free');
      expect(response.body.usage.limitTokens).toBe(0);
    });
  });
});