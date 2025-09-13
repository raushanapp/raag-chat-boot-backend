const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const redis = require("redis");
require("dotenv").config();


const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.FrontendURL || "http://localhost:3000", methods: ["GET", "POST"] } });
