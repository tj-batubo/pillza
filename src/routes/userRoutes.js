import express from 'express';

const router = express.Router();

//  Signup Route
router.post("signup", CreataUser);

// Login Route
router.post("login", loginUser);

router.get("/user", getAllUsers);
router.get("/user/:id", getUserById);
router.put("/user/:id", updateUser);
router.delete("/user/:id", deleteUser);

export default router;