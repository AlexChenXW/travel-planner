import mysql from "mysql2/promise";

let pool: mysql.Pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: "mysql6.sqlpub.com",
      port: 3311,
      user: "shallwechen",
      password: "4tITsMymIZ87AI29",
      database: "personal_knowledge",
      ssl: { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}
