const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_this_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

const authController = {
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
      }
      const user = await User.create({ username, email, password });
      const token = generateToken(user);
      res.status(201).json({
        message: 'Регистрация успешна',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          bio: user.bio,
          is_admin: user.is_admin,
        },
      });
    } catch (err) {
      if (err.code === '23505') {
        if (err.constraint?.includes('username')) {
          return res.status(409).json({ error: 'Это имя пользователя уже занято' });
        }
      }
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }
      const isValid = await User.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }
      const token = generateToken(user);
      res.json({
        message: 'Вход выполнен успешно',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          bio: user.bio,
          is_admin: user.is_admin,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        bio: user.bio,
        is_admin: user.is_admin,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;