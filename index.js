require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Import File Storage module thay vì Redis
const { readMoney, writeMoney } = require('./fileStorage');

// Khởi động Telegram Bot
require('./telegramBot');

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

app.post('/api/add', verifyToken, (req, res) => {
  const { amount } = req.body;
  
  if (!amount || (isNaN(parseAmount(amount)) || parseAmount(amount) <= 0)) {
    return res.status(400).json({ error: 'Số tiền cần cộng phải là số dương' });
  }

  const currentMoney = readMoney();
  const parsedAmount = parseAmount(amount);
  const newMoney = currentMoney + parsedAmount;
  
  if (writeMoney(newMoney)) {
    res.json({
      success: true,
      message: `Đã cộng ${parsedAmount} vào tài khoản`,
      inputAmount: amount,
      parsedAmount: parsedAmount,
      previousBalance: currentMoney,
      formattedPreviousBalance: formatBalance(currentMoney),
      newBalance: newMoney,
      formattedNewBalance: formatBalance(newMoney)
    });
  } else {
    res.status(500).json({ error: 'Có lỗi xảy ra khi lưu dữ liệu' });
  }
});

app.post('/api/subtract', verifyToken, (req, res) => {
  const { amount } = req.body;
  
  if (!amount || (isNaN(parseAmount(amount)) || parseAmount(amount) <= 0)) {
    return res.status(400).json({ error: 'Số tiền cần trừ phải là số dương' });
  }
  
  const currentMoney = readMoney();
  const parsedAmount = parseAmount(amount);
  const newMoney = currentMoney - parsedAmount;
  
  if (writeMoney(newMoney)) {
    res.json({
      success: true,
      message: `Đã trừ ${parsedAmount} từ tài khoản`,
      inputAmount: amount,
      parsedAmount: parsedAmount,
      previousBalance: currentMoney,
      formattedPreviousBalance: formatBalance(currentMoney),
      newBalance: newMoney,
      formattedNewBalance: formatBalance(newMoney)
    });
  } else {
    res.status(500).json({ error: 'Có lỗi xảy ra khi lưu dữ liệu' });
  }
});

app.get('/api/balance', verifyToken, (req, res) => {
  const currentMoney = readMoney();
  res.json({
    balance: currentMoney,
    formattedBalance: formatBalance(currentMoney)
  });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng: ${PORT}`);
});