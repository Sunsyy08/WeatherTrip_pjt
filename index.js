// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('travel.db');


const PORT = 3000;

// CORS 허용 (개발용)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.use(express.static('public'));


// 날씨 API 엔드포인트
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

// app.js (또는 routes/api.js)
app.get('/api/weather/all', async (req, res) => {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  const cityIds = [
    1835848, // 서울
    1838524, // 부산
    1835329, // 대구
    1843564, // 인천
    1841811, // 광주
    1835235, // 대전
    1833747, // 울산
    1835553, // 수원
    1846326, // 창원
    1846266  // 제주
  ];

  const url = `https://api.openweathermap.org/data/2.5/group?id=${cityIds.join(',')}&appid=${apiKey}&units=metric`;

  try {
    const response = await axios.get(url);
    res.json(response.data); // 응답을 그대로 보내줌
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch national weather data" });
  }
});

// 지도에 여행지 정보 표시, html 연결 
app.get('/api/recommend', (req, res) => {
  const { city, weather } = req.query;

  const sql = `
  SELECT name, city, latitude, longitude, category, contentid
  FROM destinations
  WHERE city = ? AND recommended_weather = ?
  LIMIT 100
`;


  db.all(sql, [city, weather], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// ✅ 새로 추가: forecast API (3시간 예보)
app.get('/api/forecast', async (req, res) => {
  const { lat, lon, datetime } = req.query;

  if (!lat || !lon || !datetime) {
    return res.status(400).json({ error: 'lat, lon, datetime 쿼리 필요함' });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  try {
    const response = await axios.get(url);
    const forecasts = response.data.list;

    const targetTime = new Date(datetime); // 사용자가 입력한 시간

    // 예보 중 가장 가까운 시간 찾기
    let closest = null;
    let smallestDiff = Infinity;

    for (const f of forecasts) {
      const forecastTime = new Date(f.dt_txt);
      const diff = Math.abs(forecastTime - targetTime);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = f;
      }
    }

    if (!closest) {
      return res.status(404).json({ error: '예보 데이터 없음' });
    }

    res.json({
      datetime: closest.dt_txt,
      weather: closest.weather[0].main,
      temp: closest.main.temp
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'API 요청 실패' });
  }
});

//예보 api 기반으로 여행지 추천
app.get('/api/recommendByForecast', async (req, res) => {
  const { lat, lon, datetime, city } = req.query;

  if (!lat || !lon || !datetime || !city) {
    return res.status(400).json({ error: 'lat, lon, datetime, city 모두 필요해요' });
  }

  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=metric`;

  try {
    const forecastRes = await axios.get(forecastUrl);
    const forecasts = forecastRes.data.list;
    const targetTime = new Date(datetime);
    let closest = null;
    let minDiff = Infinity;

    for (const f of forecasts) {
      const forecastTime = new Date(f.dt_txt);
      const diff = Math.abs(forecastTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }

    if (!closest) {
      return res.status(404).json({ error: '해당 시간대 예보가 없어요' });
    }

    const weather = closest.weather[0].main;
    console.log(`Forecast weather for ${datetime}: ${weather}`);

    // 기본 추천 쿼리 (도시와 날씨 조건 모두 사용)
    const sql = `
      SELECT name, city, latitude, longitude, category, contentid
      FROM destinations
      WHERE city = ? AND recommended_weather = ?
      LIMIT 100
    `;

    db.all(sql, [city, weather], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB 오류', details: err.message });

      if (!rows || rows.length === 0) {
        // Fallback: 날씨 조건 없이 도시만 사용하여 데이터 반환
        const fallbackSql = `
          SELECT name, city, latitude, longitude, category
          FROM destinations
          WHERE city = ?
          LIMIT 100
        `;
        db.all(fallbackSql, [city], (err2, fallbackRows) => {
          if (err2) return res.status(500).json({ error: 'DB 오류', details: err2.message });
          return res.json({
            forecast_time: closest.dt_txt,
            weather,
            temp: closest.main.temp,
            recommended_places: fallbackRows,
            note: "날씨 조건과 일치하는 데이터가 없어, 도시 기준 전체 데이터를 반환합니다."
          });
        });
      } else {
        res.json({
          forecast_time: closest.dt_txt,
          weather,
          temp: closest.main.temp,
          recommended_places: rows
        });
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: '예보 API 실패' });
  }
});

// 예시: /api/getImage 엔드포인트 (이미지 API 연동)
// 이미지 조회 API (관광지 contentid 기반)
app.get('/api/getImage', async (req, res) => {
  const { contentid } = req.query;

  if (!contentid) {
    return res.status(400).json({ error: 'contentid가 필요합니다' });
  }

  try {
    const url = `https://apis.data.go.kr/B551011/KorService1/detailImage1?serviceKey=${process.env.KTO_API_KEY}&MobileOS=ETC&MobileApp=WeatherTrip&_type=json&contentId=${contentid}&imageYN=Y`;

    const response = await axios.get(url);
    const rawItems = response.data?.response?.body?.items;

    console.log('✅ 이미지 API 응답:', JSON.stringify(rawItems, null, 2));

    let imageUrl = null;

    // ✅ 이미지 추출 로직
    if (rawItems?.item) {
      const item = rawItems.item;

      if (Array.isArray(item) && item.length > 0 && item[0].originimgurl) {
        imageUrl = item[0].originimgurl;
      } else if (typeof item === 'object' && item.originimgurl) {
        imageUrl = item.originimgurl;
      }
    }

    if (!imageUrl) {
      console.warn('❌ originimgurl이 없음!');
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error('❌ 이미지 API 호출 실패:', err.message);
    res.status(500).json({ error: '이미지 API 호출 실패' });
  }
});







app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
