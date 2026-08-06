const { MODEL_CATALOG, getModelConfig, getPublicCatalog } = require('../../config/models');

describe('Models Configuration', () => {
  describe('MODEL_CATALOG', () => {
    test('should have all required model aliases', () => {
      expect(MODEL_CATALOG).toHaveProperty('driver');
      expect(MODEL_CATALOG).toHaveProperty('leader');
      expect(MODEL_CATALOG).toHaveProperty('innovator');
    });

    test('should have correct structure for each model', () => {
      Object.values(MODEL_CATALOG).forEach(model => {
        expect(model).toHaveProperty('label');
        expect(model).toHaveProperty('labelEn');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('apiBase');
        expect(model).toHaveProperty('model');
        expect(typeof model.label).toBe('string');
        expect(typeof model.labelEn).toBe('string');
        expect(typeof model.description).toBe('string');
        expect(typeof model.apiBase).toBe('string');
        expect(typeof model.model).toBe('string');
      });
    });

    test('should have Arabic labels', () => {
      expect(MODEL_CATALOG.driver.label).toBe('السائق');
      expect(MODEL_CATALOG.leader.label).toBe('القائد');
      expect(MODEL_CATALOG.innovator.label).toBe('المبتكر');
    });

    test('should have English labels', () => {
      expect(MODEL_CATALOG.driver.labelEn).toBe('Driver');
      expect(MODEL_CATALOG.leader.labelEn).toBe('Leader');
      expect(MODEL_CATALOG.innovator.labelEn).toBe('Innovator');
    });
  });

  describe('getModelConfig', () => {
    test('should return config for valid alias', () => {
      const config = getModelConfig('driver');
      expect(config).toBeDefined();
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('apiBase');
    });

    test('should return null for invalid alias', () => {
      const config = getModelConfig('invalid');
      expect(config).toBeNull();
    });

    test('should return unconfigured when apiKey is missing', () => {
      // Save original env
      const originalEnv = process.env.DRIVER_API_KEY;
      delete process.env.DRIVER_API_KEY;
      
      const config = getModelConfig('driver');
      expect(config).toBeDefined();
      expect(config.unconfigured).toBe(true);
      
      // Restore env
      if (originalEnv) {
        process.env.DRIVER_API_KEY = originalEnv;
      }
    });

    test('should return config with apiKey when set', () => {
      const originalEnv = process.env.DRIVER_API_KEY;
      process.env.DRIVER_API_KEY = 'test-key';
      
      // Need to re-require to get fresh values
      delete require.cache[require.resolve('../../config/models')];
      const models = require('../../config/models');
      const config = models.getModelConfig('driver');
      
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('test-key');
      expect(config.unconfigured).toBeUndefined();
      
      // Restore env
      if (originalEnv) {
        process.env.DRIVER_API_KEY = originalEnv;
      } else {
        delete process.env.DRIVER_API_KEY;
      }
    });
  });

  describe('getPublicCatalog', () => {
    test('should return catalog with labels and descriptions only', () => {
      const catalog = getPublicCatalog();
      
      expect(catalog).toHaveProperty('driver');
      expect(catalog).toHaveProperty('leader');
      expect(catalog).toHaveProperty('innovator');
      
      Object.values(catalog).forEach(model => {
        expect(model).toHaveProperty('label');
        expect(model).toHaveProperty('labelEn');
        expect(model).toHaveProperty('description');
        expect(model).not.toHaveProperty('apiBase');
        expect(model).not.toHaveProperty('apiKey');
        expect(model).not.toHaveProperty('model');
      });
    });

    test('should not expose sensitive information', () => {
      const catalog = getPublicCatalog();
      
      Object.values(catalog).forEach(model => {
        expect(model).not.toHaveProperty('apiBase');
        expect(model).not.toHaveProperty('apiKey');
      });
    });
  });
});