const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

// FEATURE: Password reset functionality with secure tokens
class PasswordResetService {
  constructor() {
    // In-memory storage for reset tokens (in production, use Redis or database)
    this.resetTokens = new Map();
    
    // Setup email transporter (using Gmail for demo - configure with real SMTP)
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'demo@example.com',
        pass: process.env.EMAIL_PASS || 'demo-password'
      }
    });
  }

  // Generate secure reset token
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create password reset request
  async createResetRequest(email) {
    try {
      const token = this.generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Store token with expiration
      this.resetTokens.set(token, {
        email,
        expiresAt,
        used: false,
        createdAt: new Date()
      });

      // In demo mode, just log the token instead of sending email
      if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER) {
        logger.info('PASSWORD_RESET_TOKEN_GENERATED', {
          email,
          token,
          expiresAt,
          message: 'In production, this would be sent via email'
        });
        
        return {
          success: true,
          message: 'Password reset instructions sent to your email',
          devToken: token // Only for development
        };
      }

      // Send email with reset link
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@userapi.com',
        to: email,
        subject: 'Password Reset Request - User Management API',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this reset, please ignore this email.</p>
            <hr>
            <small>User Management API - Secure Password Reset</small>
          </div>
        `
      });

      logger.info('PASSWORD_RESET_EMAIL_SENT', { email });
      
      return {
        success: true,
        message: 'Password reset instructions sent to your email'
      };
    } catch (error) {
      logger.error('PASSWORD_RESET_ERROR', { email, error: error.message });
      throw new Error('Failed to process password reset request');
    }
  }

  // Validate reset token
  validateResetToken(token) {
    const tokenData = this.resetTokens.get(token);
    
    if (!tokenData) {
      return { valid: false, reason: 'Token not found' };
    }
    
    if (tokenData.used) {
      return { valid: false, reason: 'Token already used' };
    }
    
    if (new Date() > tokenData.expiresAt) {
      this.resetTokens.delete(token);
      return { valid: false, reason: 'Token expired' };
    }
    
    return { valid: true, email: tokenData.email };
  }

  // Reset password with token
  async resetPassword(token, newPassword) {
    const validation = this.validateResetToken(token);
    
    if (!validation.valid) {
      throw new Error(`Invalid reset token: ${validation.reason}`);
    }

    // Mark token as used
    const tokenData = this.resetTokens.get(token);
    tokenData.used = true;
    
    logger.info('PASSWORD_RESET_COMPLETED', { 
      email: validation.email,
      timestamp: new Date().toISOString()
    });
    
    // Clean up used token after 5 minutes
    setTimeout(() => {
      this.resetTokens.delete(token);
    }, 5 * 60 * 1000);
    
    return validation.email;
  }

  // Cleanup expired tokens (run periodically)
  cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expiresAt) {
        this.resetTokens.delete(token);
      }
    }
    logger.info('EXPIRED_TOKENS_CLEANED', { 
      remaining: this.resetTokens.size 
    });
  }
}

// Singleton instance
const passwordResetService = new PasswordResetService();

// Cleanup expired tokens every 30 minutes (only in production)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    passwordResetService.cleanupExpiredTokens();
  }, 30 * 60 * 1000);
}

module.exports = passwordResetService;