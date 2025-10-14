import pool from '../config/db.js';

// Get all users
export const getAllUserService = async () => {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
};

// Get user by ID
export const getUserByIdService = async (id) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

// Create new user
export const createUserService = async (first_name, last_name, username, phone_number, email, password_hash) => {
  const result = await pool.query(
    `INSERT INTO users 
      (first_name, last_name, username, phone_number, email, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [first_name, last_name, username, phone_number, email, password_hash]
  );
  return result.rows[0];
};

// Update user
export const updateUserService = async (id, first_name, last_name, username, phone_number, email) => {
  const result = await pool.query(
    `UPDATE users 
     SET first_name=$1, last_name=$2, username=$3, phone_number=$4, email=$5
     WHERE id=$6
     RETURNING *`,
    [first_name, last_name, username, phone_number, email, id]
  );
  return result.rows[0];
};

// Delete user
export const deleteUserService = async (id) => {
  const result = await pool.query(
    'DELETE FROM users WHERE id=$1 RETURNING *',
    [id]
  );
  return result.rows[0];
};
