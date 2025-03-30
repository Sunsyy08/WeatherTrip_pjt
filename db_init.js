const sqlite3 = require('sqlite3').verbose();

// SQLite 데이터베이스 연결
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('SQLite 연결 오류:', err.message);
  } else {
    console.log('SQLite 데이터베이스 연결됨.');
  }
});

// 테이블 생성 (없으면 생성)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT,
      current_date TEXT,
      hour INTEGER,
      weather_info TEXT
    )
  `, (err) => {
    if (err) {
      console.error('테이블 생성 오류:', err.message);
    } else {
      console.log('테이블이 성공적으로 생성되었습니다.');
    }
  });
});

// 데이터베이스 연결 종료
db.close();
