import pool from "../config/db.js";

const createUserTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS users (
            id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            username VARCHAR(50) UNIQUE NOT NULL,
            phone_number VARCHAR(20) UNIQUE,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )`;

    try {
        await pool.query(queryText);
        console.log("User table created if not exists")
    } catch (err) {
        console.error(`Error Creating users table: ${err.message}`)
    }
}

export default createUserTable;