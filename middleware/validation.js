const validator = require('validator');

// BUG FIXED: Email validation using validator library for proper format checking
const validateEmail = (email) => {
  if (!email) {
    return { isValid: false, message: 'Email is required' };
  }
  
  if (!validator.isEmail(email)) {
    return { isValid: false, message: 'Invalid email format' };
  }
  
  return { isValid: true };
};

// BUG FIXED: Password validation with strength requirements (min 6 chars, letters + numbers)
const validatePassword = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' };
  }
  
  // BUG FIXED: Password strength check - requires letters and numbers
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter and one number' };
  }
  
  return { isValid: true };
};

// Name validation
const validateName = (name) => {
  if (!name) {
    return { isValid: false, message: 'Name is required' };
  }
  
  if (name.length < 2) {
    return { isValid: false, message: 'Name must be at least 2 characters long' };
  }
  
  if (name.length > 50) {
    return { isValid: false, message: 'Name must be less than 50 characters' };
  }
  
  return { isValid: true };
};

// Role validation
const validateRole = (role) => {
  const validRoles = ['user', 'admin'];
  
  if (role && !validRoles.includes(role)) {
    return { isValid: false, message: 'Invalid role. Must be either "user" or "admin"' };
  }
  
  return { isValid: true };
};

// Login validation middleware
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({ error: emailValidation.message });
  }
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  next();
};

// Registration validation middleware
const validateRegistration = (req, res, next) => {
  const { email, password, name, role } = req.body;
  
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({ error: emailValidation.message });
  }
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ error: passwordValidation.message });
  }
  
  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    return res.status(400).json({ error: nameValidation.message });
  }
  
  const roleValidation = validateRole(role);
  if (!roleValidation.isValid) {
    return res.status(400).json({ error: roleValidation.message });
  }
  
  next();
};

// User update validation middleware
const validateUserUpdate = (req, res, next) => {
  const { email, name, role, password } = req.body;
  
  if (email !== undefined) {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ error: emailValidation.message });
    }
  }
  
  if (name !== undefined) {
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.message });
    }
  }
  
  if (role !== undefined) {
    const roleValidation = validateRole(role);
    if (!roleValidation.isValid) {
      return res.status(400).json({ error: roleValidation.message });
    }
  }
  
  if (password !== undefined) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.message });
    }
  }
  
  next();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateRole,
  validateLogin,
  validateRegistration,
  validateUserUpdate
};