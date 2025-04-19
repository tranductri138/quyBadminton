const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'data.txt');

const readMoney = () => {
  try {
    if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, '0');
      console.log('Đã tạo file data.txt với giá trị mặc định là 0');
      return 0;
    }
    
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return parseFloat(data) || 0;
  } catch (error) {
    console.error('Lỗi khi đọc file:', error);
    return 0;
  }
};

const writeMoney = (amount) => {
  try {
    fs.writeFileSync(dataFilePath, amount.toString());
    return true;
  } catch (error) {
    console.error('Lỗi khi ghi file:', error);
    return false;
  }
};

module.exports = {
  readMoney,
  writeMoney,
  dataFilePath
};