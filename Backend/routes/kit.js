import { getDb } from '../config/database.js';
import express from 'express';
const router = express.Router();
import { ObjectId } from 'mongodb';

// 새로운 테스트 결과 추가 API
router.put('/addTestResult', async (req, res) => {
    const { providerId, testResult } = req.body;

    if (!providerId || !testResult) {
        return res.status(400).json({ error: 'providerId와 testResult가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 찾기
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 새로운 테스트 결과 생성
        const newTestResult = {
            datetime: new Date().toISOString().replace('T', ' ').split('.')[0].replace(/-/g, '/'), // YYYY/MM/DD HH:MM:SS 형식의 날짜 문자열
            result: testResult
        };

        // kit_result 리스트가 없으면 초기화
        if (!user.kit_result) {
            user.kit_result = [];
        }

        // kit_result 리스트에 새로운 결과 추가
        user.kit_result.push(newTestResult);

        // 사용자 정보 업데이트
        const result = await usersCollection.updateOne(
            { providerId },
            { $set: { kit_result: user.kit_result } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ error: '테스트 결과를 추가할 수 없습니다.' });
        }

        res.status(200).json(user.kit_result);
    } catch (error) {
        console.error('테스트 결과 추가 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 테스트 결과를 추가할 수 없습니다.' });
    }
});

// kit_result 초기 데이터로 설정 API (무조건 특정 리스트로 초기화)
router.post('/setTestResultsDev', async (req, res) => {
    const { providerId } = req.body;

    if (!providerId) {
        return res.status(400).json({ error: 'providerId가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 찾기
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // kit_result 초기 데이터 설정 (조건 없이 항상 특정 값으로 설정)
        const initialKitResults = [
            { datetime: "2024/11/13 00:00:00", result: 1 },
            { datetime: "2024/10/30 00:00:00", result: 0 },
            { datetime: "2024/10/13 00:00:00", result: 0 },
            { datetime: "2024/09/29 00:00:00", result: 0 }
        ];

        // 사용자 정보 업데이트
        await usersCollection.updateOne(
            { providerId },
            { $set: { kit_result: initialKitResults } }
        );

        res.status(200).json(initialKitResults);
    } catch (error) {
        console.error('kit_result 초기화 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 kit_result 초기화를 설정할 수 없습니다.' });
    }
});

// kit_result 비우기 API (조건 없이 항상 비우기)
router.post('/clearTestResultsDev', async (req, res) => {
    const { providerId } = req.body;

    if (!providerId) {
        return res.status(400).json({ error: 'providerId가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 찾기
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // kit_result 리스트 비우기 (조건 없이 항상 비우기)
        await usersCollection.updateOne(
            { providerId },
            { $set: { kit_result: [] }
        });

        res.status(200).json([]);
    } catch (error) {
        console.error('kit_result 비우기 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 kit_result를 비울 수 없습니다.' });
    }
});

//_id기준 사용자 식별 api===============================================================================
// 새로운 테스트 결과 추가 API (_id 사용)
router.post('/addTestResultById', async (req, res) => {
    // 프론트에서 전달: _id, testResult, datetime
    const { _id, testResult, datetime } = req.body;
    console.log(req.body);

    // datetime이 반드시 필요하다면 아래처럼 체크
    if (!_id || !testResult || !datetime) {
        return res.status(400).json({ error: '_id, testResult, datetime이 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);

        // 사용자 찾기
        const user = await usersCollection.findOne({ _id: objectId });
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 프론트에서 받은 datetime 문자열과 testResult를 그대로 사용
        const newTestResult = {
            datetime,        // 예: "2024/12/01 15:30:00"
            result: testResult
        };

        // kit_result 배열이 없으면 초기화
        if (!user.kit_result) {
            user.kit_result = [];
        }

        // kit_result에 새 데이터 추가
        user.kit_result.push(newTestResult);

        // DB 업데이트
        const result = await usersCollection.updateOne(
            { _id: objectId },
            { $set: { kit_result: user.kit_result } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ error: '테스트 결과를 추가할 수 없습니다.' });
        }

        // 성공적으로 업데이트된 kit_result 배열을 응답
        res.status(200).json(user.kit_result);
    } catch (error) {
        console.error('테스트 결과 추가 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 테스트 결과를 추가할 수 없습니다.' });
    }
});

// kit_result 초기 데이터 설정 API (_id 사용)
router.post('/setTestResultsDevById', async (req, res) => {
    const { _id } = req.body;

    if (!_id) {
        return res.status(400).json({ error: '_id가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);

        const user = await usersCollection.findOne({ _id: objectId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const initialKitResults = [
            { datetime: "2024/11/13 00:00:00", result: 1 },
            { datetime: "2024/10/30 00:00:00", result: 0 },
            { datetime: "2024/10/13 00:00:00", result: 0 },
            { datetime: "2024/09/29 00:00:00", result: 0 }
        ];

        await usersCollection.updateOne(
            { _id: objectId },
            { $set: { kit_result: initialKitResults } }
        );

        res.status(200).json(initialKitResults);
    } catch (error) {
        console.error('kit_result 초기화 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 kit_result 초기화를 설정할 수 없습니다.' });
    }
});

// kit_result 비우기 API (_id 사용)
router.post('/clearTestResultsDevById', async (req, res) => {
    const { _id } = req.body;

    if (!_id) {
        return res.status(400).json({ error: '_id가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);

        const user = await usersCollection.findOne({ _id: objectId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        await usersCollection.updateOne(
            { _id: objectId },
            { $set: { kit_result: [] } }
        );

        res.status(200).json([]);
    } catch (error) {
        console.error('kit_result 비우기 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 kit_result를 비울 수 없습니다.' });
    }
});

export default router;
