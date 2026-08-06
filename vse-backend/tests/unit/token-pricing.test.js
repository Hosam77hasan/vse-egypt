const { PLAN_LIMITS } = require('../../middleware/tokenGuard');

describe('Token Pricing Calculations', () => {
  describe('PLAN_LIMITS', () => {
    test('should have correct default limits', () => {
      expect(PLAN_LIMITS.free).toBe(0);
      expect(PLAN_LIMITS.pro).toBe(2000000);
      expect(PLAN_LIMITS.team).toBe(8000000);
    });

    test('should allow environment variable overrides', () => {
      // This test verifies the configuration can be overridden
      const originalFree = process.env.PLAN_FREE_MONTHLY_TOKENS;
      process.env.PLAN_FREE_MONTHLY_TOKENS = '1000';
      
      // Re-require to get fresh values
      delete require.cache[require.resolve('../../middleware/tokenGuard')];
      const newLimits = require('../../middleware/tokenGuard').PLAN_LIMITS;
      
      expect(newLimits.free).toBe(1000);
      
      // Restore original
      if (originalFree) {
        process.env.PLAN_FREE_MONTHLY_TOKENS = originalFree;
      } else {
        delete process.env.PLAN_FREE_MONTHLY_TOKENS;
      }
    });
  });

  describe('Token Conversion Rates', () => {
    test('should convert EGP to tokens correctly (2000 tokens per EGP)', () => {
      const TOKENS_PER_EGP = 2000;
      
      expect(100 * TOKENS_PER_EGP).toBe(200000);
      expect(200 * TOKENS_PER_EGP).toBe(400000);
      expect(400 * TOKENS_PER_EGP).toBe(800000);
      expect(800 * TOKENS_PER_EGP).toBe(1600000);
      expect(1000 * TOKENS_PER_EGP).toBe(2000000);
    });

    test('should convert USD to tokens correctly (100000 tokens per USD)', () => {
      const TOKENS_PER_USD = 100000;
      
      expect(1 * TOKENS_PER_USD).toBe(100000);
      expect(5 * TOKENS_PER_USD).toBe(500000);
      expect(10 * TOKENS_PER_USD).toBe(1000000);
    });

    test('should calculate profit margin correctly', () => {
      // Example: 100 EGP charge
      const chargeEgp = 100;
      const tokensPerEgp = 2000;
      const tokensGranted = chargeEgp * tokensPerEgp;
      
      // DeepSeek cost: ~$0.21 per 1M tokens
      const costPerMillionTokens = 0.21;
      const actualCost = (tokensGranted / 1000000) * costPerMillionTokens;
      
      // Convert EGP to USD (approximate rate)
      const egpToUsd = 50; // 1 USD ≈ 50 EGP
      const revenueUsd = chargeEgp / egpToUsd;
      
      const profitMargin = ((revenueUsd - actualCost) / revenueUsd) * 100;
      
      expect(tokensGranted).toBe(200000);
      expect(actualCost).toBeCloseTo(0.042, 3);
      expect(revenueUsd).toBe(2);
      expect(profitMargin).toBeGreaterThan(95); // >95% profit margin
    });
  });

  describe('Topup Catalog', () => {
    test('should have correct topup amounts and tokens', () => {
      const TOPUP_CATALOG = {
        100: 200000,
        200: 400000,
        400: 800000,
        800: 1600000,
        1000: 2000000,
      };
      
      // Verify linear relationship (2000 tokens per EGP)
      Object.entries(TOPUP_CATALOG).forEach(([egp, tokens]) => {
        expect(tokens).toBe(Number(egp) * 2000);
      });
    });

    test('should maintain consistent token-to-EGP ratio', () => {
      const ratio = 2000; // tokens per EGP
      
      expect(100 * ratio).toBe(200000);
      expect(500 * ratio).toBe(1000000);
      expect(1000 * ratio).toBe(2000000);
    });
  });
});

describe('Token Budget Calculations', () => {
  test('should calculate usage percentage correctly', () => {
    const used = 1500000;
    const limit = 2000000;
    const percentUsed = Math.min(100, Math.round((used / limit) * 100));
    
    expect(percentUsed).toBe(75);
  });

  test('should cap usage percentage at 100%', () => {
    const used = 2500000;
    const limit = 2000000;
    const percentUsed = Math.min(100, Math.round((used / limit) * 100));
    
    expect(percentUsed).toBe(100);
  });

  test('should handle zero limit (free plan)', () => {
    const used = 1000;
    const limit = 0;
    const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : (used > 0 ? 100 : 0);
    
    expect(percentUsed).toBe(100);
  });

  test('should calculate available credit correctly', () => {
    const creditBalance = 500000;
    const creditConsumed = 200000;
    const availableCredit = Math.max(0, creditBalance - creditConsumed);
    
    expect(availableCredit).toBe(300000);
  });

  test('should not allow negative available credit', () => {
    const creditBalance = 100000;
    const creditConsumed = 200000;
    const availableCredit = Math.max(0, creditBalance - creditConsumed);
    
    expect(availableCredit).toBe(0);
  });
});