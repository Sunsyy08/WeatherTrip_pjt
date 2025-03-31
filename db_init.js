const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('travel.db');

db.serialize(() => {
  // ✅ destinations 테이블은 삭제하지 않고 유지
  db.run(`
    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      category TEXT,
      recommended_weather TEXT,
      contentid INTEGER
    )
  `);

  // ✅ users 테이블만 재생성 (테스트 용이하게 DROP 후 CREATE)
  db.run(`DROP TABLE IF EXISTS users`);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  console.log('✅ users 테이블 재생성 완료 (관광지 데이터는 유지)');
});

db.serialize(() => {
  // (기존 destinations, users 테이블은 유지)

// comments 테이블 재생성 (후기용)
db.run(`DROP TABLE IF EXISTS comments`);
db.run(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    contentid INTEGER NOT NULL, -- 관광지 고유번호 추가됨!
    timestamp DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
console.log('✅ comments 테이블 재생성 완료 (contentid 포함)');

});

db.close();
