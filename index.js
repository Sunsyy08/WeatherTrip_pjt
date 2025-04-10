// app.js
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('travel.db');
const SECRET_KEY = process.env.JWT_SECRET;
app.use(express.json()); // ✅ 이 줄이 반드시 있어야 함!
const authenticateToken = require('./authMiddleware'); // JWT 인증 미들웨어


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
          SELECT name, city, latitude, longitude, category, contentid
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
    const item = rawItems?.item;

    let imageUrl = null;

    if (Array.isArray(item) && item.length > 0 && item[0].originimgurl) {
      imageUrl = item[0].originimgurl;
    } else if (typeof item === 'object' && item.originimgurl) {
      imageUrl = item.originimgurl;
    }

    // ✅ 여기에 이 부분 추가하세요!!
    if (!imageUrl && Array.isArray(item) && item.length > 0) {
      const serialnum = item[0].serialnum;
      const filePart = serialnum.split('_')[0];
      imageUrl = `http://tong.visitkorea.or.kr/cms/resource/${filePart.slice(-2)}/${filePart}_image2_1.jpg`;
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error('❌ 이미지 API 호출 실패:', err.message);
    res.status(500).json({ error: '이미지 API 호출 실패' });
  }
});


// ✅ 회원가입
app.post('/users', async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed], function (err) {
      if (err) {
        return res.status(400).json({ error: '회원가입 실패', details: err.message });
      }

      res.status(201).json({ message: '회원가입 성공', userId: this.lastID });
    });
  } catch (err) {
    res.status(500).json({ error: '서버 오류', details: err.message });
  }
});

// ✅ 로그인
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: '이메일을 찾을 수 없습니다' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });

    res.json({ message: '로그인 성공', token });
  });
});


// 기존 회원가입/로그인 API는 이미 구현되어 있다고 가정합니다.

// -----------------------------------------------------------------
// /articles API (모든 기능은 로그인한 사용자만 가능)
// -----------------------------------------------------------------

