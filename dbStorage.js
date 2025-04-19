const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quycalong',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

const initDatabase = async () => {
  try {
    console.log('Initializing database with config:', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database
    });
    
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    await tempPool.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    
    await tempPool.end();
    
    pool = mysql.createPool(dbConfig);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_balances (
        chat_id VARCHAR(255) PRIMARY KEY,
        balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database connection established and tables created successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
};

const getChatValue = async (chatId) => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return 0;
    }
    
    const [rows] = await pool.query(
      'SELECT balance FROM chat_balances WHERE chat_id = ?',
      [chatId]
    );
    
    if (rows.length > 0) {
      return parseFloat(rows[0].balance);
    } else {
      await addChatId(chatId);
      return 0;
    }
  } catch (error) {
    console.error(`Error getting value for chat ID ${chatId}:`, error);
    return 0;
  }
};

const setChatValue = async (chatId, value) => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return false;
    }
    
    await pool.query(
      'INSERT INTO chat_balances (chat_id, balance) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE balance = ?, last_updated = CURRENT_TIMESTAMP',
      [chatId, value, value]
    );
    console.log(`Updated balance for chat ID ${chatId} to ${value}`);
    return true;
  } catch (error) {
    console.error(`Error setting value for chat ID ${chatId}:`, error);
    return false;
  }
};

const hasChatId = async (chatId) => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return false;
    }
    
    const [rows] = await pool.query(
      'SELECT 1 FROM chat_balances WHERE chat_id = ?',
      [chatId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking if chat ID ${chatId} exists:`, error);
    return false;
  }
};

const addChatId = async (chatId, defaultValue = 0) => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return false;
    }
    
    const exists = await hasChatId(chatId);
    if (!exists) {
      await pool.query(
        'INSERT INTO chat_balances (chat_id, balance) VALUES (?, ?)',
        [chatId, defaultValue]
      );
      console.log(`Added new chat ID ${chatId} with default value ${defaultValue}`);
    }
    return true;
  } catch (error) {
    console.error(`Error adding chat ID ${chatId}:`, error);
    return false;
  }
};

const getAllChatIds = async () => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return [];
    }
    
    const [rows] = await pool.query('SELECT chat_id FROM chat_balances');
    return rows.map(row => row.chat_id);
  } catch (error) {
    console.error('Error getting all chat IDs:', error);
    return [];
  }
};

const getMoney = async (chatId) => {
  try {
    if (!pool) {
      console.error('Database pool not initialized');
      return 0;
    }
    
    const exists = await hasChatId(chatId);
    if (!exists) {
      await addChatId(chatId, 0);
      return 0;
    }
    
    const [rows] = await pool.query(
      'SELECT balance FROM chat_balances WHERE chat_id = ?',
      [chatId]
    );
    
    return parseFloat(rows[0].balance || 0);
  } catch (error) {
    console.error(`Error getting money for chat ID ${chatId}:`, error);
    return 0;
  }
};

module.exports = {
  initDatabase,
  getChatValue,
  setChatValue,
  hasChatId,
  addChatId,
  getAllChatIds,
  getMoney
};