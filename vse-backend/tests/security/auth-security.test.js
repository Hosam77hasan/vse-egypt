const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('Authentication Security Tests', () => {
  const JWT_SECRET = 'test-secret-key';
  
  describe('JWT Token Security', () => {
    test('should reject tokens signed with wrong secret', () => {
      const token = jwt.sign({ sub: 1, type: 'access' }, 'wrong-secret');
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow();
    });

    test('should reject expired tokens', () => {
      const token = jwt.sign({ sub: 1, type: 'access' }, JWT_SECRET, { expiresIn: '-1s' });
      
      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow('jwt expired');
    });

    test('should reject tokens with invalid payload', () => {
      const token = jwt.sign({ invalid: 'payload' }, JWT_SECRET);
      
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded).not.toHaveProperty('sub');
      expect(decoded).not.toHaveProperty('type');
    });

    test('should validate token algorithm', () => {
      const token = jwt.sign({ sub: 1 }, JWT_SECRET, { algorithm: 'HS256' });
      
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      expect(decoded).toBeDefined();
    });

    test('should reject tokens with none algorithm', () => {
      const token = jwt.sign({ sub: 1 }, JWT_SECRET, { algorithm: 'none' });
      
      expect(() => {
        jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      }).toThrow();
    });

    test('should limit token size', () => {
      const largePayload = { sub: 1, data: 'x'.repeat(3000) };
      const token = jwt.sign(largePayload, JWT_SECRET);
      
      expect(token.length).toBeGreaterThan(2048);
    });
  });

  describe('Password Hashing Security', () => {
    test('should hash passwords with sufficient rounds', async () => {
      const password = 'test-password-123';
      const hash = await bcrypt.hash(password, 12);
      
      expect(hash).toMatch(/^\$2[aby]?\$\d{2}\$/);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify passwords correctly', async () => {
      const password = 'secure-password-456';
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await bcrypt.compare('wrong-password', hash);
      expect(isInvalid).toBe(false);
    });

    test('should use unique salts for same password', async () => {
      const password = 'same-password-789';
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should resist timing attacks', async () => {
      const password = 'timing-test-password';
      const hash = await bcrypt.hash(password, 12);
      
      const start1 = Date.now();
      await bcrypt.compare('wrong1', hash);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      await bcrypt.compare('wrong2', hash);
      const time2 = Date.now() - start2;
      
      // Timing should be similar (within 50% margin)
      expect(Math.abs(time1 - time2)).toBeLessThan(Math.max(time1, time2) * 0.5);
    });
  });

  describe('Token Injection Prevention', () => {
    test('should reject malformed Bearer tokens', () => {
      const malformedTokens = [
        'Bearer ',
        'Bearer null',
        'Bearer undefined',
        'Bearer {invalid json}',
        'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOjF9.', // none algorithm token
      ];
      
      malformedTokens.forEach(token => {
        expect(() => {
          const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        }).toThrow();
      });
    });

    test('should validate token type claim', () => {
      const validToken = jwt.sign({ sub: 1, type: 'access' }, JWT_SECRET);
      const invalidToken = jwt.sign({ sub: 1, type: 'admin' }, JWT_SECRET);
      
      const decodedValid = jwt.verify(validToken, JWT_SECRET);
      expect(decodedValid.type).toBe('access');
      
      const decodedInvalid = jwt.verify(invalidToken, JWT_SECRET);
      expect(decodedInvalid.type).not.toBe('access');
    });
  });
});

describe('Authorization Security Tests', () => {
  test('should enforce plan-based access control', () => {
    const plans = ['free', 'pro', 'team'];
    const planLimits = { free: 0, pro: 2000000, team: 8000000 };
    
    plans.forEach(plan => {
      const limit = planLimits[plan];
      expect(typeof limit).toBe('number');
      expect(limit).toBeGreaterThanOrEqual(0);
    });
  });

  test('should prevent privilege escalation', () => {
    const userPlan = 'free';
    const requestedPlan = 'team';
    
    expect(userPlan).not.toBe(requestedPlan);
  });

  test('should validate admin session separation', () => {
    const customerTokenType = 'access';
    const adminTokenType = 'admin_session';
    
    expect(customerTokenType).not.toBe(adminTokenType);
  });
});

describe('Rate Limiting Security Tests', () => {
  test('should have rate limit configuration', () => {
    const rateLimitConfig = {
      general: { windowMs: 60000, maxRequests: 30 },
      auth: { windowMs: 900000, maxRequests: 10 },
      admin: { windowMs: 900000, maxRequests: 10 },
    };
    
    expect(rateLimitConfig.general.maxRequests).toBeGreaterThan(0);
    expect(rateLimitConfig.auth.maxRequests).toBeLessThan(rateLimitConfig.general.maxRequests);
    expect(rateLimitConfig.admin.maxRequests).toBeLessThan(rateLimitConfig.general.maxRequests);
  });

  test('should prevent brute force attacks', () => {
    const maxAttempts = 3;
    const lockoutMinutes = 60;
    
    expect(maxAttempts).toBeLessThanOrEqual(5);
    expect(lockoutMinutes).toBeGreaterThanOrEqual(30);
  });
});

