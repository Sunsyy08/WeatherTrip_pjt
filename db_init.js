// initDb.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('travel.db');

db.serialize(() => {
  // 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      category TEXT,
      recommended_weather TEXT
    )
  `);

  // 샘플 데이터 삽입
  const stmt = db.prepare(`
    INSERT INTO destinations (name, city, latitude, longitude, category, recommended_weather)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const data = [
    ['남산타워', 'Seoul', 37.5512, 126.9882, 'outdoor', 'Clear'],
    ['국립중앙박물관', 'Seoul', 37.5230, 126.9804, 'indoor', 'Rain'],
    ['경복궁', 'Seoul', 37.5796, 126.9770, 'outdoor', 'Clear'],
    ['해운대 해수욕장', 'Busan', 35.1587, 129.1604, 'outdoor', 'Clear'],
    ['감천문화마을', 'Busan', 35.0972, 129.0104, 'culture', 'Clouds'],
    ['부산아쿠아리움', 'Busan', 35.1580, 129.1534, 'indoor', 'Rain']
  ];

  data.forEach(row => stmt.run(row));
  stmt.finalize();
});

db.close();
