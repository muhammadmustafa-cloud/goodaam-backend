const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// User routes (only one user allowed)
router.post('/', userController.createUser);
router.get('/', userController.getUsers);
router.get('/system-user', userController.getSystemUser);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
