const passwordResetService = require('../services/passwordReset');
const accountActivationService = require('../services/accountActivation');

// BONUS: Unit tests for service functions
describe('Password Reset Service', () => {
  beforeEach(() => {
    // Clear any existing tokens
    passwordResetService.resetTokens.clear();
  });

  describe('createResetRequest', () => {
    it('should generate reset token in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await passwordResetService.createResetRequest('test@example.com');
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('devToken');
      expect(result.message).toContain('Password reset instructions');
    });

    it('should store token with expiration', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await passwordResetService.createResetRequest('test@example.com');
      const validation = passwordResetService.validateResetToken(result.devToken);
      
      expect(validation.valid).toBe(true);
      expect(validation.email).toBe('test@example.com');
    });
  });

  describe('validateResetToken', () => {
    it('should reject non-existent token', () => {
      const validation = passwordResetService.validateResetToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token not found');
    });

    it('should reject used token', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await passwordResetService.createResetRequest('test@example.com');
      await passwordResetService.resetPassword(result.devToken, 'newpassword');
      
      const validation = passwordResetService.validateResetToken(result.devToken);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token already used');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await passwordResetService.createResetRequest('test@example.com');
      const email = await passwordResetService.resetPassword(result.devToken, 'newpassword');
      
      expect(email).toBe('test@example.com');
    });

    it('should reject invalid token for reset', async () => {
      await expect(
        passwordResetService.resetPassword('invalid-token', 'newpassword')
      ).rejects.toThrow('Invalid reset token');
    });
  });
});

describe('Account Activation Service', () => {
  beforeEach(() => {
    // Clear any existing tokens
    accountActivationService.activationTokens.clear();
  });

  describe('createActivationRequest', () => {
    it('should generate activation token in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await accountActivationService.createActivationRequest('test@example.com', 'user123');
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('devToken');
      expect(result.message).toContain('Activation instructions');
    });
  });

  describe('validateActivationToken', () => {
    it('should validate correct token', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await accountActivationService.createActivationRequest('test@example.com', 'user123');
      const validation = accountActivationService.validateActivationToken(result.devToken);
      
      expect(validation.valid).toBe(true);
      expect(validation.email).toBe('test@example.com');
      expect(validation.userId).toBe('user123');
    });

    it('should reject invalid token', () => {
      const validation = accountActivationService.validateActivationToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Token not found');
    });
  });

  describe('activateAccount', () => {
    it('should activate account with valid token', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await accountActivationService.createActivationRequest('test@example.com', 'user123');
      const activation = await accountActivationService.activateAccount(result.devToken);
      
      expect(activation.email).toBe('test@example.com');
      expect(activation.userId).toBe('user123');
    });

    it('should reject invalid token for activation', async () => {
      await expect(
        accountActivationService.activateAccount('invalid-token')
      ).rejects.toThrow('Invalid activation token');
    });
  });

  describe('resendActivation', () => {
    it('should resend activation for existing user', async () => {
      process.env.NODE_ENV = 'development';
      
      // Create initial activation
      await accountActivationService.createActivationRequest('test@example.com', 'user123');
      
      // Resend activation
      const result = await accountActivationService.resendActivation('test@example.com', 'user123');
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('devToken');
    });
  });
});