// 1. 전체 게시글 조회 (GET /articles)
//    - 로그인한 사용자만 볼 수 있도록 authenticateToken 미들웨어 사용
// 2. 기존 /articles 엔드포인트를 수정하여 contentid 필터링 기능 추가
app.get('/articles', authenticateToken, (req, res) => {
  const contentId = req.query.contentid;
  
  let sql = `
    SELECT 
      c.id, 
      c.title, 
      c.content,
      c.contentid,
      c.timestamp,
      u.email AS author
    FROM comments c
    JOIN users u ON c.user_id = u.id
  `;
  
  let params = [];
  
  // contentId가 제공된 경우에만 필터링
  if (contentId) {
    sql += ` WHERE c.contentid = ?`;
    params.push(contentId);
  }
  
  sql += ` ORDER BY c.id DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '게시글 조회 실패', details: err.message });
    }
    res.json(rows);
  });
});

// 1. 특정 관광지의 후기만 조회하는 엔드포인트 추가
app.get('/api/destinations/:contentid/articles', authenticateToken, (req, res) => {
  const contentId = req.params.contentid;
  console.log("✅ 후기 조회 요청 들어옴:", contentId);

  const sql = `
    SELECT 
      c.id, 
      c.title, 
      c.content,
      c.contentid,
      c.timestamp,
      u.email AS author
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.contentid = ?
    ORDER BY c.id DESC
  `;
  
  db.all(sql, [contentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '후기 조회 실패', details: err.message });
    }
    res.json(rows);
  });
});


// 3. 관광지 상세 정보 조회 시 해당 관광지의 후기도 함께 가져오는 엔드포인트
app.get('/api/destinations/:contentid', authenticateToken, (req, res) => {
  const contentId = req.params.contentid;
  
  // 관광지 정보 조회
  const destinationSql = `
    SELECT name, city, latitude, longitude, category, contentid
    FROM destinations
    WHERE contentid = ?
  `;
  
  db.get(destinationSql, [contentId], (err, destination) => {
    if (err) {
      return res.status(500).json({ error: '관광지 조회 실패', details: err.message });
    }
    
    if (!destination) {
      return res.status(404).json({ error: '관광지를 찾을 수 없습니다.' });
    }
    
    // 해당 관광지의 후기 조회
    const reviewsSql = `
      SELECT 
        c.id, 
        c.title, 
        c.content,
        c.timestamp,
        u.email AS author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.contentid = ?
      ORDER BY c.id DESC
    `;
    
    db.all(reviewsSql, [contentId], (err, reviews) => {
      if (err) {
        return res.status(500).json({ error: '후기 조회 실패', details: err.message });
      }
      
      // 관광지 정보와 후기 정보를 함께 응답
      res.json({
        destination,
        reviews
      });
    });
  });
});

// 특정 게시글(후기) 하나만 조회 (GET /articles/:id)
app.get('/articles/:id', authenticateToken, (req, res) => {
  const articleId = req.params.id;

  // comments 테이블과 users 테이블을 JOIN해서 
  // 해당 게시글 + 작성자 정보(email)까지 가져오는 예시
  const sql = `
    SELECT 
      c.id, 
      c.title, 
      c.content,
      c.contentid,
      c.timestamp,
      c.user_id,
      u.email AS author
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `;

  db.get(sql, [articleId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'DB 오류', details: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '게시글이 존재하지 않습니다.' });
    }

    // 게시글 데이터 반환
    res.json(row);
  });
});

// 관광지 이름 가져오는 API 추가
app.get('/api/destinations/name/:contentid', (req, res) => {
  const contentId = req.params.contentid;
  
  db.get('SELECT name FROM destinations WHERE contentid = ?', [contentId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'DB 오류', details: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: '관광지를 찾을 수 없습니다' });
    }
    
    res.json({ name: row.name });
  });
});


// 2. 게시글 작성 (POST /articles)
//    - 로그인한 사용자만 작성 가능하며, 작성 시 토큰에 담긴 user_id를 함께 저장
//    - comments 테이블에서 게시글을 조회하며, 작성자(email) 정보를 users 테이블과 조인
// 기존 POST /articles 엔드포인트 수정 - contentid 필수 유효성 검증 추가
app.post('/articles', authenticateToken, (req, res) => {
  const { title, content, contentid } = req.body;
  const userId = req.user.id;
  
  // contentid 유효성 검증 추가
  if (!contentid) {
    return res.status(400).json({ error: '관광지 ID(contentid)가 필요합니다' });
  }
  
  // 해당 contentid가 실제 존재하는지 확인 (destinations 테이블 조회)
  db.get('SELECT * FROM destinations WHERE contentid = ?', [contentid], (err, destination) => {
    if (err) {
      return res.status(500).json({ error: 'DB 오류', details: err.message });
    }
    
    if (!destination) {
      return res.status(404).json({ error: '존재하지 않는 관광지입니다' });
    }
    
    // 검증이 완료되면 후기 저장
    const sql = `INSERT INTO comments (title, content, user_id, contentid) VALUES (?, ?, ?, ?)`;
    db.run(sql, [title, content, userId, contentid], function(err) {
      if (err) {
        return res.status(500).json({ error: '후기 작성 실패', details: err.message });
      }
      res.status(201).json({ 
        message: '후기 작성 완료', 
        articleId: this.lastID,
        destinationName: destination.name  // 관광지 이름 추가
      });
    });
  });
});





// 3. 게시글 수정 (PUT /articles/:id)
//    - 수정은 해당 게시글의 작성자만 가능하도록 체크 (user_id 비교)
// 후기(게시글) 수정 - 작성자만 가능
app.put('/articles/:id', authenticateToken, (req, res) => {
  const articleId = req.params.id;
  const { title, content } = req.body;
  const userId = req.user.id;

  db.get('SELECT * FROM comments  WHERE id = ?', [articleId], (err, article) => {
    if (err) return res.status(500).json({ error: '게시글 조회 실패', details: err.message });
    if (!article) return res.status(404).json({ error: '게시글이 존재하지 않습니다.' });
    if (article.user_id !== userId) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    db.run('UPDATE comments  SET title = ?, content = ? WHERE id = ?', [title, content, articleId], function(err) {
      if (err) return res.status(500).json({ error: '게시글 수정 실패', details: err.message });
      res.json({ message: '게시글 수정 완료' });
    });
  });
});

// 후기(게시글) 삭제 - 작성자만 가능
app.delete('/articles/:id', authenticateToken, (req, res) => {
  const articleId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT * FROM comments  WHERE id = ?', [articleId], (err, article) => {
    if (err) return res.status(500).json({ error: '게시글 조회 실패', details: err.message });
    if (!article) return res.status(404).json({ error: '게시글이 존재하지 않습니다.' });
    if (article.user_id !== userId) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    db.run('DELETE FROM comments  WHERE id = ?', [articleId], function(err) {
      if (err) return res.status(500).json({ error: '게시글 삭제 실패', details: err.message });
      res.json({ message: '게시글 삭제 완료' });
    });
  });
});


app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
