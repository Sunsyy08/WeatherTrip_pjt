// checkDb.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('travel.db');

db.all("SELECT * FROM destinations LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error("❌ 에러:", err.message);
    return;
  }
  console.log("✅ 여행지 샘플 5개:", rows);
});

db.close();
