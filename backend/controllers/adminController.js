/**
 * Контроллер администратора
 * 
 * Функции:
 *   - getAllUsers — список всех пользователей с их статистикой
 *   - getUserRecipes — все рецепты конкретного пользователя
 *   - deleteRecipe — удалить любой рецепт (админ может удалять чужие рецепты)
 *   - getStats — общая статистика платформы
 */

const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Like = require('../models/Like');
const Favorite = require('../models/Favorite');
const Subscription = require('../models/Subscription');
const pool = require('../database/pool');

const adminController = {
  /**
   * GET /api/admin/users
   * Получить список всех пользователей с базовой статистикой
   */
  async getAllUsers(req, res, next) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.avatar_url,
          u.bio,
          u.created_at,
          COUNT(DISTINCT r.id) AS recipes_count,
          COALESCE(SUM(l.total_likes), 0) AS total_likes_received,
          COALESCE(SUM(f.total_favorites), 0) AS total_favorites_received,
          (SELECT COUNT(*) FROM subscriptions WHERE following_id = u.id) AS followers_count
        FROM users u
        LEFT JOIN recipes r ON u.id = r.author_id
        LEFT JOIN (
          SELECT recipe_id, COUNT(*) AS total_likes
          FROM likes
          GROUP BY recipe_id
        ) l ON r.id = l.recipe_id
        LEFT JOIN (
          SELECT recipe_id, COUNT(*) AS total_favorites
          FROM favorites
          GROUP BY recipe_id
        ) f ON r.id = f.recipe_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      res.json({ users: result.rows });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/users/:id/recipes
   * Получить все рецепты конкретного пользователя
   */
  async getUserRecipes(req, res, next) {
    try {
      const userId = parseInt(req.params.id);
      
      // Проверяем существование пользователя
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const recipes = await Recipe.findByAuthorId(userId);
      res.json({ user, recipes });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/admin/recipes/:id
   * Удалить любой рецепт (админ может удалять чужие рецепты)
   */
  async deleteRecipe(req, res, next) {
    try {
      const recipeId = req.params.id;
      
      // Получаем информацию о рецепте для лога
      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        return res.status(404).json({ error: 'Рецепт не найден' });
      }

      // Удаляем рецепт (обход проверки авторства)
      await pool.query('DELETE FROM recipes WHERE id = $1', [recipeId]);

      res.json({ 
        message: 'Рецепт удалён администратором',
        recipe: { id: recipeId, title: recipe.title }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/recipes/:id
   * Редактировать любой рецепт (админ может редактировать чужие рецепты)
   */
  async updateRecipe(req, res, next) {
    try {
      const recipeId = req.params.id;
      
      // Проверяем существование рецепта
      const existingRecipe = await Recipe.findById(recipeId);
      if (!existingRecipe) {
        return res.status(404).json({ error: 'Рецепт не найден' });
      }

      // Обновляем рецепт (обход проверки авторства через прямой SQL)
      const data = req.body;
      const fields = [];
      const values = [];
      let paramIndex = 1;

      const fieldMappings = {
        title: 'title',
        description: 'description',
        full_description: 'full_description',
        image_url: 'image_url',
        ingredients: 'ingredients',
        instructions: 'instructions',
        time: 'time',
        difficulty: 'difficulty',
        category: 'category',
        servings: 'servings',
        tags: 'tags',
        calories: 'calories',
        protein: 'protein',
        carbs: 'carbs',
        fat: 'fat',
        notes: 'notes',
      };

      for (const [key, column] of Object.entries(fieldMappings)) {
        if (data[key] !== undefined) {
          if (key === 'ingredients' && Array.isArray(data[key])) {
            fields.push(`${column} = $${paramIndex++}`);
            values.push(JSON.stringify(data[key]));
          } else if (key === 'servings') {
            fields.push(`${column} = $${paramIndex++}`);
            values.push(parseInt(data[key]));
          } else {
            fields.push(`${column} = $${paramIndex++}`);
            values.push(data[key]);
          }
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      values.push(recipeId);

      const result = await pool.query(
        `UPDATE recipes
         SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      // Возвращаем с данными автора
      const updatedRecipe = await Recipe.findById(result.rows[0].id);

      res.json({
        message: 'Рецепт обновлён администратором',
        recipe: updatedRecipe,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/stats
   * Общая статистика платформы
   */
  async getStats(req, res, next) {
    try {
      const statsResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM recipes) AS total_recipes,
          (SELECT COUNT(*) FROM likes) AS total_likes,
          (SELECT COUNT(*) FROM favorites) AS total_favorites,
          (SELECT COUNT(*) FROM subscriptions) AS total_subscriptions,
          (SELECT COUNT(*) FROM activity_log) AS total_activities
      `);

      const stats = statsResult.rows[0];

      // Топ авторов по количеству рецептов
      const topAuthorsResult = await pool.query(`
        SELECT 
          u.id,
          u.username,
          u.avatar_url,
          COUNT(r.id) AS recipes_count
        FROM users u
        LEFT JOIN recipes r ON u.id = r.author_id
        GROUP BY u.id
        ORDER BY recipes_count DESC
        LIMIT 5
      `);

      // Топ рецептов по лайкам
      const topRecipesResult = await pool.query(`
        SELECT 
          r.id,
          r.title,
          r.image_url,
          u.username AS author_username,
          COUNT(l.id) AS likes_count
        FROM recipes r
        LEFT JOIN likes l ON r.id = l.recipe_id
        INNER JOIN users u ON r.author_id = u.id
        GROUP BY r.id, u.username
        ORDER BY likes_count DESC
        LIMIT 5
      `);

      res.json({
        stats,
        topAuthors: topAuthorsResult.rows,
        topRecipes: topRecipesResult.rows,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;
