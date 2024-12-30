import express from 'express';
import { getDb } from '../config/database.js';
import Codef from 'easycodef-node';
import axios from 'axios';
import { dummy_pdf } from '../dummy_pdf.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import fs from 'fs';
import { ObjectId } from 'mongodb';

const upload = multer();

// AWS S3 설정
const s3Client = new S3Client({
    region: 'us-east-1', // 새로운 리전에 맞게 변경
});
const BUCKET_NAME = 'hns-user-info2'; // 새로운 버킷 이름
const ORIGINAL_PDF_FOLDER = 'healthChechup/';

const router = express.Router();

const codef = new Codef.EasyCodef();

// Public Key 및 Client Info 설정
codef.setPublicKey('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqfXKg8TrD2Jl8aTK6Hp33PTxCeoTksbBHvLLT9RNBpDKpKvaVi6HX4JE+9RWHM7Z/29H3sVL0F5Uht6F1I2Vhs2muufh3gKlfkEv0rCWqV/s/QqlRp8yZBzNHkR5pqXkZx2+kuFa73pdsbNxnUrsvatqeuQb1WPdztj4hDTrJA4JmAf+mKXLn4kzQofYy1UuUSg925fi5HK+RWAaBR47TkBsxPapKxmTnylPqW0o67KV5dCM22MVhW4WUEwEhlxZjzJC9ROpkDr61mZD17uVCroxJ2GDAhplPmOKKVJyKA8qnDBzRqlJBmuuK1BuxbiA9ZiVKaOhTU1MuEulU/UsRwIDAQAB');
codef.setClientInfoForDemo('9d2e5a02-2373-4cba-8295-af07f7f5d5a3', '2f9a1516-2d85-4424-90a1-1a9b510d384f');

const { EasyCodefConstant } = Codef;

