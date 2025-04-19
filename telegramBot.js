require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'data.txt');

const token = process.env.TELEGRAM_BOT_TOKEN;

// Function để định dạng số tiền theo cách đọc dễ dàng
function formatBalance(amount) {
  // Chuyển đổi amount thành số (phòng trường hợp nó là chuỗi)
  amount = parseFloat(amount);
  
  if (isNaN(amount)) {
    return '0';
  }
  
  // Nếu số là âm, lấy giá trị tuyệt đối và thêm dấu trừ sau khi định dạng
  const isNegative = amount < 0;
  amount = Math.abs(amount);
  
  // Nếu số nhỏ hơn 1000, thêm 'k' vào sau
  if (amount < 1000) {
    return `${isNegative ? '-' : ''}${amount}k`;
  } 
  // Nếu số lớn hơn hoặc bằng 1000
  else {
    const millions = Math.floor(amount / 1000);
    const remaining = amount % 1000;
    
    if (remaining === 0) {
      // Nếu không có phần dư, chỉ hiển thị phần triệu
      return `${isNegative ? '-' : ''}${millions}tr`;
    } else {
      // Nếu có phần dư, hiển thị cả phần triệu và phần dư
      return `${isNegative ? '-' : ''}${millions}tr ${remaining}k`;
    }
  }
}

function parseAmount(amountStr) {
  if (typeof amountStr === 'string') {
    // Loại bỏ khoảng trắng, dấu phẩy và chuyển về chữ thường
    const cleanedStr = amountStr.trim().toLowerCase().replace(/,/g, '');
    
    // Trích xuất tất cả các chữ số từ chuỗi (bao gồm cả số thập phân)
    const numericMatch = cleanedStr.match(/(\d+(\.\d+)?)/);
    
    if (numericMatch && numericMatch[1]) {
      const numericValue = parseFloat(numericMatch[1]);
      
      // Xử lý hậu tố để nhân với hệ số phù hợp
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
  
  // Nếu không tìm thấy số, thử chuyển trực tiếp thành số
  return parseFloat(amountStr) || 0;
}

// Function để đọc số tiền từ file data.txt
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

// Tạo bot với polling
const bot = new TelegramBot(token, { polling: true });

const ADMIN_IDS = [
  // Thêm ID của admin vào đây
  // Ví dụ: 123456789
];

function isAdmin(msg) {
  // Bỏ kiểm tra admin, cho phép tất cả người dùng sử dụng bot
  return true;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Chào mừng đến với Bot Quản lý Quỹ! Sử dụng /help để xem các lệnh.');
});

// Xử lý lệnh /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
*Danh sách lệnh:*
/balance - Kiểm tra số dư
/add X - Cộng X vào quỹ 
/sub X - Trừ X từ quỹ 

*Ví dụ:*
/add 200 - Cộng 200k vào quỹ
/sub 1tr - Trừ 1tr từ quỹ
`;
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// Xử lý lệnh /balance
bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  
  const currentMoney = readMoney();
  const formattedBalance = formatBalance(currentMoney);
  
  bot.sendMessage(chatId, `Số dư hiện tại: ${formattedBalance}`);
});

bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(msg)) {
    return bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
  }
  
  const amountStr = match[1];
  const parsedAmount = parseAmount(amountStr);
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return bot.sendMessage(chatId, 'Vui lòng nhập số tiền hợp lệ và lớn hơn 0.');
  }
  
  const currentMoney = readMoney();
  const newMoney = currentMoney + parsedAmount;
  
  if (writeMoney(newMoney)) {
    bot.sendMessage(
      chatId,
      `Đã cộng ${parsedAmount}k vào quỹ.\nSố dư trước: ${formatBalance(currentMoney)}\nSố dư mới: ${formatBalance(newMoney)}`
    );
  } else {
    bot.sendMessage(chatId, 'Có lỗi xảy ra khi cập nhật số dư.');
  }
});

bot.onText(/\/sub (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(msg)) {
    return bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
  }
  
  const amountStr = match[1];
  const parsedAmount = parseAmount(amountStr);
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return bot.sendMessage(chatId, 'Vui lòng nhập số tiền hợp lệ và lớn hơn 0.');
  }
  
  const currentMoney = readMoney();
  const newMoney = currentMoney - parsedAmount;
  
  if (writeMoney(newMoney)) {
    bot.sendMessage(
      chatId,
      `Đã trừ ${parsedAmount} khỏi quỹ.\nSố dư trước: ${formatBalance(currentMoney)}\nSố dư mới: ${formatBalance(newMoney)}`
    );
  } else {
    bot.sendMessage(chatId, 'Có lỗi xảy ra khi cập nhật số dư.');
  }
});

bot.on('polling_error', (error) => {
  console.error('Lỗi polling:', error);
});

console.log('Bot Telegram đã được khởi động!');

module.exports = bot;