const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');

// Simple token-based auth (demo purposes)
const tokens = new Map();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = queryOne('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = `token_${user.id}_${Date.now()}`;
  tokens.set(token, user.id);

  runSql('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      email: user.email
    }
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = tokens.get(token);
  const user = queryOne('SELECT id, username, full_name, role, department, email, last_login, status FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) tokens.delete(token);
  res.json({ message: 'Logged out' });
});

// Auth middleware
function authMiddleware(req, res, next) {
  // ─── ZTA Gateway trust ───
  // If this request came through the ZTA gateway (X-ZTA-Verified: true),
  // use the ZTA user identity headers instead of the in-memory token map.
  // This prevents auth failures caused by the token map being wiped on container restart.
  if (req.headers['x-zta-verified'] === 'true') {
    const userId = req.headers['x-zta-user-id'];
    const username = req.headers['x-zta-username'];
    if (userId || username) {
      let user = userId ? queryOne('SELECT * FROM users WHERE id = ?', [userId]) : null;
      if (!user && username) user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
      if (user) {
        req.user = user;
        return next();
      }
    }
    // ZTA verified but user not in banking DB — construct minimal context
    req.user = {
      id: req.headers['x-zta-user-id'] || 'zta_user',
      username: req.headers['x-zta-username'] || 'zta_user',
      role: req.headers['x-zta-role'] || 'user',
      full_name: req.headers['x-zta-username'] || 'ZTA User'
    };
    return next();
  }

  // ─── Standard token-based auth ───
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = tokens.get(token);
  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  req.user = user;
  next();
}

module.exports = { router, authMiddleware, tokens };
