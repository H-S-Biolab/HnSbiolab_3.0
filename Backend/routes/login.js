import { getDb } from '../config/database.js';
import express from 'express';
const router = express.Router();

// 사용자 로그인 정보를 반환하는 /login
router.post('/login', async (req, res) => {
    const { providerId, provider } = req.body;
    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 정보 찾기
        const user = await usersCollection.findOne(
            { providerId, provider }
        );
    
        if (!user) {
            return res.status(404).json({ message: '일치하는 사용자가 없습니다.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('사용자 정보 조회 오류:', error.message);
        res.status(404).json({ error: '서버 오류로 인해 사용자 정보를 조회할 수 없습니다.' });
    }
});

router.post('/login_', async (req, res) => {
    const { providerId, provider } = req.body;

    if (!providerId || !provider) {
        return res.status(400).json({ message: 'providerId, provider가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // account 배열 내부에 해당 providerId, provider를 가진 문서(원소)가 있는지 검색
        const user = await usersCollection.findOne({
            account: { 
                $elemMatch: { providerId, provider } 
            }
        });

        if (!user) {
            return res.status(404).json({ message: '일치하는 사용자가 없습니다.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('사용자 정보 조회 오류 (login_):', error.message);
        res.status(500).json({ error: '서버 오류로 인해 사용자 정보를 조회할 수 없습니다.' });
    }
});

router.post('/registerByBirthdateAndName', async (req, res) => {
    const {
        name, gender, height, weight, birthdate, nickname, provider, providerId,
        chronic_kidney_disease, underlying_disease
    } = req.body;

    const { hypertension, diabetes, hyperlipidemia, retinal_complication } = underlying_disease || {};

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 이름과 생년월일이 일치하는 사용자 찾기
        const existingUser = await usersCollection.findOne({ name, birthdate });

        if (existingUser) {
            // 기존 사용자 처리
            if (!Array.isArray(existingUser.account)) {
                existingUser.account = [];
            }

            // 이미 등록된 account인지 확인
            const accountExists = existingUser.account.some(
                (account) => account.providerId === providerId && account.provider === provider
            );

            if (!accountExists) {
                // 새 account에 createdAt(YYMMDD) 필드 추가
                const accountCreatedAt = formatDateToYYMMDD(new Date());
                existingUser.account.push({
                    providerId,
                    provider,
                    createdAt: accountCreatedAt  // 추가된 필드
                });

                // DB 반영
                await usersCollection.updateOne(
                    { _id: existingUser._id },
                    { $set: { account: existingUser.account } }
                );
            }

            return res.status(200).json({ user: existingUser });
        } else {
            // 새로운 사용자 생성
            const formattedCreatedAt = formatDateToYYMMDD(new Date());
            const defaultProfileImage = 'https://hns-user-info.s3.ap-southeast-2.amazonaws.com/profiles/sampleProfile.png';

            // 계정 생성 시에도 accountCreatedAt 추가
            const accountCreatedAt = formatDateToYYMMDD(new Date());

            const newUser = {
                name,
                gender,
                height,
                weight,
                birthdate,
                nickname,
                chronic_kidney_disease,
                underlying_disease: {
                    hypertension,
                    diabetes,
                    hyperlipidemia,
                    retinal_complication
                },
                createdAt: formattedCreatedAt,
                profile_image: defaultProfileImage,
                // account에 createdAt 필드 추가
                account: [
                    {
                        providerId,
                        provider,
                        createdAt: accountCreatedAt
                    }
                ]
            };

            await usersCollection.insertOne(newUser);
            return res.status(201).json({ user: newUser });
        }
    } catch (error) {
        console.error('사용자 등록 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 사용자 등록을 할 수 없습니다.' });
    }
});





// YYMMDD 형식으로 변환하는 함수 (현재 날짜를 YYMMDD로 변환)
function formatDateToYYMMDD(date) {
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
}

export default router;
