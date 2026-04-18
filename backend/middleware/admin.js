/**
 * Middleware для проверки прав администратора
 * Должен использоваться после authMiddleware
 * 
 * Проверяет, что req.user существует и имеет is_admin === true
 */

module.exports = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
  }
  next();
};