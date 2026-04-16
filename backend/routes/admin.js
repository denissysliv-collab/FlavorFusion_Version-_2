/**
 * Маршруты админ-панели
 * 
 * Все маршруты защищены middleware checkAdmin
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Применяем проверку аутентификации и прав администратора ко всем маршрутам
router.use(authMiddleware);
router.use(authMiddleware.checkAdmin);

// ============================================
// ДАШБОРД
// ============================================
router.get('/dashboard/stats', adminController.getDashboardStats);

// ============================================
// ПОЛЬЗОВАТЕЛИ
// ============================================
router.get('/users', adminController.getAllUsers);
router.post('/users/:id/block', adminController.blockUser);
router.post('/users/:id/unblock', adminController.unblockUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/make-admin', adminController.makeAdmin);
router.post('/users/:id/remove-admin', adminController.removeAdmin);

// ============================================
// РЕЦЕПТЫ
// ============================================
router.get('/recipes', adminController.getAllRecipesAdmin);
router.delete('/recipes/:id', adminController.deleteRecipeAdmin);
router.put('/recipes/:id', adminController.updateRecipeAdmin);

module.exports = router;
