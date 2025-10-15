import pool from "../config/db.js";
import buildDatabase from "./database.js";

const createUserTable = async () => {
    const queryText = buildDatabase();

    try {
        await pool.query(queryText);
        console.log("User table created if not exists")
    } catch (err) {
        console.error(`Error Creating users table: ${err.message}`)
    }
}

export default createUserTable;