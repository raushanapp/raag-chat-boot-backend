const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { createRedisClient } = require("../services/redisService");
//  Router s
const router = express.Router();
let redisClient;
// Initialize Redis
(async () => {
    redisClient = await createRedisClient();
})();

// create new session
router.post("/chat/session", (req, res) => {
    const sessionId = uuidv4();
    res.json({ sessionId });
});

// Get chat history
router.get("/chat/history/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        // Check if Redis client is connected
        if (!redisClient.isOpen) {
            console.log('Redis client not connected, attempting to connect...');
            await redisClient.connect();
        }

        const history = await redisClient?.lRange(`chat:${sessionId}`, 0, -1);
        const message = history.map((msg) => {
            try {
                return JSON.parse(msg);
            } catch (parseError) {
                console.error('JSON parse error:', parseError, 'Raw message:', msg);
                return null;
            }
        }).filter(msg => msg !== null).reverse(); //Reverse to get chronological order
        res.json({ message });
    } catch (error) {
        console.error('Error fetching history:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});
//  clear Session
router.delete("/chat/session/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        await redisClient.del(`chat:${sessionId}`);
        res.json({ message: 'Session cleared successfully' });
        
    } catch (error) {
        console.error('Error clearing session:', error);
        res.status(500).json({ error: 'Failed to clear session' });
        
    }
});

// Test Redis connection
router.get("/test-redis", async (req, res) => {
    try {
        await redisClient.ping();
        res.json({ status: "Redis connected successfully" });
    } catch (error) {
        console.error('Redis connection error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;