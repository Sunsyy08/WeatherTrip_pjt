const axios = require('axios');
const ExcelJS = require('exceljs');
const sqlite3 = require('sqlite3').verbose();

const API_URL = 'https://apis.data.go.kr/1360000/TourStnInfoService1/getTourStnVilageFcst1';
const SERVICE_KEY = 'x3RqAMlDK9a3lRjqkiWHCyGOWSesL%2FU51q1hPcvsQ%2Be7hbSSR%2BzjDNHR2k3W9dXl1zU6RqQFVS0ynjP%2FzEfBmw%3D%3D';

const COURSE_ID = 5; // 예시로 코스ID 5로 설정
const maxTourismSites = 100; // 가져올 최대 관광지 개수

// API 호출 함수
async function fetchTourismData(courseId) {
  const url = `${API_URL}?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=100&dataType=json&CURRENT_DATE=20250101&HOUR=24&COURSE_ID=${courseId}`;

  try {
    const response = await axios.get(url);
    return response.data.response.body.items.item; // API에서 받은 관광지 데이터
  } catch (error) {
    console.error('API 호출 실패', error);
    return [];
  }
}

// 엑셀 파일로 관광지 데이터를 내보내는 함수
async function exportTourismDataToExcel() {
  let tourismSites = [];
  let count = 0;

  // 관광지 데이터 가져오기
  const data = await fetchTourismData(COURSE_ID);
  console.log('받은 관광지 데이터:', data);  // 데이터를 콘솔에 출력하여 확인

  // 데이터가 없으면 종료
  if (!data || data.length === 0) {
    console.log('데이터가 없습니다.');
    return;
  }

  // 최대 관광지 개수에 도달하거나 데이터가 없을 때까지 반복
  for (const site of data) {
    if (count < maxTourismSites) {
      tourismSites.push(site);
      count++;
    } else {
      break;
    }
  }

  // Excel 워크북 및 워크시트 생성
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tourism Sites');

  // 워크시트 열 정의 (요청한 모든 키 포함)
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Date/Time', key: 'tm', width: 20 },
    { header: 'Thema', key: 'thema', width: 20 },
    { header: 'Course ID', key: 'courseId', width: 10 },
    { header: 'Course Area ID', key: 'courseAreaId', width: 20 },
    { header: 'Course Area Name', key: 'courseAreaName', width: 20 },
    { header: 'Course Name', key: 'courseName', width: 30 },
    { header: 'Spot Area ID', key: 'spotAreaId', width: 20 },
    { header: 'Spot Area Name', key: 'spotAreaName', width: 20 },
    { header: 'Spot Name', key: 'spotName', width: 30 },
    { header: 'TH3', key: 'th3', width: 10 },
    { header: 'WD', key: 'wd', width: 10 },
    { header: 'WS', key: 'ws', width: 10 },
    { header: 'Sky', key: 'sky', width: 10 },
    { header: 'RHM', key: 'rhm', width: 10 },
    { header: 'POP', key: 'pop', width: 10 },
  ];

  // 관광지 데이터를 행으로 추가
  tourismSites.forEach((site, index) => {
    worksheet.addRow({
      id: index + 1,  // ID는 1부터 시작하는 숫자로 설정
      tm: site.tm,
      thema: site.thema,
      courseId: site.courseId,
      courseAreaId: site.courseAreaId,
      courseAreaName: site.courseAreaName,
      courseName: site.courseName,
      spotAreaId: site.spotAreaId,
      spotAreaName: site.spotAreaName,
      spotName: site.spotName,
      th3: site.th3,
      wd: site.wd,
      ws: site.ws,
      sky: site.sky,
      rhm: site.rhm,
      pop: site.pop,
    });
  });

  // Excel 파일로 저장
  await workbook.xlsx.writeFile('tourism_sites.xlsx');
  console.log('관광지 데이터를 tourism_sites.xlsx 파일로 저장하였습니다.');
}

exportTourismDataToExcel();
