/**
 * Контроллер админ-панели
 * Все методы требуют предварительной проверки прав администратора
 */

const pool = require('../database/pool');

const adminController = {
  /**
   * GET /api/admin/users
   * Получить список всех пользователей (с пагинацией)
   */
  async getUsers(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
      const usersRes = await pool.query(
        `SELECT id, username, email, is_admin, created_at 
         FROM users ORDER BY id LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const totalRes = await pool.query('SELECT COUNT(*) FROM users');
      res.json({
        users: usersRes.rows,
        pagination: { page, limit, total: parseInt(totalRes.rows[0].count) }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * PUT /api/admin/users/:id/role
   * Изменить роль пользователя (админ/не админ)
   */
  async updateUserRole(req, res) {
    const { id } = req.params;
    const { is_admin } = req.body;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя изменить свою роль' });
    }
    try {
      const result = await pool.query(
        'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, username, is_admin',
        [is_admin, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      // Логируем действие
      await pool.query(
        'INSERT INTO activity_log (user_id, action, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, `changed_role_user_${id}_to_${is_admin}`]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * DELETE /api/admin/users/:id
   * Удалить пользователя (каскадно)
   */
  async deleteUser(req, res) {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Удаляем связанные записи вручную (на случай отсутствия CASCADE)
      await client.query('DELETE FROM activity_log WHERE user_id = $1', [id]);
      await client.query('DELETE FROM favorites WHERE user_id = $1', [id]);
      await client.query('DELETE FROM likes WHERE user_id = $1', [id]);
      await client.query('DELETE FROM subscriptions WHERE follower_id = $1 OR followed_id = $1', [id]);
      await client.query('DELETE FROM recipes WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
      // Логируем
      await pool.query(
        'INSERT INTO activity_log (user_id, action, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, `deleted_user_${id}`]
      );
      res.json({ message: 'Пользователь удалён' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
      client.release();
    }
  },

  /**
   * GET /api/admin/recipes
   * Получить все рецепты (с именами авторов)
   */
  async getAllRecipes(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    try {
      const recipesRes = await pool.query(
        `SELECT r.*, u.username as author_name 
         FROM recipes r 
         LEFT JOIN users u ON r.user_id = u.id 
         ORDER BY r.created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const totalRes = await pool.query('SELECT COUNT(*) FROM recipes');
      res.json({
        recipes: recipesRes.rows,
        pagination: { page, limit, total: parseInt(totalRes.rows[0].count) }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * DELETE /api/admin/recipes/:id
   * Удалить любой рецепт
   */
  async deleteRecipe(req, res) {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM recipes WHERE id = $1', [id]);
      await pool.query(
        'INSERT INTO activity_log (user_id, action, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, `deleted_recipe_${id}`]
      );
      res.json({ message: 'Рецепт удалён' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * GET /api/admin/stats
   * Получить общую статистику
   */
  async getStats(req, res) {
    try {
      const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
      const totalRecipes = await pool.query('SELECT COUNT(*) FROM recipes');
      const totalLikes = await pool.query('SELECT COUNT(*) FROM likes');
      const totalFavorites = await pool.query('SELECT COUNT(*) FROM favorites');
      res.json({
        users: parseInt(totalUsers.rows[0].count),
        recipes: parseInt(totalRecipes.rows[0].count),
        likes: parseInt(totalLikes.rows[0].count),
        favorites: parseInt(totalFavorites.rows[0].count),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * GET /api/admin/activity
   * Получить логи активности (с именами пользователей)
   */
  async getActivityLog(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    try {
      const logsRes = await pool.query(
        `SELECT al.*, u.username 
         FROM activity_log al 
         LEFT JOIN users u ON al.user_id = u.id 
         ORDER BY al.created_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const totalRes = await pool.query('SELECT COUNT(*) FROM activity_log');
      res.json({
        logs: logsRes.rows,
        pagination: { page, limit, total: parseInt(totalRes.rows[0].count) }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
};

module.exports = adminController;