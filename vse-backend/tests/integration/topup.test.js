const request = require('supertest');
const express = require('express');

// Mock the database with a shared mock object
const mockDb = {
  prepare: jest.fn(),
};

jest.mock('../../db', () => mockDb);

const topupRouter = require('../../routes/topup');

describe('Topup System', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/v1/topup', topupRouter);
    
    // Set internal secret for testing
    process.env.PAYMENT_PORTAL_INTERNAL_SECRET = 'test-internal-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/topup/confirm', () => {
    test('should confirm topup with valid internal secret', async () => {
      const mockUser = { id: 1 };
      const mockUpdatedUser = {
        credit_balance_tokens: 200000,
        credit_consumed_tokens: 0,
      };

      let callCount = 0;
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return mockUser; // User lookup
          if (callCount === 2) return mockUpdatedUser; // Updated user
          return null;
        }),
        run: jest.fn(),
        all: jest.fn(),
      });

      const response = await request(app)
        .post('/v1/topup/confirm')
        .set('x-internal-secret', 'test-internal-secret')
        .send({
          userId: 1,
          amountEgp: 100,
          paymentRef: 'PAY123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.topped_up).toBe(true);
      expect(response.body.tokensGranted).toBe(200000);
      expect(response.body.newBalance).toBe(200000);
    });

    test('should reject without internal secret', async () => {
      const response = await request(app)
        .post('/v1/topup/confirm')
        .send({
          userId: 1,
          amountEgp: 100,
          paymentRef: 'PAY123456',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });

    test('should reject with invalid internal secret', async () => {
      const response = await request(app)
        .post('/v1/topup/confirm')
        .set('x-internal-secret', 'wrong-secret')
        .send({
          userId: 1,
          amountEgp: 100,
          paymentRef: 'PAY123456',
        });

      expect(response.status).toBe(403);
    });

    test('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/v1/topup/confirm')
        .set('x-internal-secret', 'test-internal-secret')
        .send({
          userId: 1,
          amountEgp: 150, // Invalid amount
          paymentRef: 'PAY123456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    test('should reject non-existent user', async () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
        run: jest.fn(),
        all: jest.fn(),
      });

      const response = await request(app)
        .post('/v1/topup/confirm')
        .set('x-internal-secret', 'test-internal-secret')
        .send({
          userId: 999,
          amountEgp: 100,
          paymentRef: 'PAY123456',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('user_not_found');
    });

    test('should handle all valid topup amounts', async () => {
      const validAmounts = [100, 200, 400, 800, 1000];
      const expectedTokens = [200000, 400000, 800000, 1600000, 2000000];
      
      for (let i = 0; i < validAmounts.length; i++) {
        const mockUser = { id: 1 };
        const mockUpdatedUser = {
          credit_balance_tokens: expectedTokens[i],
          credit_consumed_tokens: 0,
        };

        let callCount = 0;
        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return mockUser;
            if (callCount === 2) return mockUpdatedUser;
            return null;
          }),
          run: jest.fn(),
          all: jest.fn(),
        });

        const response = await request(app)
          .post('/v1/topup/confirm')
          .set('x-internal-secret', 'test-internal-secret')
          .send({
            userId: 1,
            amountEgp: validAmounts[i],
            paymentRef: `PAY${validAmounts[i]}`,
          });

        expect(response.status).toBe(200);
        expect(response.body.tokensGranted).toBe(expectedTokens[i]);
      }
    });
  });

  describe('GET /v1/topup/catalog', () => {
    test('should return topup catalog', async () => {
      const response = await request(app)
        .get('/v1/topup/catalog');

      expect(response.status).toBe(200);
      expect(response.body.amounts).toBeDefined();
      expect(Array.isArray(response.body.amounts)).toBe(true);
      expect(response.body.amounts.length).toBe(5);
    });

    test('should have correct catalog structure', async () => {
      const response = await request(app)
        .get('/v1/topup/catalog');

      expect(response.status).toBe(200);
      
      const amounts = response.body.amounts;
      amounts.forEach(item => {
        expect(item.amountEgp).toBeDefined();
        expect(item.tokensGranted).toBeDefined();
        expect(typeof item.amountEgp).toBe('number');
        expect(typeof item.tokensGranted).toBe('number');
      });
    });

    test('should maintain linear relationship in catalog', async () => {
      const response = await request(app)
        .get('/v1/topup/catalog');

      expect(response.status).toBe(200);
      
      const amounts = response.body.amounts;
      amounts.forEach(item => {
        expect(item.tokensGranted).toBe(item.amountEgp * 2000);
      });
    });
  });
});