async function processDataWithPdfUrls(filteredData, providerId) {
    const processedData = [];

    for (const item of filteredData) {
        // Generate S3 file key and URL for each PDF
        const timestamp = Date.now();
        const fileKey = `${ORIGINAL_PDF_FOLDER}${providerId}_${item.resCheckupYear}.pdf`;

        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: Buffer.from(item.resOriGinalData, 'base64'), // Convert base64 to buffer
            ContentType: 'application/pdf',
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${fileKey}`;

        // Store processed data with S3 URL
        processedData.push({
            ...item,
            resOriGinalData: s3Url,
        });
    }

    return processedData;
}

// Helper function to upload base64 PDF to S3 and return the file URL
async function uploadPdfToS3(providerId, checkupYear, base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const fileKey = `${ORIGINAL_PDF_FOLDER}${providerId}_${checkupYear}.pdf`;

    const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: 'application/pdf',
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return `https://${BUCKET_NAME}.s3.ap-southeast-2.amazonaws.com/${fileKey}`;
}

async function deleteExistingPdfsFromS3(healthCheckupList) {
    const deletePromises = healthCheckupList
        .filter(item => item.resOriGinalData && item.resOriGinalData.startsWith(`https://${BUCKET_NAME}.s3.ap-southeast-2.amazonaws.com/${ORIGINAL_PDF_FOLDER}`))
        .map(item => {
            const fileKey = item.resOriGinalData.split(`${BUCKET_NAME}.s3.ap-southeast-2.amazonaws.com/`)[1];
            const deleteParams = {
                Bucket: BUCKET_NAME,
                Key: fileKey,
            };
            return s3Client.send(new DeleteObjectCommand(deleteParams));
        });

    return Promise.all(deletePromises);
}


// 건강 검진 정보 요청 함수
async function getHealthCheckupInfo(identity, loginTypeLevel, userName, telecom, phoneNo) {
    const currentYear = new Date().getFullYear().toString();  // 현재 연도를 문자열로 가져옴
    const param = {
        "organization": "0002",
        "loginType": "5",
        "inquiryType": "5",
        "identity": identity, // 예: 19980820
        "loginTypeLevel": loginTypeLevel, // 1:카카오톡, 2:페이코, 3:삼성패스, 4:KB모바일, 5:통신사(PASS), 6:네이버, 7:신한인증서, 8: toss
        "userName": userName, // 예: 곽태윤
        "telecom": telecom, // “0":SKT(SKT알뜰폰), “1”:KT(KT알뜰폰), “2":LG U+(LG U+알뜰폰)
        "phoneNo": phoneNo, // 예: 01092874435
        "searchStartYear": "2000",
        "searchEndYear": currentYear,
    };
    try {
        const response = await codef.requestProduct(
            '/v1/kr/public/pp/nhis-health-checkup/result',
            EasyCodefConstant.SERVICE_TYPE_DEMO,
            param
        );
        console.log("one",response);
        return response;
    } catch (error) {
        console.error('Error fetching health checkup info:', error.response ? error.response.status : error.message);
        throw error;
    }
}

// 2차 인증 요청 함수
async function getHealthCheckupInfoTwo(identity, loginTypeLevel, userName, telecom, phoneNo, jti, twoWayTimestamp) {
    const currentYear = new Date().getFullYear().toString();  // 현재 연도를 문자열로 가져옴

    const param = {
        "organization": "0002",
        "loginType": "5",
        "identity": identity, // 예: 19980820
        "loginTypeLevel": loginTypeLevel, // 1:카카오톡, 2:페이코, 3:삼성패스, 4:KB모바일, 5:통신사(PASS), 6:네이버, 7:신한인증서, 8: toss
        "userName": userName, // 예: 곽태윤
        "telecom": telecom, // “0":SKT(SKT알뜰폰), “1”:KT(KT알뜰폰), “2":LG U+(LG U+알뜰폰)
        "phoneNo": phoneNo, // 예: 01092874435
        "searchStartYear": "2014",
        "searchEndYear": currentYear,
        "simpleAuth": "1",
        "secureNo": "",
        "secureNoRefresh": "",
        "is2Way": true,
        "twoWayInfo": {
            "jobIndex": 0,
            "threadIndex": 0,
            "jti": jti,
            "twoWayTimestamp": twoWayTimestamp
        }
    };
    console.log("Two\n",param);
    try {
        const response = await codef.requestProduct(
            '/v1/kr/public/pp/nhis-health-checkup/result',
            EasyCodefConstant.SERVICE_TYPE_DEMO,
            param
        );
        console.log('2차 인증 결과:', response);
        //fs.writeFileSync('./test.txt', JSON.stringify(JSON.parse(response || '{}'), null, 2), 'utf8');
        return response;
    } catch (error) {
        console.error('2차 인증 에러:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// 데이터 포맷팅 함수
function formatHealthCheckupData(data) {
    let filteredData = [];
  
    // 먼저 data가 JSON 문자열인지 확인하고, 파싱에 실패하면 빈 배열 반환
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.error('JSON parse error:', error);
      return filteredData;
    }
  
    // 데이터 구조 확인
    if (
      data.data &&
      Array.isArray(data.data.resPreviewList) &&
      data.data.resPreviewList.length > 0 &&
      Array.isArray(data.data.resResultList)
    ) {
      const { resPreviewList, resResultList } = data.data;
  
      // resPreviewList를 순회하며, 해당 연도(resCheckupYear)에 맞는 PDF(base64)를 resResultList에서 찾음
      filteredData = resPreviewList.map((previewItem) => {
        // previewItem의 연도
        const previewYear = previewItem.resCheckupYear;
        
        // 매칭되는 resResultList 항목 찾기
        // 동일한 연도가 여러 개 있을 경우, 'find'는 첫 번째로 발견된 항목만 리턴
        const matchedResultItem = resResultList.find(
          (resultItem) => resultItem.resCheckupYear === previewYear
        );
  
        // base64 PDF (없으면 빈 문자열 혹은 0)
        const pdfBase64 = matchedResultItem?.resOriGinalData || '';
  
        return {
          // PDF 데이터
          resOriGinalData: pdfBase64,
  
          // 연도 및 날짜
          resCheckupYear: previewItem.resCheckupYear || 0,
          resCheckupDate: previewItem.resCheckupDate || 0,
  
          // 비만도
          resHeight: previewItem.resHeight || 0,
          resWeight: previewItem.resWeight || 0,
          resWaist: previewItem.resWaist || 0,
          resBMI: previewItem.resBMI || 0,
  
          // 신장병 (2년주기)
          resSerumCreatinine: previewItem.resSerumCreatinine || 0,
          resGFR: previewItem.resGFR || 0,
          resUrinaryProtein: previewItem.resUrinaryProtein || 0,
  
          // 고혈압 (2년주기)
          resBloodPressure: previewItem.resBloodPressure || 0,
  
          // 당뇨 (2년주기)
          resFastingBloodSuger: previewItem.resFastingBloodSuger || 0,
  
          // 이상지질혈증 (4년주기)
          resTotalCholesterol: previewItem.resTotalCholesterol || 0,
          resHDLCholesterol: previewItem.resHDLCholesterol || 0,
          resLDLCholesterol: previewItem.resLDLCholesterol || 0,
  
          // 빈혈 (2년주기)
          resHemoglobin: previewItem.resHemoglobin || 0,
  
          // 간장질환 (2년주기)
          resAST: previewItem.resAST || 0,
          resALT: previewItem.resALT || 0,
          resyGPT: previewItem.resyGPT || 0,
        };
      });
  
      // filteredData를 년도(resCheckupYear) 내림차순, 같은 연도면 날짜(resCheckupDate) 내림차순으로 정렬
      filteredData.sort((a, b) => {
        const yearA = parseInt(a.resCheckupYear, 10);
        const yearB = parseInt(b.resCheckupYear, 10);
  
        if (yearB === yearA) {
          return parseInt(b.resCheckupDate, 10) - parseInt(a.resCheckupDate, 10);
        }
        return yearB - yearA;
      });
  
    } else {
      // resPreviewList가 없거나 구조가 다를 경우
      console.log('no data');
    }
  
    return filteredData;
  }
  

router.post('/healthCheckupDevById', async (req, res) => {
    const { _id } = req.body;  // 프론트에서 _id를 _id라는 이름으로 받는다고 가정

    if (!_id) {
        return res.status(400).json({ message: '_id가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // _id를 ObjectId로 변환해서 찾기
        const existingUser = await usersCollection.findOne({ _id: new ObjectId(_id) });

        if (existingUser) {
            // 1) 기존 healthCheckup이 있다면, S3에서 모두 삭제
            if (existingUser.healthCheckup) {
                await deleteExistingPdfsFromS3(existingUser.healthCheckup);
            }

            // 2) dummyData를 S3에 업로드하고 URL로 대체
            const processedData = await processDataWithPdfUrls(dummyData.filteredData, _id);

            // 3) DB에 업데이트
            await usersCollection.updateOne(
                { _id: new ObjectId(_id) },
                { $set: { healthCheckup: processedData } }
            );

            console.log(`User ${_id} healthCheckup data updated (by _id).`);

            // DB에서 갱신된 데이터를 다시 가져와서 응답
            const updatedUser = await usersCollection.findOne({ _id: new ObjectId(_id) });
            const responseData = updatedUser.healthCheckup;

            return res.status(200).json({ data: responseData });
        } else {
            console.log('User not found.');
            return res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error('Failed to update health checkup data:', error);
        return res.status(500).json({ message: 'Failed to update health checkup data.', error: error.message });
    }
});

router.post('/healthCheckupDevRemoveById', async (req, res) => {
    const { _id } = req.body;

    if (!_id) {
        return res.status(400).json({ message: '_id가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const user = await usersCollection.findOne({ _id: new ObjectId(_id) });
        if (!user) {
            console.log('User not found.');
            return res.status(404).json({ message: 'User not found.' });
        }

        // S3에 업로드된 healthCheckup PDF 파일들 삭제
        if (user.healthCheckup && user.healthCheckup.length > 0) {
            await deleteExistingPdfsFromS3(user.healthCheckup);
        }

        // DB에서 healthCheckup 필드 제거
        await usersCollection.updateOne(
            { _id: new ObjectId(_id) },
            { $unset: { healthCheckup: "" } }
        );

        console.log(`Health checkup data removed (by _id): ${_id}`);
        return res.status(200).json({ message: '사용자의 건강검진 데이터가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('Failed to remove health checkup data:', error);
        return res.status(500).json({ message: 'Failed to remove health checkup data.', error: error.message });
    }
});

router.post('/step1ById', async (req, res) => {
    const { 
        _id,   // _id
        identity, 
        loginTypeLevel, 
        userName, 
        telecom, 
        phoneNo 
    } = req.body;

    if (!_id || !identity || !loginTypeLevel || !userName || !telecom || !phoneNo) {
        return res.status(400).json({ message: '필수 필드가 제공되지 않았습니다.' });
    }

    try {
        // 1차 인증 요청 (기존 로직 재사용)
        const healthCheckupInfo = await getHealthCheckupInfo(identity, loginTypeLevel, userName, telecom, phoneNo);
        const parsedResponse = JSON.parse(healthCheckupInfo);

        // 응답만 프론트에 넘긴다. (DB 저장은 2차 인증 후 step2ById에서)
        return res.status(201).json(parsedResponse);
    } catch (error) {
        console.error('데이터 조회 실패:', error);
        return res.status(500).json({ message: error.message });
    }
});

router.post('/step2ById', async (req, res) => {
    const {
        _id,          // _id
        identity,
        loginTypeLevel,
        userName,
        telecom,
        phoneNo,
        jti,
        twoWayTimestamp,
    } = req.body;

    if (
        !_id ||
        !identity ||
        !loginTypeLevel ||
        !userName ||
        !telecom ||
        !phoneNo ||
        !jti ||
        !twoWayTimestamp
    ) {
        return res.status(400).json({ message: '필수 필드가 제공되지 않았습니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 기존 사용자 확인
        const existingUser = await usersCollection.findOne({ _id: new ObjectId(_id) });

        // 이미 존재하는 healthCheckup 삭제 (S3 파일 포함)
        if (existingUser && existingUser.healthCheckup) {
            await deleteExistingPdfsFromS3(existingUser.healthCheckup);
        }

        // 2차 인증으로 건강검진 데이터 받기
        const healthCheckupInfoTwo = await getHealthCheckupInfoTwo(
            identity,
            loginTypeLevel,
            userName,
            telecom,
            phoneNo,
            jti,
            twoWayTimestamp
        );

        // 가져온 데이터를 포맷팅
        let filteredData = formatHealthCheckupData(healthCheckupInfoTwo);

        // 필요한 경우, 데이터가 없으면 dummyData로 대체할 수도 있음
        // if (filteredData.length === 0) {
        //     filteredData = dummyData.filteredData;
        // }

        // PDF를 S3에 올리고, resOriGinalData를 URL로 변환
        const processedData = await processDataWithPdfUrls(filteredData, _id);

        // DB에 저장
        // (기존 saveHealthCheckupToUserByProviderId 함수를 수정/복사해서 _id 기준 버전으로 쓰거나,
        //  여기에서 바로 updateOne을 사용해도 됩니다.)
        await usersCollection.updateOne(
            { _id: new ObjectId(_id) },
            { $set: { healthCheckup: processedData } }
        );

        // 갱신된 데이터 반환
        const updatedUser = await usersCollection.findOne({ _id: new ObjectId(_id) });
        const responseData = updatedUser.healthCheckup;

        return res.status(200).json({ filteredData: responseData });
    } catch (error) {
        console.error('2차 인증 후 데이터 저장 실패:', error);
        return res.status(500).json({ message: error.message, body: req.body });
    }
});
export default router;
