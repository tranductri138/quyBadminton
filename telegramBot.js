require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./dbStorage');

// Token của bot từ BotFather
const token = process.env.TELEGRAM_BOT_TOKEN;

// Kiểm tra token hợp lệ trước khi khởi tạo bot
if (!token || token === 'your_telegram_bot_token' || token.includes('your_')) {
  console.log('CẢNH BÁO: Token Telegram bot chưa được cấu hình. Bot sẽ không hoạt động.');
  // Export một đối tượng giả để tránh lỗi khi import
  module.exports = {
    isConfigured: false,
    bot: null
  };
  return; // Dừng việc khởi tạo bot
}

// Function để định dạng số tiền theo cách đọc dễ dàng
function formatBalance(amount) {
  amount = parseFloat(amount);
  
  if (isNaN(amount)) {
    return '0';
  }
  
  const isNegative = amount < 0;
  amount = Math.abs(amount);
  
  if (amount < 1000) {
    return `${isNegative ? '-' : ''}${amount}k`;
  } else {
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
        return numericValue;
      }
      
      if (cleanedStr.includes('tr') || cleanedStr.includes('triệu') || cleanedStr.includes('trieu')) {
        return numericValue * 1000;
      }
      
      if (cleanedStr.includes('tỷ') || cleanedStr.includes('ty')) {
        return numericValue * 1000000;
      }
      
      return numericValue;
    }
  }
  
  return parseFloat(amountStr) || 0;
}

const bot = new TelegramBot(token, { polling: true });

// Database operation wrapper to handle async operations
const handleDbOperation = async (chatId, operation, errorMessage) => {
  try {
    return await operation();
  } catch (error) {
    console.error(error);
    if (chatId) {
      await bot.sendMessage(chatId, errorMessage || 'Có lỗi xảy ra khi truy cập database.');
    }
    return null;
  }
};

const ADMIN_IDS = [
  // Thêm ID của admin vào đây
  // Ví dụ: 123456789
];

function isAdmin(msg) {
  return true;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  await handleDbOperation(chatId, 
    async () => await db.addChatId(chatId.toString()),
    'Có lỗi xảy ra khi khởi tạo dữ liệu người dùng.'
  );
  
  await bot.sendMessage(chatId, 'Chào mừng đến với Bot Quản lý Quỹ! Sử dụng /help để xem các lệnh.');
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  await handleDbOperation(chatId, 
    async () => await db.addChatId(chatId.toString()),
    'Có lỗi xảy ra khi khởi tạo dữ liệu người dùng.'
  );
  
  const helpText = `
*Danh sách lệnh:*
/balance - Kiểm tra tổng số dư
/add X - Cộng X vào số dư của bạn
/sub X - Trừ X từ số dư của bạn

*Ví dụ:*
/add 200 - Cộng 200k vào số dư của bạn
/sub 1tr - Trừ 1tr từ số dư của bạn
`;
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  
  await handleDbOperation(chatId, 
    async () => await db.addChatId(chatId.toString()),
    'Có lỗi xảy ra khi khởi tạo dữ liệu người dùng.'
  );
  
  const balance = await handleDbOperation(chatId,
    async () => await db.getChatValue(chatId.toString()),
    'Có lỗi xảy ra khi lấy số dư.'
  );
  
  if (balance !== null) {
    const formattedBalance = formatBalance(balance);
    await bot.sendMessage(chatId, `Số dư trong quỹ: ${formattedBalance}`);
  }
});

bot.onText(/\/add (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  await handleDbOperation(chatId, 
    async () => await db.addChatId(chatId.toString()),
    'Có lỗi xảy ra khi khởi tạo dữ liệu người dùng.'
  );
  
  const amountStr = match[1];
  const parsedAmount = parseAmount(amountStr);
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return await bot.sendMessage(chatId, 'Vui lòng nhập số tiền hợp lệ và lớn hơn 0.');
  }
  
  const currentValue = await handleDbOperation(chatId,
    async () => await db.getChatValue(chatId.toString()),
    'Có lỗi xảy ra khi lấy số dư cá nhân.'
  );
  
  if (currentValue === null) return;
  
  const newValue = currentValue + parsedAmount;
  
  const success = await handleDbOperation(chatId,
    async () => await db.setChatValue(chatId.toString(), newValue),
    'Có lỗi xảy ra khi cập nhật số dư.'
  );
  
  if (success) {
    // Gọi getTotalMoney với chatId để chỉ lấy số dư của chatId hiện tại
    const balance = await db.getChatValue(chatId.toString());
    
    await bot.sendMessage(
      chatId,
      `Đã cộng ${formatBalance(parsedAmount)} vào quỹ.\nSố dư trước: ${formatBalance(currentValue)}\nSố dư mới: ${formatBalance(newValue)}`
    );
  }
});

bot.onText(/\/sub (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  await handleDbOperation(chatId, 
    async () => await db.addChatId(chatId.toString()),
    'Có lỗi xảy ra khi khởi tạo dữ liệu người dùng.'
  );
  
  const amountStr = match[1];
  const parsedAmount = parseAmount(amountStr);
  
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return await bot.sendMessage(chatId, 'Vui lòng nhập số tiền hợp lệ và lớn hơn 0.');
  }
  
  const currentValue = await handleDbOperation(chatId,
    async () => await db.getChatValue(chatId.toString()),
    'Có lỗi xảy ra khi lấy số dư cá nhân.'
  );
  
  if (currentValue === null) return;
  
  const newValue = currentValue - parsedAmount;
  
  const success = await handleDbOperation(chatId,
    async () => await db.setChatValue(chatId.toString(), newValue),
    'Có lỗi xảy ra khi cập nhật số dư.'
  );
  
  if (success) {
    await bot.sendMessage(
      chatId,
      `Đã trừ ${formatBalance(parsedAmount)} từ quỹ.\nSố dư trước: ${formatBalance(currentValue)}\nSố dư mới: ${formatBalance(newValue)}`
    );
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  try {
    await db.addChatId(chatId.toString());
  } catch (error) {
    console.error(`Error adding chat ID ${chatId}:`, error);
  }
});

bot.on('polling_error', (error) => {
  console.error('Lỗi polling:', error);
});

console.log('Bot Telegram đã được khởi động!');

module.exports = {
  bot
};