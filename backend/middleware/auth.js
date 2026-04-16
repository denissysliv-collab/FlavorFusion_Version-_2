/**
 * Middleware для проверки JWT-токена
 * 
 * Логика:
 * 1. Извлекаем токен из заголовка Authorization: Bearer <token>
 * 2. Верифицируем токен
 * 3. Если валиден — записываем user.id в req.user и передаём управление дальше
 * 4. Если невалиден — возвращаем 401
 * 
 * Использование:
 *   - Для защищённых маршрутов: authMiddleware(req, res, next)
 *   - Для опциональной аутентификации: authMiddleware.optional(req, res, next)
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_this_in_production';

/** Обязательная аутентификация */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Проверяем наличие заголовка
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен. Войдите в систему.' });
    }

    // Извлекаем токен
    const token = authHeader.split(' ')[1];

    // Верифицируем токен
    const decoded = jwt.verify(token, JWT_SECRET);

    // Записываем ID пользователя в запрос
    req.user = { id: decoded.id };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк. Войдите заново.' });
    }
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

/** Проверка роли администратора */
function checkAdmin(req, res, next) {
  const pool = require('../database/pool');
  
  pool.query('SELECT role, is_blocked FROM users WHERE id = $1', [req.user.id])
    .then(result => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      const user = result.rows[0];
      
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Аккаунт заблокирован',
          blocked: true 
        });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Доступ запрещён. Требуются права администратора.',
          adminRequired: true 
        });
      }
      
      req.userRole = user.role;
      req.userIsBlocked = user.is_blocked;
      next();
    })
    .catch(err => {
      console.error('Ошибка проверки прав администратора:', err);
      res.status(500).json({ error: 'Ошибка сервера при проверке прав' });
    });
}

/** Проверка на блокировку пользователя */
function checkNotBlocked(req, res, next) {
  const pool = require('../database/pool');
  
  pool.query('SELECT is_blocked, block_reason FROM users WHERE id = $1', [req.user.id])
    .then(result => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      const user = result.rows[0];
      
      if (user.is_blocked) {
        return res.status(403).json({ 
          error: 'Аккаунт заблокирован',
          blocked: true,
          reason: user.block_reason || 'Причина не указана'
        });
      }
      
      next();
    })
    .catch(err => {
      console.error('Ошибка проверки блокировки:', err);
      res.status(500).json({ error: 'Ошибка сервера при проверке статуса' });
    });
}

/** Опциональная аутентификация: если токена нет — не ошибка */
authMiddleware.optional = function (req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id };
    }
    // Если токена нет или он невалиден — просто продолжаем без req.user
    next();
  } catch {
    next();
  }
};

// Экспортируем дополнительные middleware
authMiddleware.checkAdmin = checkAdmin;
authMiddleware.checkNotBlocked = checkNotBlocked;

module.exports = authMiddleware;