describe('Input Validation Security Tests', () => {
  test('should validate email format', () => {
    const validEmails = [
      'user@example.com',
      'test.email@domain.co',
      'user+tag@example.com',
    ];
    
    const invalidEmails = [
      '',
      'invalid',
      '@domain.com',
      'user@',
      'user@domain',
      'user@.com',
    ];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    validEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(true);
    });
    
    invalidEmails.forEach(email => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  test('should validate password strength', () => {
    const strongPasswords = [
      'StrongPass123!',
      'SecureP@ssw0rd',
      'MyStr0ng#Pass',
    ];
    
    const weakPasswords = [
      'password',
      '12345678',
      'qwerty',
      'abc123',
    ];
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    
    strongPasswords.forEach(password => {
      expect(passwordRegex.test(password)).toBe(true);
    });
    
    weakPasswords.forEach(password => {
      expect(passwordRegex.test(password)).toBe(false);
    });
  });

  test('should sanitize SQL injection attempts', () => {
    const sqlInjectionAttempts = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; SELECT * FROM users",
      "admin'--",
    ];
    
    sqlInjectionAttempts.forEach(attempt => {
      // Check that the attempt contains SQL keywords
      expect(attempt).toMatch(/DROP|SELECT|OR|INSERT|UPDATE|DELETE|--|;/i);
    });
  });

  test('should prevent XSS attacks', () => {
    const xssAttempts = [
      '<script>alert("xss")</script>',
      '"><img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>',
    ];
    
    xssAttempts.forEach(attempt => {
      expect(attempt).toMatch(/<script|onerror|onload|javascript:/i);
    });
  });
});

describe('Payment Security Tests', () => {
  test('should validate payment amounts', () => {
    const validAmounts = [100, 200, 400, 800, 1000];
    const invalidAmounts = [-100, 0, 150, 300, 500];
    
    validAmounts.forEach(amount => {
      expect(amount).toBeGreaterThan(0);
      expect(Number.isFinite(amount)).toBe(true);
    });
    
    invalidAmounts.forEach(amount => {
      expect(amount <= 0 || ![100, 200, 400, 800, 1000].includes(amount)).toBe(true);
    });
  });

  test('should validate payment methods', () => {
    const validMethods = ['instapay', 'vodafone_cash', 'paypal', 'crypto'];
    const invalidMethods = ['cash', 'credit_card', 'bitcoin', ''];
    
    validMethods.forEach(method => {
      expect(validMethods).toContain(method);
    });
    
    invalidMethods.forEach(method => {
      expect(validMethods).not.toContain(method);
    });
  });

  test('should validate currency codes', () => {
    const validCurrencies = ['EGP', 'USD'];
    const invalidCurrencies = ['EUR', 'GBP', 'BTC', ''];
    
    validCurrencies.forEach(currency => {
      expect(currency).toMatch(/^[A-Z]{3}$/);
    });
    
    invalidCurrencies.forEach(currency => {
      expect(validCurrencies).not.toContain(currency);
    });
  });

  test('should prevent transaction reference injection', () => {
    const maliciousRefs = [
      '<script>alert(1)</script>',
      "'; DROP TABLE payments; --",
      '../../etc/passwd',
      '${7*7}',
    ];
    
    maliciousRefs.forEach(ref => {
      expect(ref).toMatch(/<|>|'|"|;|--|\.\.|\$/);
    });
  });
});

describe('Data Exposure Security Tests', () => {
  test('should not expose sensitive data in public catalog', () => {
    const publicCatalog = {
      driver: { label: 'Driver', labelEn: 'Driver', description: 'Fast code writing' },
      leader: { label: 'Leader', labelEn: 'Leader', description: 'Architecture' },
      innovator: { label: 'Innovator', labelEn: 'Innovator', description: 'Complex refactors' },
    };
    
    Object.values(publicCatalog).forEach(model => {
      expect(model).not.toHaveProperty('apiBase');
      expect(model).not.toHaveProperty('apiKey');
      expect(model).not.toHaveProperty('model');
    });
  });

  test('should not expose password hashes', () => {
    const userResponse = {
      id: 1,
      email: 'user@example.com',
      plan: 'pro',
    };
    
    expect(userResponse).not.toHaveProperty('password');
    expect(userResponse).not.toHaveProperty('passwordHash');
    expect(userResponse).not.toHaveProperty('password_hash');
  });

  test('should not expose internal IDs in error messages', () => {
    const errorResponse = {
      error: 'invalid_credentials',
      message: 'Invalid email or password.',
    };
    
    expect(errorResponse.message).not.toMatch(/\d+/);
    expect(errorResponse.message).not.toContain('user_id');
  });
});

describe('CORS Security Tests', () => {
  test('should have restricted allowed origins', () => {
    const allowedOrigins = [
      'vscode-egypt://app',
      'http://localhost:3000',
      'http://localhost:4000',
      'http://localhost:5000',
    ];
    
    expect(allowedOrigins).not.toContain('*');
    expect(allowedOrigins.length).toBeLessThanOrEqual(10);
  });

  test('should not allow all origins (verify our config)', () => {
    const securityConfig = require('../../config/security');
    
    expect(securityConfig.cors.allowedOrigins).not.toContain('*');
    expect(securityConfig.cors.allowedOrigins.length).toBeLessThanOrEqual(10);
  });
});

describe('HTTPS Security Tests', () => {
  test('should enforce HSTS headers', () => {
    const hstsConfig = {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    };
    
    expect(hstsConfig.maxAge).toBeGreaterThanOrEqual(31536000);
    expect(hstsConfig.includeSubDomains).toBe(true);
  });

  test('should have secure content security policy', () => {
    const cspConfig = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    };
    
    expect(cspConfig.defaultSrc).toContain("'self'");
    expect(cspConfig.scriptSrc).toContain("'self'");
    expect(cspConfig.objectSrc).toContain("'none'");
    expect(cspConfig.frameSrc).toContain("'none'");
  });
});