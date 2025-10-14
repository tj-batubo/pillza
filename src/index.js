import express from "express";
import cors from 'cors';
import errorHandler from './middlewares/errorHandler.js';

import dotenv from 'dotenv';
import pool from './config/db.js';

import userRoutes from "./routes/userRoutes.js";
import userEntry from "./routes/userEntry.js";
import createUserTable from "./data/createUserTable.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

//  Middleware 
app.use(    express.json()  );
app.use(    cors()    );

//  Routes
app.use("/api/user", userRoutes);
app.use("/api", userEntry);


//  Error Handling middleware
app.use(    errorHandler    );

// Create table before staarting server
createUserTable();

// Testing POSTGRES Connection
// app.get("/", async(req, res) => {
//     console.log("\nStart...");

//     try {

//         const result = await pool.query("SELECT current_database()");
//         res.status(200).send(`The database name is: ${result.rows[0].current_database}`);

//     } catch (err) {

//         next(err);

//     } finally {

//         console.log("...End\n");

//     }
// })

//  Server Running
app.listen(port, () => console.log(`Server Running on http:localhost:${port}`))