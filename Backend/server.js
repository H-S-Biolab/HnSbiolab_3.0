// server.js

// tmux new -s ns_v2로 프로세스 할당
import { connectToDatabase } from './config/database.js';
import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';

const app = express();

// HTTP 포트 설정 (루트 권한 없이 실행 가능하도록 3000 포트를 사용)
const PORT = process.env.PORT || 5000;

// DB 연결 및 HTTP 서버 실행
connectToDatabase().then(() => {
  http.createServer(app).listen(PORT, () => { // http 서버로 변경
    console.log(`HTTP Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to the database:', err);
  process.exit(1); // 데이터베이스 연결 실패 시 서버 종료
});

// 라우트 설정
import health_checkup_routes from './routes/health_checkup.js';
import blood_test_routes from './routes/blood_test.js'
import kit_routes from './routes/kit.js';
import medicine_routes from './routes/medicine.js';
import hospital_routes from './routes/hospital.js';
import login_routes from './routes/login.js';
import user_info from './routes/user_info.js';

app.use(express.json()); // JSON 파싱 미들웨어 추가
app.use(bodyParser.json()); // JSON 파서 미들웨어 설정

// 루트('/') 엔드포인트에 "hello hns" 응답 추가
app.get('/', (req, res) => {
  res.send('hello hns_v2');
});

app.use('/health_checkup', health_checkup_routes);
app.use('/kit', kit_routes);
app.use('/medicine', medicine_routes);
app.use('/hospital', hospital_routes);
app.use('/login', login_routes);
app.use('/user_info', user_info);
app.use('/blood_test', blood_test_routes);

// 오류 핸들링 미들웨어 추가 (필요에 따라 확장 가능)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});