// Mock the database first
const mockDb = {
  prepare: jest.fn(),
};

jest.mock('../../db', () => mockDb);

const { PLAN_LIMITS, requireTokenBudget, recordUsage } = require('../../middleware/tokenGuard');

describe('Token Guard Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PLAN_LIMITS', () => {
    test('should have correct default limits', () => {
      expect(PLAN_LIMITS.free).toBe(0);
      expect(PLAN_LIMITS.pro).toBe(2000000);
      expect(PLAN_LIMITS.team).toBe(8000000);
    });
  });

  describe('requireTokenBudget', () => {
    test('should allow request when within quota', () => {
      const req = { user: { id: 1, plan: 'pro' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock database responses
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValueOnce({ prompt_tokens: 500000, completion_tokens: 500000 }) // 1M used out of 2M
          .mockReturnValueOnce({ credit_balance_tokens: 0, credit_consumed_tokens: 0 }),
      });

      requireTokenBudget(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.tokenBudget).toBeDefined();
      expect(req.tokenBudget.used).toBe(1000000);
      expect(req.tokenBudget.limit).toBe(2000000);
      expect(req.tokenBudget.usingCredit).toBe(false);
    });

    test('should block request when quota exceeded and no credit', () => {
      const req = { user: { id: 1, plan: 'pro' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock database responses - quota exceeded
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValueOnce({ prompt_tokens: 1500000, completion_tokens: 500000 }) // 2M used out of 2M
          .mockReturnValueOnce({ credit_balance_tokens: 0, credit_consumed_tokens: 0 }),
      });

      requireTokenBudget(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'token_quota_exceeded',
      }));
    });

    test('should allow request when quota exceeded but credit available', () => {
      const req = { user: { id: 1, plan: 'pro' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock database responses - quota exceeded but credit available
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValueOnce({ prompt_tokens: 1500000, completion_tokens: 500000 }) // 2M used out of 2M
          .mockReturnValueOnce({ credit_balance_tokens: 500000, credit_consumed_tokens: 0 }), // 500K credit available
      });

      requireTokenBudget(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.tokenBudget.usingCredit).toBe(true);
      expect(req.tokenBudget.availableCredit).toBe(500000);
    });

    test('should handle free plan with no usage', () => {
      const req = { user: { id: 2, plan: 'free' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock database responses - need to return different values for each call
      let getCallCount = 0;
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          getCallCount++;
          if (getCallCount === 1) return null; // No usage record
          if (getCallCount === 2) return { credit_balance_tokens: 0, credit_consumed_tokens: 0 };
          return null;
        }),
        run: jest.fn(),
        all: jest.fn(),
      });

      requireTokenBudget(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.tokenBudget.used).toBe(0);
      expect(req.tokenBudget.limit).toBe(0);
    });

    test('should calculate available credit correctly', () => {
      const req = { user: { id: 1, plan: 'pro' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      // Mock database responses - credit partially used
      mockDb.prepare.mockReturnValue({
        get: jest.fn().mockReturnValueOnce({ prompt_tokens: 500000, completion_tokens: 500000 })
          .mockReturnValueOnce({ credit_balance_tokens: 500000, credit_consumed_tokens: 200000 }), // 300K available
      });

      requireTokenBudget(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.tokenBudget.availableCredit).toBe(300000);
    });
  });

  describe('recordUsage', () => {
    test('should record usage correctly', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
      });

      recordUsage(1, '2024-01', 1000, 500, 'driver', false);

      expect(mockRun).toHaveBeenCalledTimes(2); // token_usage + token_usage_by_model
    });

    test('should record usage with credit deduction', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
      });

      recordUsage(1, '2024-01', 1000, 500, 'driver', true);

      expect(mockRun).toHaveBeenCalledTimes(3); // token_usage + token_usage_by_model + credit update
    });

    test('should use default model alias', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
      });

      recordUsage(1, '2024-01', 1000, 500);

      expect(mockRun).toHaveBeenCalledTimes(2);
    });
  });
});