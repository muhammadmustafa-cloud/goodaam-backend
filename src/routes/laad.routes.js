const express = require('express');
const laadController = require('../controllers/laad.controller');

const router = express.Router();

router.post('/', laadController.createLaad);
router.get('/', laadController.getLaads);
router.get('/:id', laadController.getLaadById);

module.exports = router;
