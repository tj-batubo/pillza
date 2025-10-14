import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

console.log(`\nDatabase con: \n\tUSER: ${process.env.PG_USER} \n\n\tHOST: ${process.env.PG_HOST} \n\tPORT: ${process.env.PG_PORT}\n`)

const pool = new Pool({
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,

    database: process.env.PG_DATABASE,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT
});

pool.on("connect", () => console.log("Connection pool extablished with Database"));

export default pool;