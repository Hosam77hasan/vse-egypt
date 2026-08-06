const securityConfig = require('../../config/security');

describe('Security Configuration', () => {
  describe('JWT Configuration', () => {
    test('should have valid JWT settings', () => {
      expect(securityConfig.jwt).toBeDefined();
      expect(securityConfig.jwt.accessTokenTTL).toBe('15m');
      expect(securityConfig.jwt.refreshTokenTTLDays).toBe(7);
      expect(securityConfig.jwt.algorithm).toBe('HS256');
      expect(securityConfig.jwt.maxTokenSize).toBe(2048);
    });
  });

  describe('Admin Authentication', () => {
    test('should have valid admin settings', () => {
      expect(securityConfig.admin).toBeDefined();
      expect(securityConfig.admin.sessionTTL).toBe('4h');
      expect(securityConfig.admin.maxLoginAttempts).toBe(3);
      expect(securityConfig.admin.lockoutMinutes).toBe(60);
      expect(securityConfig.admin.minPasscodeLength).toBe(8);
      expect(securityConfig.admin.passcodeRegex).toBeInstanceOf(RegExp);
    });

    test('should validate passcode regex correctly', () => {
      const regex = securityConfig.admin.passcodeRegex;
      expect(regex.test('12345678')).toBe(true);
      expect(regex.test('87654321')).toBe(true);
      expect(regex.test('1234567890123456')).toBe(true);
      expect(regex.test('abcdefg')).toBe(false);
      expect(regex.test('1234567a')).toBe(false);
      expect(regex.test('1234567!')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should have valid rate limit settings', () => {
      expect(securityConfig.rateLimit).toBeDefined();
      expect(securityConfig.rateLimit.general).toBeDefined();
      expect(securityConfig.rateLimit.auth).toBeDefined();
      expect(securityConfig.rateLimit.admin).toBeDefined();
    });

    test('should have correct general rate limits', () => {
      expect(securityConfig.rateLimit.general.windowMs).toBe(60000); // 1 minute
      expect(securityConfig.rateLimit.general.maxRequests).toBe(30);
    });

    test('should have correct auth rate limits', () => {
      expect(securityConfig.rateLimit.auth.windowMs).toBe(900000); // 15 minutes
      expect(securityConfig.rateLimit.auth.maxRequests).toBe(10);
    });

    test('should have correct admin rate limits', () => {
      expect(securityConfig.rateLimit.admin.windowMs).toBe(900000); // 15 minutes
      expect(securityConfig.rateLimit.admin.maxRequests).toBe(10);
    });
  });

  describe('Password Policy', () => {
    test('should have valid password settings', () => {
      expect(securityConfig.password).toBeDefined();
      expect(securityConfig.password.minLength).toBe(8);
      expect(securityConfig.password.maxLength).toBe(128);
      expect(securityConfig.password.requireUppercase).toBe(true);
      expect(securityConfig.password.requireLowercase).toBe(true);
      expect(securityConfig.password.requireNumbers).toBe(true);
      expect(securityConfig.password.bcryptRounds).toBe(12);
    });
  });

  describe('CORS Configuration', () => {
    test('should have valid CORS settings', () => {
      expect(securityConfig.cors).toBeDefined();
      expect(Array.isArray(securityConfig.cors.allowedOrigins)).toBe(true);
      expect(securityConfig.cors.allowedOrigins.length).toBeGreaterThan(0);
      expect(securityConfig.cors.methods).toContain('GET');
      expect(securityConfig.cors.methods).toContain('POST');
      expect(securityConfig.cors.credentials).toBe(true);
    });

    test('should include required origins', () => {
      expect(securityConfig.cors.allowedOrigins).toContain('vscode-egypt://app');
      expect(securityConfig.cors.allowedOrigins).toContain('http://localhost:3000');
    });
  });

  describe('Security Headers', () => {
    test('should have valid CSP settings', () => {
      expect(securityConfig.headers.contentSecurityPolicy).toBeDefined();
      expect(securityConfig.headers.contentSecurityPolicy.defaultSrc).toContain("'self'");
      expect(securityConfig.headers.contentSecurityPolicy.scriptSrc).toContain("'self'");
      expect(securityConfig.headers.contentSecurityPolicy.objectSrc).toContain("'none'");
      expect(securityConfig.headers.contentSecurityPolicy.frameSrc).toContain("'none'");
    });

    test('should have valid HSTS settings', () => {
      expect(securityConfig.headers.hsts).toBeDefined();
      expect(securityConfig.headers.hsts.maxAge).toBe(31536000);
      expect(securityConfig.headers.hsts.includeSubDomains).toBe(true);
      expect(securityConfig.headers.hsts.preload).toBe(true);
    });
  });

  describe('Request Limits', () => {
    test('should have valid request limits', () => {
      expect(securityConfig.requestLimits).toBeDefined();
      expect(securityConfig.requestLimits.jsonBodyLimit).toBe('1mb');
      expect(securityConfig.requestLimits.timeoutMs).toBe(30000);
    });
  });

  describe('Logging', () => {
    test('should have valid logging settings', () => {
      expect(securityConfig.logging).toBeDefined();
      expect(securityConfig.logging.logFailedAttempts).toBe(true);
      expect(securityConfig.logging.logSuccessfulAttempts).toBe(true);
      expect(securityConfig.logging.logSecurityEvents).toBe(true);
    });
  });

  describe('Session Management', () => {
    test('should have valid session settings', () => {
      expect(securityConfig.session).toBeDefined();
      expect(securityConfig.session.maxSessionsPerUser).toBe(5);
      expect(securityConfig.session.sessionTimeout).toBe(86400000); // 24 hours
      expect(securityConfig.session.cleanupInterval).toBe(3600000); // 1 hour
    });
  });

  describe('API Security', () => {
    test('should have valid API settings', () => {
      expect(securityConfig.api).toBeDefined();
      expect(securityConfig.api.maxRequestSize).toBe(1048576); // 1MB
      expect(securityConfig.api.timeout).toBe(30000);
      expect(securityConfig.api.enableRequestLogging).toBe(true);
      expect(securityConfig.api.enableSecurityHeaders).toBe(true);
    });
  });
});