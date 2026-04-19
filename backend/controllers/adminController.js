const pool = require('../database/pool');

const adminController = {
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
      if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });
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

  async deleteUser(req, res) {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    try {
      await pool.query('DELETE FROM activity_log WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM favorites WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM likes WHERE user_id = $1', [id]);
      await pool.query('DELETE FROM subscriptions WHERE follower_id = $1 OR followed_id = $1', [id]);
      await pool.query('DELETE FROM recipes WHERE author_id = $1', [id]);
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });
      await pool.query(
        'INSERT INTO activity_log (user_id, action, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, `deleted_user_${id}`]
      );
      res.json({ message: 'Пользователь удалён' });
    } catch (err) {
      console.error('Ошибка удаления пользователя:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  async getUsersList(req, res) {
    try {
      const result = await pool.query(`SELECT id, username, email FROM users ORDER BY username`);
      res.json({ users: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  async getUserById(req, res) {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE id = $1`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  async getUserRecipes(req, res) {
    const { id } = req.params;
    try {
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
      if (userCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      const result = await pool.query(
        `SELECT r.id, r.title, r.created_at, r.image_url, 
                u.username as author_name, u.avatar_url as author_avatar
         FROM recipes r 
         LEFT JOIN users u ON r.author_id = u.id 
         WHERE r.author_id = $1 
         ORDER BY r.created_at DESC`,
        [id]
      );
      res.json({ recipes: result.rows });
    } catch (err) {
      console.error('Ошибка в getUserRecipes:', err);
      res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
  },

  async getAllRecipes(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const searchQuery = req.query.search || '';
    
    try {
      let query = `
        SELECT r.id, r.title, r.description, r.image_url, r.created_at, 
               u.username as author_name, u.email as author_email, u.avatar_url as author_avatar
        FROM recipes r 
        LEFT JOIN users u ON r.author_id = u.id 
      `;
      let countQuery = `SELECT COUNT(*) FROM recipes r LEFT JOIN users u ON r.author_id = u.id`;
      let params = [];
      
      if (searchQuery) {
        query += ` WHERE u.email ILIKE $${params.length + 1} OR u.username ILIKE $${params.length + 1}`;
        countQuery += ` WHERE u.email ILIKE $${params.length + 1} OR u.username ILIKE $${params.length + 1}`;
        params.push(`%${searchQuery}%`);
      }
      
      query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const recipesRes = await pool.query(query, params);
      const totalRes = await pool.query(countQuery, params.slice(0, params.length - 2));
      
      res.json({
        recipes: recipesRes.rows,
        pagination: { page, limit, total: parseInt(totalRes.rows[0].count) }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

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

  async updateRecipe(req, res) {
    const { id } = req.params;
    const { title, description, ingredients, instructions, image_url, category_id } = req.body;
    try {
      const result = await pool.query(
        `UPDATE recipes 
         SET title = $1, description = $2, ingredients = $3, instructions = $4, 
             image_url = $5, category_id = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING id, title, author_id`,
        [title, description, ingredients, instructions, image_url, category_id, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Рецепт не найден' });
      await pool.query(
        'INSERT INTO activity_log (user_id, action, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, `edited_recipe_${id}`]
      );
      res.json({ message: 'Рецепт обновлён', recipe: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

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
  }
};

module.exports = adminController;