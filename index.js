const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const fs = require('fs');

const app = express();
const port = 3000;

// SQLite 데이터베이스 연결
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('SQLite 연결 오류:', err.message);
  } else {
    console.log('SQLite 데이터베이스 연결됨.');
  }
});

// API 호출 및 데이터 저장 함수
const fetchAndSaveWeatherData = async () => {
  const url = 'https://apis.data.go.kr/1360000/TourStnInfoService1/getTourStnVilageFcst1';
  const params = {
    ServiceKey: 'x3RqAMlDK9a3lRjqkiWHCyGOWSesL%2FU51q1hPcvsQ%2Be7hbSSR%2BzjDNHR2k3W9dXl1zU6RqQFVS0ynjP%2FzEfBmw%3D%3D',
    pageNo: 10,
    numOfRows: 10,
    CURRENT_DATE: '2025-03-29',
    HOUR: 24,
    COURSE_ID: '경기도',
  };

  try {
    const response = await axios.get(url, { params });
    const weatherData = response.data;

    // 실제 응답에서 필요한 데이터를 추출하여 저장
    const weatherInfo = JSON.stringify(weatherData); // 예시로 데이터를 문자열로 저장

    // 데이터를 SQLite에 저장
    const stmt = db.prepare('INSERT INTO weather_data (course_id, current_date, hour, weather_info) VALUES (?, ?, ?, ?)');
    stmt.run('경기도', '2025-03-29', 24, weatherInfo, (err) => {
      if (err) {
        console.error('데이터 저장 오류:', err.message);
      } else {
        console.log('데이터가 성공적으로 저장되었습니다.');
      }
    });
    stmt.finalize();
  } catch (error) {
    console.error('API 호출 오류:', error);
  }
};

// 데이터베이스에서 데이터를 가져와 엑셀 파일로 저장하는 함수
const exportDataToExcel = () => {
  db.all('SELECT * FROM weather_data', (err, rows) => {
    if (err) {
      console.error('데이터베이스 조회 오류:', err.message);
    } else {
      // 엑셀 파일로 변환
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Weather Data');

      // 엑셀 파일 저장
      const filePath = './weather_data.xlsx';
      xlsx.writeFile(workbook, filePath);

      console.log(`엑셀 파일이 생성되었습니다: ${filePath}`);
    }
  });
};

// Express 라우트 설정
app.get('/', (req, res) => {
  res.send('날씨 데이터 API 호출 및 저장 예시');
});

// 데이터베이스에서 날씨 데이터를 가져오는 라우트
app.get('/weather', (req, res) => {
  db.all('SELECT * FROM weather_data', (err, rows) => {
    if (err) {
      console.error('데이터베이스 조회 오류:', err.message);
      res.status(500).send('데이터베이스 오류');
    } else {
      res.json(rows);
    }
  });
});

// 엑셀로 데이터 내보내기
app.get('/export', (req, res) => {
  exportDataToExcel();
  res.send('엑셀 파일로 데이터를 내보내는 중입니다.');
});


// 서버 시작
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);

  // 서버 시작 시 API를 호출하고 데이터를 저장
  fetchAndSaveWeatherData();
});
