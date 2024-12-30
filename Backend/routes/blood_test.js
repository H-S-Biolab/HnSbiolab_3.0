import { getDb } from '../config/database.js';
import express from 'express';
const router = express.Router();
import { ObjectId } from 'mongodb';

// 새로운 혈액검사 결과 추가 API (수정됨)
router.put('/addBloodTestResult', async (req, res) => {
    const { providerId, BUN, creatinine, GFR, date } = req.body;

    if (!providerId || BUN === undefined || creatinine === undefined || GFR === undefined || !date) {
        return res.status(400).json({ error: 'providerId, BUN, creatinine, GFR, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 찾기
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 새로운 혈액검사 결과 생성
        const newBloodTestResult = {
            date,
            BUN,
            creatinine,
            GFR
        };

        // blood_test_result 리스트가 없으면 초기화
        if (!user.blood_test_result) {
            user.blood_test_result = [];
        }

        // blood_test_result 리스트에 새로운 결과 추가
        user.blood_test_result.push(newBloodTestResult);

        // 날짜 기준으로 정렬 (최신 날짜가 위로 오도록)
        user.blood_test_result.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 사용자 정보 업데이트
        const result = await usersCollection.updateOne(
            { providerId },
            { $set: { blood_test_result: user.blood_test_result } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ error: '혈액검사 결과를 추가할 수 없습니다.' });
        }

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 추가 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 추가할 수 없습니다.' });
    }
});

// 혈액검사 결과 수정 API 추가
router.put('/editBloodTestResult', async (req, res) => {
    const { providerId, originalDate, BUN, creatinine, GFR, date } = req.body;

    if (!providerId || !originalDate || BUN === undefined || creatinine === undefined || GFR === undefined || !date) {
        return res.status(400).json({ error: 'providerId, originalDate, BUN, creatinine, GFR, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 검사 결과 업데이트
        const result = await usersCollection.updateOne(
            { providerId, 'blood_test_result.date': originalDate },
            {
                $set: {
                    'blood_test_result.$.date': date,
                    'blood_test_result.$.BUN': BUN,
                    'blood_test_result.$.creatinine': creatinine,
                    'blood_test_result.$.GFR': GFR,
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: '혈액검사 결과를 수정할 수 없습니다.' });
        }

        // 수정된 사용자 정보 가져오기
        const user = await usersCollection.findOne({ providerId });

        // 날짜 기준으로 정렬
        user.blood_test_result.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 정렬된 결과로 업데이트
        await usersCollection.updateOne(
            { providerId },
            { $set: { blood_test_result: user.blood_test_result } }
        );

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 수정 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 수정할 수 없습니다.' });
    }
});

// 혈액검사 결과 삭제 API 추가
router.delete('/deleteBloodTestResult', async (req, res) => {
    const { providerId, date } = req.body;

    if (!providerId || !date) {
        return res.status(400).json({ error: 'providerId, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 검사 결과 삭제
        const result = await usersCollection.updateOne(
            { providerId },
            { $pull: { blood_test_result: { date: date } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: '혈액검사 결과를 삭제할 수 없습니다.' });
        }

        // 업데이트된 사용자 정보 가져오기
        const user = await usersCollection.findOne({ providerId });

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 삭제 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 삭제할 수 없습니다.' });
    }
});


// blood_test_result 초기 데이터로 설정 API (무조건 특정 리스트로 초기화)
router.post('/setBloodTestResultsDev', async (req, res) => {
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

        // blood_test_result 초기 데이터 설정 (조건 없이 항상 특정 값으로 설정)
        const initialBloodTestResults = [
            { date: "2024/11/14", BUN: 15, creatinine: 1.1, GFR: 40 },
            { date: "2024/09/14", BUN: 14, creatinine: 0.5, GFR: 92 },
            { date: "2024/07/14", BUN: 13, creatinine: 0.6, GFR: 94 }
        ];
        

        // 사용자 정보 업데이트
        await usersCollection.updateOne(
            { providerId },
            { $set: { blood_test_result: initialBloodTestResults } }
        );

        res.status(200).json(initialBloodTestResults);
    } catch (error) {
        console.error('blood_test_result 초기화 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 blood_test_result 초기화를 설정할 수 없습니다.' });
    }
});

// blood_test_result 비우기 API (조건 없이 항상 비우기)
router.post('/clearBloodTestResultsDev', async (req, res) => {
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

        // blood_test_result 리스트 비우기 (조건 없이 항상 비우기)
        await usersCollection.updateOne(
            { providerId },
            { $set: { blood_test_result: [] } }
        );

        res.status(200).json([]);
    } catch (error) {
        console.error('blood_test_result 비우기 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 blood_test_result를 비울 수 없습니다.' });
    }
});

//_id기준 사용자 식별 api===============================================================================
// 새로운 혈액검사 결과 추가 API (_id 사용)
router.put('/addBloodTestResultById', async (req, res) => {
    const { _id, BUN, creatinine, GFR, date } = req.body;
    if (!_id || BUN === undefined || creatinine === undefined || GFR === undefined || !date) {
        return res.status(400).json({ error: '_id, BUN, creatinine, GFR, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);
        const user = await usersCollection.findOne({ _id: objectId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const newBloodTestResult = { date, BUN, creatinine, GFR };

        if (!user.blood_test_result) {
            user.blood_test_result = [];
        }

        user.blood_test_result.push(newBloodTestResult);
        user.blood_test_result.sort((a, b) => new Date(b.date) - new Date(a.date));

        const result = await usersCollection.updateOne(
            { _id: objectId },
            { $set: { blood_test_result: user.blood_test_result } }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ error: '혈액검사 결과를 추가할 수 없습니다.' });
        }

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 추가 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 추가할 수 없습니다.' });
    }
});

// 혈액검사 결과 수정 API (_id 사용)
router.put('/editBloodTestResultById', async (req, res) => {
    const { _id, originalDate, BUN, creatinine, GFR, date } = req.body;

    if (!_id || !originalDate || BUN === undefined || creatinine === undefined || GFR === undefined || !date) {
        return res.status(400).json({ error: '_id, originalDate, BUN, creatinine, GFR, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);

        const result = await usersCollection.updateOne(
            { _id: objectId, 'blood_test_result.date': originalDate },
            {
                $set: {
                    'blood_test_result.$.date': date,
                    'blood_test_result.$.BUN': BUN,
                    'blood_test_result.$.creatinine': creatinine,
                    'blood_test_result.$.GFR': GFR,
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: '혈액검사 결과를 수정할 수 없습니다.' });
        }

        const user = await usersCollection.findOne({ _id: objectId });
        user.blood_test_result.sort((a, b) => new Date(b.date) - new Date(a.date));

        await usersCollection.updateOne(
            { _id: objectId },
            { $set: { blood_test_result: user.blood_test_result } }
        );

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 수정 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 수정할 수 없습니다.' });
    }
});

// 혈액검사 결과 삭제 API (_id 사용)
router.delete('/deleteBloodTestResultById', async (req, res) => {
    const { _id, date } = req.body;

    if (!_id || !date) {
        return res.status(400).json({ error: '_id, date가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const objectId = new ObjectId(_id);

        const result = await usersCollection.updateOne(
            { _id: objectId },
            { $pull: { blood_test_result: { date: date } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: '혈액검사 결과를 삭제할 수 없습니다.' });
        }

        const user = await usersCollection.findOne({ _id: objectId });

        res.status(200).json(user.blood_test_result);
    } catch (error) {
        console.error('혈액검사 결과 삭제 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 혈액검사 결과를 삭제할 수 없습니다.' });
    }
});

// blood_test_result 초기 데이터 설정 API (_id 사용)
router.post('/setBloodTestResultsDevById', async (req, res) => {
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

        const initialBloodTestResults = [
            { date: "2024/11/14", BUN: 15, creatinine: 1.1, GFR: 40 },
            { date: "2024/09/14", BUN: 14, creatinine: 0.5, GFR: 92 },
            { date: "2024/07/14", BUN: 13, creatinine: 0.6, GFR: 94 }
        ];

        await usersCollection.updateOne(
            { _id: objectId },
            { $set: { blood_test_result: initialBloodTestResults } }
        );

        res.status(200).json(initialBloodTestResults);
    } catch (error) {
        console.error('blood_test_result 초기화 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 blood_test_result 초기화를 설정할 수 없습니다.' });
    }
});

// blood_test_result 비우기 API (_id 사용)
router.post('/clearBloodTestResultsDevById', async (req, res) => {
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
            { $set: { blood_test_result: [] } }
        );

        res.status(200).json([]);
    } catch (error) {
        console.error('blood_test_result 비우기 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 blood_test_result를 비울 수 없습니다.' });
    }
});

export default router;
