import pool from "../config/db.js";

const createUserTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS users (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
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