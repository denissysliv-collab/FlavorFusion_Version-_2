/**
 * Контроллер админ-панели
 * 
 * Функции:
 * - Получение списка всех пользователей
 * - Блокировка/разблокировка пользователей
 * - Удаление пользователей
 * - Получение всех рецептов (включая удалённые для админа)
 * - Редактирование любого рецепта
 * - Удаление любого рецепта
 * - Статистика для дашборда
 */

const pool = require('../database/pool');

// ============================================
// ПОЛЬЗОВАТЕЛИ
// ============================================

/** Получить всех пользователей */
async function getAllUsers(req, res) {
  try {
    const { page = 1, limit = 20, search = '', blocked = null } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id, username, email, avatar_url, bio, role, is_blocked, block_reason,
        created_at,
        (SELECT COUNT(*) FROM recipes WHERE author_id = users.id) as recipes_count,
        (SELECT COUNT(*) FROM favorites WHERE user_id = users.id) as favorites_count
      FROM users
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (blocked !== null) {
      conditions.push(`is_blocked = $${paramIndex}`);
      values.push(blocked === 'true');
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(query, values);

    // Получаем общее количество
    let countQuery = 'SELECT COUNT(*) FROM users';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      // Удаляем последние 2 параметра (limit и offset) для подсчёта
      values.pop();
      values.pop();
    }
    
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Ошибка получения пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении пользователей' });
  }
}

/** Заблокировать пользователя */
async function blockUser(req, res) {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    // Нельзя заблокировать самого себя
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }

    await pool.query(
      'UPDATE users SET is_blocked = TRUE, block_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [reason, id]
    );

    res.json({ message: 'Пользователь заблокирован', success: true });
  } catch (err) {
    console.error('Ошибка блокировки пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера при блокировке пользователя' });
  }
}

/** Разблокировать пользователя */
async function unblockUser(req, res) {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE users SET is_blocked = FALSE, block_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ message: 'Пользователь разблокирован', success: true });
  } catch (err) {
    console.error('Ошибка разблокировки пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера при разблокировке пользователя' });
  }
}

/** Удалить пользователя */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'Пользователь удалён', success: true });
  } catch (err) {
    console.error('Ошибка удаления пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера при удалении пользователя' });
  }
}

/** Назначить роль администратора */
async function makeAdmin(req, res) {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['admin', id]
    );

    res.json({ message: 'Пользователь назначен администратором', success: true });
  } catch (err) {
    console.error('Ошибка назначения администратора:', err);
    res.status(500).json({ error: 'Ошибка сервера при назначении администратора' });
  }
}

/** Снять роль администратора */
async function removeAdmin(req, res) {
  try {
    const { id } = req.params;

    // Нельзя снять роль с самого себя
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя снять админские права с самого себя' });
    }

    await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['user', id]
    );

    res.json({ message: 'Роль администратора снята', success: true });
  } catch (err) {
    console.error('Ошибка снятия роли администратора:', err);
    res.status(500).json({ error: 'Ошибка сервера при снятии роли администратора' });
  }
}

// ============================================
// РЕЦЕПТЫ (админ-версии)
// ============================================

/** Получить все рецепты (для админа) */
async function getAllRecipesAdmin(req, res) {
  try {
    const { page = 1, limit = 20, search = '', category = '', authorId = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.id, r.title, r.description, r.image_url, r.category, r.time, r.difficulty,
        r.views_count, r.created_at, r.updated_at,
        u.id as author_id, u.username as author_name, u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM likes WHERE recipe_id = r.id) as likes_count,
        (SELECT COUNT(*) FROM favorites WHERE recipe_id = r.id) as favorites_count
      FROM recipes r
      JOIN users u ON r.author_id = u.id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(r.title ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`r.category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (authorId) {
      conditions.push(`r.author_id = $${paramIndex}`);
      values.push(parseInt(authorId));
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(query, values);

    // Получаем общее количество
    let countQuery = 'SELECT COUNT(*) FROM recipes r';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      values.pop();
      values.pop();
    }
    
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      recipes: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Ошибка получения рецептов:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении рецептов' });
  }
}

/** Удалить рецепт (админ) */
async function deleteRecipeAdmin(req, res) {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM recipes WHERE id = $1', [id]);

    res.json({ message: 'Рецепт удалён', success: true });
  } catch (err) {
    console.error('Ошибка удаления рецепта:', err);
    res.status(500).json({ error: 'Ошибка сервера при удалении рецепта' });
  }
}

/** Обновить рецепт (админ) */
async function updateRecipeAdmin(req, res) {
  try {
    const { id } = req.params;
    const {
      title, description, full_description, image_url, ingredients,
      instructions, time, difficulty, category, servings, tags,
      calories, protein, carbs, fat, notes
    } = req.body;

    const result = await pool.query(
      `UPDATE recipes SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        full_description = COALESCE($3, full_description),
        image_url = COALESCE($4, image_url),
        ingredients = COALESCE($5, ingredients),
        instructions = COALESCE($6, instructions),
        time = COALESCE($7, time),
        difficulty = COALESCE($8, difficulty),
        category = COALESCE($9, category),
        servings = COALESCE($10, servings),
        tags = COALESCE($11, tags),
        calories = COALESCE($12, calories),
        protein = COALESCE($13, protein),
        carbs = COALESCE($14, carbs),
        fat = COALESCE($15, fat),
        notes = COALESCE($16, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *`,
      [
        title, description, full_description, image_url,
        ingredients ? JSON.stringify(ingredients) : null,
        instructions, time, difficulty, category, servings,
        tags, calories, protein, carbs, fat, notes, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Рецепт не найден' });
    }

    res.json({ message: 'Рецепт обновлён', recipe: result.rows[0], success: true });
  } catch (err) {
    console.error('Ошибка обновления рецепта:', err);
    res.status(500).json({ error: 'Ошибка сервера при обновлении рецепта' });
  }
}

// ============================================
// СТАТИСТИКА ДЛЯ ДАШБОРДА
// ============================================

async function getDashboardStats(req, res) {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM recipes'),
      pool.query('SELECT COUNT(*) FROM users WHERE is_blocked = TRUE'),
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']),
      pool.query('SELECT COUNT(*) FROM likes'),
      pool.query('SELECT COUNT(*) FROM favorites'),
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM recipes 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) 
        ORDER BY date
      `)
    ]);

    res.json({
      totalUsers: parseInt(stats[0].rows[0].count),
      totalRecipes: parseInt(stats[1].rows[0].count),
      blockedUsers: parseInt(stats[2].rows[0].count),
      adminUsers: parseInt(stats[3].rows[0].count),
      totalLikes: parseInt(stats[4].rows[0].count),
      totalFavorites: parseInt(stats[5].rows[0].count),
      recentRecipes: stats[6].rows
    });
  } catch (err) {
    console.error('Ошибка получения статистики:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении статистики' });
  }
}

module.exports = {
  getAllUsers,
  blockUser,
  unblockUser,
  deleteUser,
  makeAdmin,
  removeAdmin,
  getAllRecipesAdmin,
  deleteRecipeAdmin,
  updateRecipeAdmin,
  getDashboardStats
};
