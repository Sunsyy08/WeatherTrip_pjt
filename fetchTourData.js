require('dotenv').config();
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('travel.db');

// ✅ 기존 테이블 삭제 후 재생성
db.serialize(() => {
  db.run("DROP TABLE IF EXISTS destinations");
  db.run(`
    CREATE TABLE destinations (
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
});

const areaCodes = [
  { name: '서울', code: 1 },
  { name: '부산', code: 6 },
  { name: '대전', code: 3 },
  { name: '대구', code: 4 },
  { name: '인천', code: 2 },
  { name: '광주', code: 5 },
  { name: '제주', code: 39 }
];

async function fetchAndInsert(areaCode, areaName) {
  let page = 1;
  const pageSize = 100;
  let totalCount = 0;

  while (true) {
    const url = `https://apis.data.go.kr/B551011/KorService1/areaBasedList1?serviceKey=${process.env.KTO_API_KEY}&numOfRows=${pageSize}&pageNo=${page}&MobileOS=ETC&MobileApp=WeatherTrip&_type=json&areaCode=${areaCode}`;

    try {
      const response = await axios.get(url);
      const body = response?.data?.response?.body;

      if (!body || !body.items) {
        console.warn(`⚠️ ${areaName}(${page}) 응답이 비어 있거나 형식이 다릅니다.`);
        break;
      }

      const items = body.items.item || [];
      const total = body.totalCount || 0;

      if (items.length === 0) break;

      const insert = db.prepare(`
        INSERT INTO destinations (name, city, latitude, longitude, category, recommended_weather, contentid)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach(item => {
        const name = item.title;
        const latitude = item.mapy;
        const longitude = item.mapx;
        const category = item.contenttypeid?.toString() || 'etc';
        const contentid = item.contentid;

        // 간단한 날씨 매핑
        const weather = category === '14' ? 'Rain' : 'Clear';

        if (latitude && longitude && contentid) {
          insert.run(name, areaName, latitude, longitude, category, weather, contentid);
        }
      });

      insert.finalize();
      totalCount += items.length;

      if (page * pageSize >= total) break;
      page++;

    } catch (err) {
      console.error(`❌ ${areaName}(${page}) 실패: ${err.message}`);
      break;
    }
  }

  console.log(`✅ ${areaName}: ${totalCount}개 저장 완료`);
}

async function main() {
  for (const area of areaCodes) {
    await fetchAndInsert(area.code, area.name);
  }
  db.close();
}

main();
