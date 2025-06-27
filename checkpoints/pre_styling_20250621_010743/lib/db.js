import mysql from 'mysql2/promise';

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to execute queries
export async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to get a single row
export async function getOne(sql, params) {
  const results = await query(sql, params);
  return results[0];
}

// Helper function to insert data and return the inserted ID
export async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await query(sql, values);
  return result.insertId;
}

// Helper function to update data
export async function update(table, data, where) {
  const setClause = Object.keys(data)
    .map(key => `${key} = ?`)
    .join(', ');
  const whereClause = Object.keys(where)
    .map(key => `${key} = ?`)
    .join(' AND ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  const values = [...Object.values(data), ...Object.values(where)];
  
  return await query(sql, values);
}

// Helper function to delete data
export async function remove(table, where) {
  const whereClause = Object.keys(where)
    .map(key => `${key} = ?`)
    .join(' AND ');
  
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  return await query(sql, Object.values(where));
} 