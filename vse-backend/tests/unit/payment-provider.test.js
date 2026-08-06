// Mock the database
const mockDb = {
  prepare: jest.fn(),
  transaction: jest.fn((fn) => fn),
};

jest.mock('../../db', () => mockDb);

// Mock the push service
jest.mock('../../services/push', () => ({
  notifyAdmins: jest.fn().mockResolvedValue({}),
}));

const ManualPaymentProvider = require('../../services/payment/ManualPaymentProvider');

describe('Payment Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ManualPaymentProvider', () => {
    describe('createRequest', () => {
      test('should create a payment request', () => {
        const mockRequest = {
          id: 1,
          user_id: 1,
          email: 'test@example.com',
          amount: 100,
          currency: 'EGP',
          tokens_requested: 200000,
          payment_method: 'vodafone_cash',
          transaction_ref: 'PAY123',
          notes: null,
          status: 'pending',
          created_at: '2024-01-01',
        };

        mockDb.prepare.mockReturnValue({
          run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
          get: jest.fn().mockReturnValue(mockRequest),
        });

        const result = ManualPaymentProvider.createRequest({
          userId: 1,
          email: 'test@example.com',
          amount: 100,
          currency: 'EGP',
          tokensRequested: 200000,
          paymentMethod: 'vodafone_cash',
          transactionRef: 'PAY123',
        });

        expect(result).toBeDefined();
        expect(result.id).toBe(1);
        expect(result.status).toBe('pending');
      });

      test('should handle null userId', () => {
        const mockRequest = {
          id: 2,
          user_id: null,
          email: 'guest@example.com',
          amount: 50,
          currency: 'USD',
          tokens_requested: 5000000,
          payment_method: 'paypal',
          transaction_ref: 'PAY456',
          notes: null,
          status: 'pending',
          created_at: '2024-01-01',
        };

        mockDb.prepare.mockReturnValue({
          run: jest.fn().mockReturnValue({ lastInsertRowid: 2 }),
          get: jest.fn().mockReturnValue(mockRequest),
        });

        const result = ManualPaymentProvider.createRequest({
          userId: null,
          email: 'guest@example.com',
          amount: 50,
          currency: 'USD',
          tokensRequested: 5000000,
          paymentMethod: 'paypal',
          transactionRef: 'PAY456',
        });

        expect(result).toBeDefined();
        expect(result.user_id).toBeNull();
      });
    });

    describe('listByStatus', () => {
      test('should list requests by status', () => {
        const mockRequests = [
          { id: 1, status: 'pending' },
          { id: 2, status: 'pending' },
        ];

        mockDb.prepare.mockReturnValue({
          all: jest.fn().mockReturnValue(mockRequests),
        });

        const result = ManualPaymentProvider.listByStatus('pending');

        expect(result).toHaveLength(2);
        expect(result[0].status).toBe('pending');
      });

      test('should list all requests when no status provided', () => {
        const mockRequests = [
          { id: 1, status: 'pending' },
          { id: 2, status: 'approved' },
          { id: 3, status: 'rejected' },
        ];

        mockDb.prepare.mockReturnValue({
          all: jest.fn().mockReturnValue(mockRequests),
        });

        const result = ManualPaymentProvider.listByStatus(null);

        expect(result).toHaveLength(3);
      });
    });

    describe('getById', () => {
      test('should get request by id', () => {
        const mockRequest = { id: 1, status: 'pending' };

        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(mockRequest),
        });

        const result = ManualPaymentProvider.getById(1);

        expect(result).toBeDefined();
        expect(result.id).toBe(1);
      });

      test('should return undefined for non-existent id', () => {
        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(undefined),
        });

        const result = ManualPaymentProvider.getById(999);

        expect(result).toBeUndefined();
      });
    });

    describe('approve', () => {
      test('should approve a pending request', () => {
        const mockRequest = { id: 1, status: 'pending', user_id: 1, tokens_requested: 200000 };
        const mockUpdatedRequest = { id: 1, status: 'approved', user_id: 1, tokens_requested: 200000 };

        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValueOnce(mockRequest).mockReturnValueOnce(mockUpdatedRequest),
          run: jest.fn(),
        });
        mockDb.transaction.mockImplementation((fn) => fn);

        const result = ManualPaymentProvider.approve(1);

        expect(result.ok).toBe(true);
        expect(result.request.status).toBe('approved');
      });

      test('should return not_found for non-existent request', () => {
        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(undefined),
        });

        const result = ManualPaymentProvider.approve(999);

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('not_found');
      });

      test('should return already_reviewed for non-pending request', () => {
        const mockRequest = { id: 1, status: 'approved', user_id: 1, tokens_requested: 200000 };

        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(mockRequest),
        });

        const result = ManualPaymentProvider.approve(1);

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('already_reviewed');
      });
    });

    describe('reject', () => {
      test('should reject a pending request', () => {
        const mockRequest = { id: 1, status: 'pending', user_id: 1, tokens_requested: 200000 };
        const mockUpdatedRequest = { id: 1, status: 'rejected', user_id: 1, tokens_requested: 200000 };

        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValueOnce(mockRequest).mockReturnValueOnce(mockUpdatedRequest),
          run: jest.fn(),
        });

        const result = ManualPaymentProvider.reject(1);

        expect(result.ok).toBe(true);
        expect(result.request.status).toBe('rejected');
      });

      test('should return not_found for non-existent request', () => {
        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(undefined),
        });

        const result = ManualPaymentProvider.reject(999);

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('not_found');
      });

      test('should return already_reviewed for non-pending request', () => {
        const mockRequest = { id: 1, status: 'rejected', user_id: 1, tokens_requested: 200000 };

        mockDb.prepare.mockReturnValue({
          get: jest.fn().mockReturnValue(mockRequest),
        });

        const result = ManualPaymentProvider.reject(1);

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('already_reviewed');
      });
    });
  });
});