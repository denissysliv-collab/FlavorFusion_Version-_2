/**
 * Маршруты администратора
 * 
 * Все маршруты защищены middleware adminMiddleware:
 *   - Требуется JWT-токен
 *   - Требуется флаг is_admin = true в базе данных
 * 
 * Endpoints:
 *   GET    /api/admin/users           — список всех пользователей
 *   GET    /api/admin/users/:id/recipes — рецепты конкретного пользователя
 *   DELETE /api/admin/recipes/:id     — удалить рецепт (любой)
 *   PATCH  /api/admin/recipes/:id     — обновить рецепт (любой)
 *   GET    /api/admin/stats           — статистика платформы
 */

const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/admin');
const adminController = require('../controllers/adminController');

// Все маршруты требуют прав администратора
router.use(adminMiddleware);

// Список всех пользователей
router.get('/users', adminController.getAllUsers);

// Рецепты конкретного пользователя
router.get('/users/:id/recipes', adminController.getUserRecipes);

// Удалить рецепт (админ может удалять любые рецепты)
router.delete('/recipes/:id', adminController.deleteRecipe);

// Обновить рецепт (админ может редактировать любые рецепты)
router.patch('/recipes/:id', adminController.updateRecipe);

// Статистика платформы
router.get('/stats', adminController.getStats);

module.exports = router;
