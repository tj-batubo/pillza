import bcrypt from "bcrypt";
import {
  createUserService,
  deleteUserService,
  getAllUserService,
  getUserByIdService,
  updateUserService,
} from "../models/userModel.js";

// Standardized response helper
const handleResponse = (res, status, message, data = null) => {
  res.status(status).json({ status, message, data });
};

// CREATE USER (Signup)
export const createUser = async (req, res, next) => {
  const { first_name, last_name, username, phone_number, email, password } = req.body;

  try {
    // Validate required fields
    if (!first_name || !last_name || !username || !email || !password) {
      return handleResponse(res, 400, "Missing required fields");
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user in DB
    const newUser = await createUserService(
      first_name,
      last_name,
      username,
      phone_number,
      email,
      password_hash
    );

    handleResponse(res, 201, "User created successfully", newUser);
  } catch (err) {
    console.error(err);
    next(err);
  }
};

// GET ALL USERS
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await getAllUserService();
    handleResponse(res, 200, "Users fetched successfully", users);
  } catch (err) {
    next(err);
  }
};

// GET USER BY ID
export const getUserById = async (req, res, next) => {
  try {
    const user = await getUserByIdService(req.params.id);
    if (!user) return handleResponse(res, 404, "User not found");

    handleResponse(res, 200, "User fetched successfully", user);
  } catch (err) {
    next(err);
  }
};

// UPDATE USER (without password)
export const updateUser = async (req, res, next) => {
  const { first_name, last_name, username, phone_number, email } = req.body;

  try {
    const updatedUser = await updateUserService(
      req.params.id,
      first_name,
      last_name,
      username,
      phone_number,
      email
    );

    if (!updatedUser) return handleResponse(res, 404, "User not found");

    handleResponse(res, 200, "User updated successfully", updatedUser);
  } catch (err) {
    next(err);
  }
};

// DELETE USER
export const deleteUser = async (req, res, next) => {
  try {
    const deletedUser = await deleteUserService(req.params.id);

    if (!deletedUser) return handleResponse(res, 404, "User not found");

    handleResponse(res, 200, "User deleted successfully", deletedUser);
  } catch (err) {
    next(err);
  }
};

// LOGIN (for basic authentication)
export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const users = await getAllUserService();
    const user = users.find((u) => u.email === email);

    if (!user) return handleResponse(res, 404, "Invalid email or password");

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword)
      return handleResponse(res, 401, "Invalid email or password");

    handleResponse(res, 200, "Login successful", {
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
};
