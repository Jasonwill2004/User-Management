const { sanitizeInput, userValidationRules, validateRequest } = require('../middleware/security');
const express = require('express');
const request = require('supertest');

// BONUS: Unit tests for security middleware
describe('Security Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('sanitizeInput middleware', () => {
    beforeEach(() => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => {
        res.json({ body: req.body, query: req.query });
      });
    });

    it('should sanitize XSS attempts in request body', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: '<script>alert("xss")</script>John',
          email: 'test@example.com'
        });

      expect(response.body.body.name).not.toContain('<script>');
      expect(response.body.body.name).toContain('&lt;script&gt;');
    });

    it('should remove MongoDB injection operators', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          email: { $ne: null },
          password: { $regex: '.*' }
        });

      expect(response.body.body.email).not.toHaveProperty('$ne');
      expect(response.body.body.password).not.toHaveProperty('$regex');
    });

    it('should sanitize query parameters', async () => {
      const response = await request(app)
        .post('/test?search=<img src="x" onerror="alert(1)">')
        .send({ test: 'data' });

      expect(response.body.query.search).not.toContain('<img');
      expect(response.body.query.search).toContain('&lt;img');
    });
  });

  describe('userValidationRules', () => {
    beforeEach(() => {
      const validationRules = userValidationRules();
      app.post('/test', validationRules, validateRequest, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should accept valid user data', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          password: 'Password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should reject names with invalid characters', async () => {
      const response = await request(app)
        .post('/test')
        .send({
          name: 'John123',
          email: 'john@example.com',
          password: 'Password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });
});