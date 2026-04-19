const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const adminController = require('../controllers/adminController');

router.use(authMiddleware, adminMiddleware);

// Пользователи
router.get('/users', adminController.getUsers);
router.get('/users/list', adminController.getUsersList);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/users/:id/recipes', adminController.getUserRecipes);

// Рецепты
router.get('/recipes', adminController.getAllRecipes);
router.put('/recipes/:id', adminController.updateRecipe);
router.delete('/recipes/:id', adminController.deleteRecipe);

// Статистика и логи
router.get('/stats', adminController.getStats);
router.get('/activity', adminController.getActivityLog);

module.exports = router;