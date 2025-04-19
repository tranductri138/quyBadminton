require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const dataFilePath = path.join(__dirname, 'data.txt');
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!fs.existsSync(dataFilePath)) {
  try {
    fs.writeFileSync(dataFilePath, '0');
    console.log('Đã tạo file data.txt với giá trị mặc định là 0');
  } catch (error) {
    console.error('Lỗi khi tạo file data.txt:', error);
  }
}

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

function readMoney() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return parseFloat(data) || 0;
  } catch (error) {
    console.error('Lỗi khi đọc file:', error);
    return 0;
  }
}

function writeMoney(amount) {
  try {
    fs.writeFileSync(dataFilePath, amount.toString());
    return true;
  } catch (error) {
    console.error('Lỗi khi ghi file:', error);
    return false;
  }
}

function parseAmount(amount) {
  return parseFloat(amount);
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
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});