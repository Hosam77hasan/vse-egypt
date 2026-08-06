// Mock the database
const mockDb = {
  prepare: jest.fn(),
};

jest.mock('../../db', () => mockDb);

// Mock web-push
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

// Set VAPID keys before requiring the module
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-private-key';

const pushService = require('../../services/push');

describe('Push Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveSubscription', () => {
    test('should save a valid subscription', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
      });

      const subscription = {
        endpoint: 'https://example.com/push',
        keys: {
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      };

      expect(() => pushService.saveSubscription(subscription)).not.toThrow();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should throw for invalid subscription without endpoint', () => {
      const subscription = {
        keys: {
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      };

      expect(() => pushService.saveSubscription(subscription)).toThrow('invalid_subscription');
    });

    test('should throw for invalid subscription without keys', () => {
      const subscription = {
        endpoint: 'https://example.com/push',
      };

      expect(() => pushService.saveSubscription(subscription)).toThrow('invalid_subscription');
    });

    test('should throw for null subscription', () => {
      expect(() => pushService.saveSubscription(null)).toThrow('invalid_subscription');
    });

    test('should throw for undefined subscription', () => {
      expect(() => pushService.saveSubscription(undefined)).toThrow('invalid_subscription');
    });
  });

  describe('notifyAdmins', () => {
    test('should notify admins with valid subscriptions', async () => {
      const mockSubs = [
        { id: 1, endpoint: 'https://example.com/push1', p256dh: 'key1', auth: 'auth1' },
        { id: 2, endpoint: 'https://example.com/push2', p256dh: 'key2', auth: 'auth2' },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue(mockSubs),
        run: jest.fn(),
      });

      const payload = { title: 'Test', body: 'Test notification' };

      await expect(pushService.notifyAdmins(payload)).resolves.not.toThrow();
    });

    test('should handle no subscriptions gracefully', async () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      });

      const payload = { title: 'Test', body: 'Test notification' };

      await expect(pushService.notifyAdmins(payload)).resolves.not.toThrow();
    });

    test('should handle push notification errors gracefully', async () => {
      const mockSubs = [
        { id: 1, endpoint: 'https://example.com/push1', p256dh: 'key1', auth: 'auth1' },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue(mockSubs),
        run: jest.fn(),
      });

      // Mock sendNotification to throw
      const webpush = require('web-push');
      webpush.sendNotification.mockRejectedValue(new Error('Push failed'));

      const payload = { title: 'Test', body: 'Test notification' };

      // Should not throw even if push fails
      await expect(pushService.notifyAdmins(payload)).resolves.not.toThrow();
    });

    test('should handle 410 error gracefully (expired subscription)', async () => {
      const mockSubs = [
        { id: 1, endpoint: 'https://example.com/push1', p256dh: 'key1', auth: 'auth1' },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue(mockSubs),
        run: jest.fn(),
      });

      // Mock sendNotification to throw 410 error
      const webpush = require('web-push');
      const error = new Error(' Gone');
      error.statusCode = 410;
      webpush.sendNotification.mockRejectedValue(error);

      const payload = { title: 'Test', body: 'Test notification' };

      // Should not throw even if push fails with 410
      await expect(pushService.notifyAdmins(payload)).resolves.not.toThrow();
    });
  });

  describe('isConfigured', () => {
    test('should return configuration status', () => {
      const result = pushService.isConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getPublicKey', () => {
    test('should return public key or null', () => {
      const result = pushService.getPublicKey();
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });
});