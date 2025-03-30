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


app.get('/api/recommend', (req, res) => {
  const { city, weather } = req.query;

  const sql = `
    SELECT name, city, latitude, longitude, category
    FROM destinations
    WHERE city = ? AND recommended_weather = ?
  `;

  db.all(sql, [city, weather], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
