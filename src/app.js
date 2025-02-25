import express from 'express';
import cors from 'cors'
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

//(
//backend stores the files in different format one
//of which is json 

//This is the data from datatypes like--> form
app.use(express.json({
    limit: "16kb"
}))

//getting data from URL we use 
app.use(express.urlencoded({extended: true, limit: "16kb"}));

//for storing data files 
app.use(express.static("public"));

app.use(cookieParser());

//)


// Routes import
import userRouter from './routes/user.routes.js';

// Routes declaration
app.use("/api/v1/users", userRouter);
//it works like this 
// https://localhost:8000/api/v1/users/register

export { app }