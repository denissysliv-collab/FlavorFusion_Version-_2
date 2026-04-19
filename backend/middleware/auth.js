  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_this_in_production';

  function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Токен не предоставлен. Войдите в систему.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      req.user = {
        id: decoded.id,
        is_admin: decoded.is_admin || false
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Токен истёк. Войдите заново.' });
      }
      return res.status(401).json({ error: 'Недействительный токен' });
    }
  }

  authMiddleware.optional = function(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
          id: decoded.id,
          is_admin: decoded.is_admin || false
        };
      }
      next();
    } catch {
      next();
    }
  };

  module.exports = authMiddleware;