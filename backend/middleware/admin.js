/**
 * Middleware для проверки роли администратора
 *
 * Логика:
 * 1. Проверяет наличие JWT-токена (через authMiddleware)
 * 2. Проверяет поле role в базе данных (должно быть 'admin')
 * 3. Если admin — передаёт управление дальше
 * 4. Если нет — возвращает 403
 *
 * Использование:
 *   router.get('/admin/users', authMiddleware, adminMiddleware, adminController.getAllUsers);
 */

const authMiddleware = require('./auth');
const User = require('../models/User');

async function adminMiddleware(req, res, next) {
  try {
    // Сначала проверяем аутентификацию
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Получаем полные данные пользователя для проверки role
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем роль администратора
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
    }

    // Добавляем флаг админа в req для удобства
    req.isAdmin = true;

    next();
  } catch (err) {
    if (err.status === 401) {
      // Ошибка аутентификации уже обработана в authMiddleware
      return;
    }
    next(err);
  }
}

module.exports = adminMiddleware;
