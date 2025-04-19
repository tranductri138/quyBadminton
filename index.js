require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Import database module instead of file storage
const db = require('./dbStorage');

let dbInitialized = false;

const initializeApp = async () => {
  try {
    console.log('Initializing database connection...');
    dbInitialized = await db.initDatabase();
    
    if (dbInitialized) {
      console.log('Database initialized successfully');
      
      // Khởi động Telegram Bot sau khi database đã khởi tạo
      const telegramBot = require('./telegramBot');
      console.log('Telegram Bot started');
      
      // Cấu hình Express
      startExpressServer();
    } else {
      console.error('Failed to initialize database, application may not function correctly.');
    }
  } catch (error) {
    console.error('Error during application initialization:', error);
  }
};

const startExpressServer = () => {
  app.use(express.json());

  const verifyToken = (req, res, next) => {
    const token = req.headers['access-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'Không tìm thấy access token' });
    }
    
    if (token !== ACCESS_TOKEN) {
      return res.status(403).json({ error: 'Access token không hợp lệ' });
    }
    
    next();
  };

  function formatBalance(amount) {
    amount = parseFloat(amount);
    
    if (isNaN(amount)) {
      return '0';
    }
    
    const isNegative = amount < 0;
    amount = Math.abs(amount);
    
    if (amount < 1000) {
      return `${isNegative ? '-' : ''}${amount}k`;
    } 
    else {
      const millions = Math.floor(amount / 1000);
      const remaining = amount % 1000;
      
      if (remaining === 0) {
        return `${isNegative ? '-' : ''}${millions}tr`;
      } else {
        return `${isNegative ? '-' : ''}${millions}tr ${remaining}k`;
      }
    }
  }

  function parseAmount(amountStr) {
    if (typeof amountStr === 'string') {
      const cleanedStr = amountStr.trim().toLowerCase().replace(/,/g, '');
      
      const numericMatch = cleanedStr.match(/(\d+(\.\d+)?)/);
      
      if (numericMatch && numericMatch[1]) {
        const numericValue = parseFloat(numericMatch[1]);
        
        if (cleanedStr.includes('k') || cleanedStr.includes('nghìn') || cleanedStr.includes('nghin')) {
          return numericValue; // Đã quy ước 1k = 1
        }
        
        if (cleanedStr.includes('tr') || cleanedStr.includes('triệu') || cleanedStr.includes('trieu')) {
          return numericValue * 1000; // 1tr = 1000
        }
        
        if (cleanedStr.includes('tỷ') || cleanedStr.includes('ty')) {
          return numericValue * 1000000; // 1 tỷ = 1,000,000
        }
        
        return numericValue;
      }
    }
    
    return parseFloat(amountStr) || 0;
  }

  // Helper function to check if database is initialized
  const checkDbInitialized = (req, res, next) => {
    if (!dbInitialized) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database đang khởi tạo, vui lòng thử lại sau.'
      });
    }
    next();
  };

  app.use('/api', checkDbInitialized);

  // API endpoint to add money to a specific chat ID
  app.post('/api/add', verifyToken, async (req, res) => {
    const { amount, chatId } = req.body;
    const targetChatId = chatId || 'default'; // Use 'default' as a fallback
    
    if (!amount || (isNaN(parseAmount(amount)) || parseAmount(amount) <= 0)) {
      return res.status(400).json({ error: 'Số tiền cần cộng phải là số dương' });
    }

    try {
      const currentValue = await db.getChatValue(targetChatId);
      const parsedAmount = parseAmount(amount);
      const newValue = currentValue + parsedAmount;
      
      // Sử dụng setChatValue thay vì addTransaction
      const success = await db.setChatValue(targetChatId, newValue);
      
      if (success) {
        const totalMoney = await db.getTotalMoney();
        
        res.json({
          success: true,
          message: `Đã cộng ${parsedAmount} vào tài khoản ${targetChatId}`,
          inputAmount: amount,
          parsedAmount: parsedAmount,
          previousBalance: currentValue,
          formattedPreviousBalance: formatBalance(currentValue),
          newBalance: newValue,
          formattedNewBalance: formatBalance(newValue),
          totalBalance: totalMoney,
          formattedTotalBalance: formatBalance(totalMoney)
        });
      } else {
        res.status(500).json({ error: 'Có lỗi xảy ra khi lưu dữ liệu' });
      }
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra khi truy cập database' });
    }
  });

  // API endpoint to subtract money from a specific chat ID
  app.post('/api/subtract', verifyToken, async (req, res) => {
    const { amount, chatId } = req.body;
    const targetChatId = chatId || 'default'; // Use 'default' as a fallback
    
    if (!amount || (isNaN(parseAmount(amount)) || parseAmount(amount) <= 0)) {
      return res.status(400).json({ error: 'Số tiền cần trừ phải là số dương' });
    }
    
    try {
      const currentValue = await db.getChatValue(targetChatId);
      const parsedAmount = parseAmount(amount);
      const newValue = currentValue - parsedAmount;
      
      // Sử dụng setChatValue thay vì addTransaction
      const success = await db.setChatValue(targetChatId, newValue);
      
      if (success) {
        const totalMoney = await db.getTotalMoney();
        
        res.json({
          success: true,
          message: `Đã trừ ${parsedAmount} từ tài khoản ${targetChatId}`,
          inputAmount: amount,
          parsedAmount: parsedAmount,
          previousBalance: currentValue,
          formattedPreviousBalance: formatBalance(currentValue),
          newBalance: newValue,
          formattedNewBalance: formatBalance(newValue),
          totalBalance: totalMoney,
          formattedTotalBalance: formatBalance(totalMoney)
        });
      } else {
        res.status(500).json({ error: 'Có lỗi xảy ra khi lưu dữ liệu' });
      }
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra khi truy cập database' });
    }
  });

  // API endpoint to get balance of a specific chat ID
  app.get('/api/balance', verifyToken, async (req, res) => {
    const { chatId } = req.query;
    
    try {
      if (chatId) {
        // Get balance for a specific chat ID
        const balance = await db.getChatValue(chatId);
        res.json({
          success: true,
          chatId: chatId,
          balance: balance,
          formattedBalance: formatBalance(balance)
        });
      } else {
        // Get total balance of all chat IDs
        const totalBalance = await db.getTotalMoney();
        res.json({
          success: true,
          totalBalance: totalBalance,
          formattedTotalBalance: formatBalance(totalBalance)
        });
      }
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra khi truy cập database' });
    }
  });

  app.get('/api/all-chats', verifyToken, async (req, res) => {
    try {
      const chatIds = await db.getAllChatIds();
      
      if (!chatIds || chatIds.length === 0) {
        return res.json({
          success: true,
          message: 'Không có chat ID nào được lưu trữ',
          chats: []
        });
      }
      
      const chatsWithBalances = [];
      for (const id of chatIds) {
        const balance = await db.getChatValue(id);
        chatsWithBalances.push({
          chatId: id,
          balance: balance,
          formattedBalance: formatBalance(balance)
        });
      }
      
      
      res.json({
        success: true,
        chats: chatsWithBalances
      });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ error: 'Có lỗi xảy ra khi truy cập database' });
    }
  });

  // Correct the route path from ' ' to '/api/send-message'
  app.post('/api/send-message', verifyToken, async (req, res) => {
    let { chatId, message } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu chatId hoặc nội dung tin nhắn' 
      });
    }
    if (!message) {
        message = 'Mọi người ơi, chiều nay mọi người chuẩn bị tâm hồn đẹp đi chơi cầu lông máu lửa nhóe 🏸🏸🏸🏸';
    }
    
    try {
      // Check if the chat ID exists in the database
      const exists = await db.hasChatId(chatId);
      
      if (!exists) {
        // Add it if it doesn't exist
        await db.addChatId(chatId);
      }
      
      // Ensure telegramBot is required and initialized correctly
      const telegramBot = require('./telegramBot'); 
      await telegramBot.bot.sendMessage(chatId, message);
      
      res.json({
        success: true,
        message: `Đã gửi tin nhắn đến chat ID ${chatId}`,
        chatId: chatId
      });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Có lỗi xảy ra khi gửi tin nhắn',
        details: error.message
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại cổng: ${PORT}`);
  });
};

initializeApp();