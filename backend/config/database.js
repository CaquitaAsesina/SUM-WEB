const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true });

let pool = null;

function getPool() {
  if (pool) return pool;

  const useSSL = process.env.DB_SSL === 'true';

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '-05:00',
    connectTimeout: 10000,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined
  });

  return pool;
}

// Proxy that lazily initializes the pool
module.exports = {
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection(),
  execute: (...args) => getPool().execute(...args)
};
