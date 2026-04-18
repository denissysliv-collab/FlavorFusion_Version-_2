const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const adminController = require('../controllers/adminController');

router.use(authMiddleware, adminMiddleware);

router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

router.get('/recipes', adminController.getAllRecipes);
router.delete('/recipes/:id', adminController.deleteRecipe);

router.get('/stats', adminController.getStats);
router.get('/activity', adminController.getActivityLog);

module.exports = router;