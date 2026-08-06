// Security configuration for VS Code Egypt Backend
// Centralizes all security-related settings

module.exports = {
    // JWT Configuration
    jwt: {
        accessTokenTTL: '15m',
        refreshTokenTTLDays: 7,
        algorithm: 'HS256',
        maxTokenSize: 2048,
    },

    // Admin Authentication
    admin: {
        sessionTTL: '4h',
        maxLoginAttempts: 3,
        lockoutMinutes: 60,
        minPasscodeLength: 8,
        passcodeRegex: /^[0-9]+$/,
    },

    // Rate Limiting
    rateLimit: {
        general: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 30,
        },
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 10,
        },
        admin: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 10,
        },
    },

    // Password Policy
    password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false, // Optional for now
        bcryptRounds: 12,
    },

    // CORS Configuration
    cors: {
        allowedOrigins: [
            'vscode-egypt://app',
            'http://localhost:3000',
            'http://localhost:4000',
            'http://localhost:5000',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400, // 24 hours
    },

    // Security Headers
    headers: {
        contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: 'strict-origin-when-cross-origin',
    },

    // Request Limits
    requestLimits: {
        jsonBodyLimit: '1mb',
        timeoutMs: 30000, // 30 seconds
    },

    // Logging
    logging: {
        logFailedAttempts: true,
        logSuccessfulAttempts: true,
        logSecurityEvents: true,
        logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },

    // Session Management
    session: {
        maxSessionsPerUser: 5, // Maximum concurrent sessions
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        cleanupInterval: 60 * 60 * 1000, // 1 hour
    },

    // API Security
    api: {
        maxRequestSize: 1024 * 1024, // 1MB
        timeout: 30000, // 30 seconds
        enableRequestLogging: true,
        enableSecurityHeaders: true,
    },
};