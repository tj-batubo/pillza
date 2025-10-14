import express from "express";
import cors from 'cors';

import dotenv from 'dotenv';
import pool from './config/db.js';

import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

//  Middleware 
app.use(    express.json()  );
app.use(    cors()    );

//  Routes
app.use("/api", userRoutes);


//  Error Handling middleware

// Testing POSTGRES Connection
app.get("/", async(req, res) => {
    console.log("Start...");
    try {
        const result = await pool.query("SELECT current_database()");
        res.status(200).send(`The database name is: ${result.rows[0].current_database}`)
    } catch (e) {
        console.error(e.message)
        res.status(500).send("Server error");
    } finally {
        console.log("...End");
    }
})

//  Server Running
app.listen(port, () => console.log(`Server Running on http:localhost:${port}`))