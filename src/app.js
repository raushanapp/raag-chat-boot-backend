const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const redis = require("redis");
require("dotenv").config();

const ragService = require("./services/ragService");
const newsService = require("./services/newsService");
const controller = require("./controllers/controller");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", methods: ["GET", "POST", "DELETE"] } });

//  Redis Client
const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('Socket Redis Error:', err));
// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
// ===== ROUTES =====
app.use("/api/rag", controller);

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        services: {
            redis: redisClient.isOpen ? "connected" : "disconnected"
        }
    });
});

let socketRedisConnected = false;
const connectSocketRedis = async () => {
    if (!socketRedisConnected) {
        try {
            await redisClient.connect();
            socketRedisConnected = true;
        } catch (error) {
            console.error('Socket Redis connection failed:', error);
        }
    }
};
//  Socket.io Connection
io.on("connection", (socket) => {
    // console.log('User connected:', socket.id);
    socket.on("join-session", (sessionId) => {
        socket.join(sessionId);
        console.log(`User ${socket.id} joined session ${sessionId}`);
    })
    socket.on("send-message", async (data) => {
        const { message, sessionId } = data;
        try {
            // Ensure Redis is connected
            if (!socketRedisConnected) {
                await connectSocketRedis();
            }
            // Store user message in Redis
            await redisClient.lPush(`chat:${sessionId}`, JSON.stringify({
                type: "user",
                message,
                timeStamp: new Date().toISOString(),
            }));
            // Get RAG response
            const response = await ragService.generateResponse(message);
            // Store bot response in Redis
            await redisClient.lPush(`chat:${sessionId}`, JSON.stringify({
                type: "bot",
                message: response,
                timeStamp: new Date().toISOString(),
            }));
            // Emit response back to client
            io.to(sessionId).emit("bot-response", {
                message: response,
                timeStamp: new Date().toISOString()
            })
            
        } catch (error) {
            console.error('Error processing message:', error);
            io.to(sessionId).emit('error', 'Failed to process message');
        }
    })
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
// Initialize services
async function initialize() {
    try {
        //  Here redis connection
        await connectSocketRedis();
        console.log('Connected to Redis');
        // Initialize RAG pipeline
        await ragService.initialize();
        console.log('RAG service initialized');
        // Ingest news articles (run once)
       const collectionInfo = await ragService.qdrantClient.getCollection("news_articles");
        if (collectionInfo.points_count === 0) {
            console.log('No data found, ingesting news articles...');
            await newsService.ingestNewsArticles();
            console.log('News ingestion completed');
        } else {
            console.log(`Found ${collectionInfo.points_count} articles in database`);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        process.exit(1); // Exit if critical services fail
    }
}
//  GraceFul shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received, initiating graceful shutdown...`);
    let shutdownTimer;
    try {
        // Set a timeout to force exit if shutdown takes too long
        shutdownTimer = setTimeout(() => {
            console.error(' Shutdown timeout reached, forcing exit');
            process.exit(1);
        }, 10000); // 10 second timeout
        // Close HTTP server
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) reject(err);
                    else {
                        console.log(' HTTP server closed');
                        resolve();
                    }
                });
            });
        }
        // Close Redis connection
        if (redisClient && redisClient.isOpen) {
            await redisClient.disconnect();
            console.log(' Redis connection closed');
        }

        // Close Socket.IO connections
        if (io) {
            io.close();
            console.log(' Socket.IO connections closed');
        }
        // Clear the timeout since we completed successfully
        clearTimeout(shutdownTimer);
        console.log('Graceful shutdown completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        clearTimeout(shutdownTimer);
        process.exit(1);
    }
};


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
server.listen(PORT,async () => {
   await initialize()
    console.log(`Server running on port ${PORT}`);
});
module.exports = { app };