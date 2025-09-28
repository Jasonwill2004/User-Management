const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

// FEATURE: Email-based account activation flow
class AccountActivationService {
  constructor() {
    // In-memory storage for activation tokens (in production, use Redis or database)
    this.activationTokens = new Map();
    
    // Setup email transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'demo@example.com',
        pass: process.env.EMAIL_PASS || 'demo-password'
      }
    });
  }

  // Generate secure activation token
  generateActivationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create activation request
  async createActivationRequest(email, userId) {
    try {
      const token = this.generateActivationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      // Store token with expiration
      this.activationTokens.set(token, {
        email,
        userId,
        expiresAt,
        used: false,
        createdAt: new Date()
      });

      // In demo mode, just log the token instead of sending email
      if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER) {
        logger.info('ACTIVATION_TOKEN_GENERATED', {
          email,
          userId,
          token,
          expiresAt,
          message: 'In production, this would be sent via email'
        });
        
        return {
          success: true,
          message: 'Activation instructions sent to your email',
          devToken: token // Only for development
        };
      }

      // Send activation email
      const activationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/activate?token=${token}`;
      
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@userapi.com',
        to: email,
        subject: 'Account Activation - User Management API',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome! Please Activate Your Account</h2>
            <p>Thank you for registering with User Management API.</p>
            <p>To complete your registration, please click the link below to activate your account:</p>
            <a href="${activationLink}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Activate Account</a>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create this account, please ignore this email.</p>
            <hr>
            <small>User Management API - Account Security</small>
          </div>
        `
      });

      logger.info('ACTIVATION_EMAIL_SENT', { email, userId });
      
      return {
        success: true,
        message: 'Activation instructions sent to your email'
      };
    } catch (error) {
      logger.error('ACTIVATION_EMAIL_ERROR', { email, userId, error: error.message });
      throw new Error('Failed to send activation email');
    }
  }


  validateActivationToken(token) {
    const tokenData = this.activationTokens.get(token);
    
    if (!tokenData) {
      return { valid: false, reason: 'Token not found' };
    }
    
    if (tokenData.used) {
      return { valid: false, reason: 'Token already used' };
    }
    
    if (new Date() > tokenData.expiresAt) {
      this.activationTokens.delete(token);
      return { valid: false, reason: 'Token expired' };
    }
    
    return { valid: true, email: tokenData.email, userId: tokenData.userId };
  }

  // Activate account with token
  async activateAccount(token) {
    const validation = this.validateActivationToken(token);
    
    if (!validation.valid) {
      throw new Error(`Invalid activation token: ${validation.reason}`);
    }

    // Mark token as used
    const tokenData = this.activationTokens.get(token);
    tokenData.used = true;
    
    logger.info('ACCOUNT_ACTIVATED', { 
      email: validation.email,
      userId: validation.userId,
      timestamp: new Date().toISOString()
    });
    
    // Clean up used token after 5 minutes
    setTimeout(() => {
      this.activationTokens.delete(token);
    }, 5 * 60 * 1000);
    
    return { email: validation.email, userId: validation.userId };
  }

  // Resend activation email
  async resendActivation(email, userId) {
    // Remove any existing tokens for this user
    for (const [token, data] of this.activationTokens.entries()) {
      if (data.email === email && data.userId === userId) {
        this.activationTokens.delete(token);
      }
    }
    
    return await this.createActivationRequest(email, userId);
  }


  cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of this.activationTokens.entries()) {
      if (now > data.expiresAt) {
        this.activationTokens.delete(token);
      }
    }
    logger.info('EXPIRED_ACTIVATION_TOKENS_CLEANED', { 
      remaining: this.activationTokens.size 
    });
  }
}

// Singleton instance
const accountActivationService = new AccountActivationService();

// Cleanup expired tokens every hour (only in production)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    accountActivationService.cleanupExpiredTokens();
  }, 60 * 60 * 1000);
}

module.exports = accountActivationService;