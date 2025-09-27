// BUG FIXED: Centralized user data store to prevent duplication across route files
let users = [
  {
    id: '1',
    email: 'admin@test.com',
    password: '$2a$10$JZU8UlU8vvKztkaRF.ELGue8d6wflB5nBifeEPEG1pfi2rmWLtmgi', // BUG FIXED: Proper bcrypt hash for 'admin123'
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: '2',
    email: 'user@test.com', 
    password: '$2a$10$.cXRugE6yXleQt6UqzVuPu4x6cAAqQGbiCE1A5mDIVWmeDr8uTmrG', // BUG FIXED: Proper bcrypt hash for 'user123'
    name: 'Regular User',
    role: 'user',
    createdAt: new Date('2024-01-02').toISOString()
  }
];

module.exports = {
  users,
  getUsers: () => users,
  addUser: (user) => users.push(user),
  findUserByEmail: (email) => users.find(u => u.email === email),
  findUserById: (id) => users.find(u => u.id === id),
  updateUser: (id, updateData) => {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updateData };
      return users[userIndex];
    }
    return null;
  },
  deleteUser: (id) => {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      return users.splice(userIndex, 1)[0];
    }
    return null;
  }
};