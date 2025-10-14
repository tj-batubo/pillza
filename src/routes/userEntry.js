import express from 'express';
import validateUser from '../middlewares/inputValidator.js';
import { createUser, loginUser } from '../controllers/userController.js';

const router = express.Router();

// Receive User infor for sign up
router.post("/signup", validateUser, createUser);

router.post("/login", loginUser);

export default router;