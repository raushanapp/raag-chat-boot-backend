const redis = require("redis");
let redisClient = null;
const createRedisClient = async () => {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    };
    redisClient = redis.createClient({ 
        url: process.env.REDIS_URL || 'redis://localhost:6379' 
    });
    redisClient.on('error', (err) => {
        console.error('Redis Service Error:', err);
    });
    redisClient.on('connect', () => {
        console.log('Redis Service connected');
    });
    await redisClient.connect();
    return redisClient;
}
module.exports = { createRedisClient };