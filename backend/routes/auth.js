const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Имя должно быть от 3 до 50 символов')
    .matches(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/).withMessage('Имя может содержать только буквы, цифры и _'),
  body('email').trim().isEmail().withMessage('Введите корректный email').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Пароль должен содержать минимум 8 символов'),
], handleValidationErrors, authController.register);

router.post('/login', [
  body('email').trim().isEmail().withMessage('Введите корректный email').normalizeEmail(),
  body('password').notEmpty().withMessage('Введите пароль'),
], handleValidationErrors, authController.login);

router.get('/me', authMiddleware, authController.getMe);

module.exports = router;