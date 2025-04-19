require('dotenv').config();
const { createClient } = require('redis');

const FUND_KEY = 'fundOfBadminton';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('Lỗi Redis:', err));
redisClient.on('connect', () => console.log('Đã kết nối với Redis'));

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return true;
  } catch (error) {
    console.error('Lỗi khi kết nối Redis:', error);
    return false;
  }
};

const initializeData = async () => {
  try {
    await connectRedis();
    
    const exists = await redisClient.exists(FUND_KEY);
    
    if (exists === 0) {
      await redisClient.set(FUND_KEY, '0');
      console.log('Đã khởi tạo Redis với giá trị mặc định 0');
    }
    
    return true;
  } catch (error) {
    console.error('Lỗi khi khởi tạo dữ liệu Redis:', error);
    return false;
  }
};

// Hàm đọc số tiền từ Redis
const readMoney = async () => {
  try {
    await connectRedis();
    const value = await redisClient.get(FUND_KEY);
    return parseFloat(value) || 0;
  } catch (error) {
    console.error('Lỗi khi đọc từ Redis:', error);
    return 0;
  }
};

const writeMoney = async (amount) => {
  try {
    await connectRedis();
    await redisClient.set(FUND_KEY, amount.toString());
    return true;
  } catch (error) {
    console.error('Lỗi khi ghi vào Redis:', error);
    return false;
  }
};

initializeData();

module.exports = {
  readMoney,
  writeMoney,
  redisClient,
  connectRedis,
  FUND_KEY
};