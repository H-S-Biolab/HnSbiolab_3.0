import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from '../config/database.js';
import express from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';

const router = express.Router();
const upload = multer();

// AWS S3 설정
const s3Client = new S3Client({
    region: 'us-east-1', // 변경된 리전에 맞게 설정
});
const BUCKET_NAME = 'hns-user-info2';
const DEFAULT_PROFILE_IMAGE = 'https://hns-user-info.s3.ap-southeast-2.amazonaws.com/profiles/sampleProfile.png';

// 사용자 프로필 이미지 업로드 API
router.put('/uploadProfileImage', upload.single('profileImage'), async (req, res) => {
    const { providerId } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: '프로필 이미지가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 기존 프로필 이미지 삭제
        if (user.profileImage && !user.profileImage.includes('sampleProfile.png')) {
            try {
                const url = new URL(user.profileImage);
                const fileKey = url.pathname.substring(1); // 앞의 '/' 제거
                const deleteParams = {
                    Bucket: BUCKET_NAME,
                    Key: fileKey,
                };

                await s3Client.send(new DeleteObjectCommand(deleteParams));
            } catch (deleteError) {
                console.error('기존 프로필 이미지 삭제 오류:', deleteError.message);
                // 이미지 삭제 실패 시에도 계속 진행
            }
        }

        // 새로운 프로필 이미지 업로드
        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop();
        const fileKey = `profiles/${user._id}_${timestamp}.${fileExtension}`; // 폴더 경로 추가

        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        // 파일 업로드
        await s3Client.send(new PutObjectCommand(uploadParams));

        // 명시적으로 region을 설정하여 URL 생성
        const region = 'us-east-1'; // S3 리전 설정 (필요한 리전으로 교체)
        const profileImageUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileKey}`;

        // 사용자 정보에 profileImage 필드 업데이트
        await usersCollection.updateOne(
            { providerId },
            { $set: { profileImage: profileImageUrl } }
        );

        res.status(200).json({
            message: '프로필 이미지가 성공적으로 업로드되었습니다.',
            profileImage: profileImageUrl,
        });
    } catch (error) {
        console.error('프로필 이미지 업로드 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 프로필 이미지를 업로드할 수 없습니다.' });
    }
});

// 사용자 푸시 알림 설정 업데이트 API
router.put('/updatePushNotificationSettings', async (req, res) => {
    const { providerId, alarmEnabled, startDate, repeatInterval } = req.body;

    if (!providerId) {
        return res.status(400).json({ error: 'providerId가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        const result = await usersCollection.updateOne(
            { providerId },
            { $set: { pushNotificationSettings: { alarmEnabled, startDate, repeatInterval } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.status(200).json({ message: '푸시 알림 설정이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('푸시 알림 설정 업데이트 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 푸시 알림 설정을 업데이트할 수 없습니다.' });
    }
});

router.put('/updateUser', async (req, res) => {
    const {
      providerId,
      gender,
      height,
      weight,
      birthdate,
      nickname,
      chronic_kidney_disease,
      underlying_disease,
    } = req.body;
  
    //console.log('Received request to update user:', req.body);
  
    if (!providerId) {
      return res.status(400).json({ error: 'providerId가 필요합니다.' });
    }
  
    try {
      const db = getDb();
      const usersCollection = db.collection('users_v2');
  
      //console.log('Searching for providerId:', providerId);
  
      const user = await usersCollection.findOne({ providerId });
  
      if (!user) {
        //console.log('User not found with providerId:', providerId);
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }
  
      //console.log('User found:', user);
  
      const updateFields = {};
      if (gender !== undefined) updateFields.gender = gender;
      if (height !== undefined) updateFields.height = height;
      if (weight !== undefined) updateFields.weight = weight;
      if (birthdate !== undefined) updateFields.birthdate = birthdate;
      if (nickname !== undefined) updateFields.nickname = nickname;
      if (chronic_kidney_disease !== undefined)
        updateFields.chronic_kidney_disease = chronic_kidney_disease;
      if (underlying_disease !== undefined)
        updateFields.underlying_disease = underlying_disease;
  
      //console.log('Updating fields:', updateFields);
  
      const result = await usersCollection.updateOne(
        { providerId },
        { $set: updateFields }
      );
  
      //console.log('Update result:', result);
  
      if (result.matchedCount === 0) {
        //console.log('No documents matched the query.');
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }
  
      res.status(200).json({ message: '사용자 정보가 성공적으로 업데이트되었습니다.' });
    } catch (error) {
      //console.error('사용자 정보 업데이트 오류:', error);
      res.status(500).json({ error: '서버 오류로 인해 사용자 정보를 업데이트할 수 없습니다.' });
    }
});

// 회원탈퇴 API
router.delete('/deleteUser', async (req, res) => {
    const { providerId } = req.body;

    if (!providerId) {
        return res.status(400).json({ error: 'providerId가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // 사용자 정보 조회
        const user = await usersCollection.findOne({ providerId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // S3에서 healthCheckup 파일 삭제
        if (user.healthCheckup && user.healthCheckup.length > 0) {
            for (const item of user.healthCheckup) {
                if (item.resOriGinalData) {
                    const fileKey = new URL(item.resOriGinalData).pathname.substring(1);
                    const deleteParams = {
                        Bucket: BUCKET_NAME,
                        Key: fileKey,
                    };
                    await s3Client.send(new DeleteObjectCommand(deleteParams));
                }
            }
        }

        // S3에서 profileImage 삭제 (기본 이미지 제외)
        if (user.profileImage && user.profileImage !== DEFAULT_PROFILE_IMAGE) {
            const fileKey = new URL(user.profileImage).pathname.substring(1);
            const deleteParams = {
                Bucket: BUCKET_NAME,
                Key: fileKey,
            };
            await s3Client.send(new DeleteObjectCommand(deleteParams));
        }

        // MongoDB에서 사용자 정보 삭제
        await usersCollection.deleteOne({ providerId });

        console.log(`User with providerId ${providerId} deleted.`);
        res.status(200).json({ message: '사용자가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('회원탈퇴 실패:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 회원탈퇴에 실패했습니다.' });
    }
});

//_id기준 사용자 식별 api========================================================================================

router.put('/updatePushNotificationSettingsById', async (req, res) => {
    const { _id, alarmEnabled, startDate, repeatInterval } = req.body;

    if (!_id) {
        return res.status(400).json({ error: '_id가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // ObjectId 변환
        const objectId = new ObjectId(_id);

        const result = await usersCollection.updateOne(
            { _id: objectId },
            { $set: { pushNotificationSettings: { alarmEnabled, startDate, repeatInterval } } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.status(200).json({ message: '푸시 알림 설정이 성공적으로 업데이트되었습니다.' });
    } catch (error) {
        console.error('푸시 알림 설정 업데이트 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 푸시 알림 설정을 업데이트할 수 없습니다.' });
    }
});

router.put('/updateUserById', async (req, res) => {
    const {
      _id,
      gender,
      height,
      weight,
      birthdate,
      nickname,
      chronic_kidney_disease,
      underlying_disease,
    } = req.body;

    if (!_id) {
      return res.status(400).json({ error: '_id가 필요합니다.' });
    }

    try {
      const db = getDb();
      const usersCollection = db.collection('users_v2');

      // ObjectId 변환
      const objectId = new ObjectId(_id);

      const user = await usersCollection.findOne({ _id: objectId });

      if (!user) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      const updateFields = {};
      if (gender !== undefined) updateFields.gender = gender;
      if (height !== undefined) updateFields.height = height;
      if (weight !== undefined) updateFields.weight = weight;
      if (birthdate !== undefined) updateFields.birthdate = birthdate;
      if (nickname !== undefined) updateFields.nickname = nickname;
      if (chronic_kidney_disease !== undefined)
        updateFields.chronic_kidney_disease = chronic_kidney_disease;
      if (underlying_disease !== undefined)
        updateFields.underlying_disease = underlying_disease;

      const result = await usersCollection.updateOne(
        { _id: objectId },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      res.status(200).json({ message: '사용자 정보가 성공적으로 업데이트되었습니다.' });
    } catch (error) {
      res.status(500).json({ error: '서버 오류로 인해 사용자 정보를 업데이트할 수 없습니다.' });
    }
});

// 사용자 프로필 이미지 업로드 API
router.put('/uploadProfileImageById', upload.single('profileImage'), async (req, res) => {
    const { _id } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: '프로필 이미지가 필요합니다.' });
    }

    try {
        const db = getDb();
        const usersCollection = db.collection('users_v2');

        // ObjectId 변환
        const objectId = new ObjectId(_id);
        const user = await usersCollection.findOne({ _id: objectId });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 기존 프로필 이미지 삭제
        if (user.profileImage && !user.profileImage.includes('sampleProfile.png')) {
            try {
                const url = new URL(user.profileImage);
                const fileKey = url.pathname.substring(1); // 앞의 '/' 제거
                const deleteParams = {
                    Bucket: BUCKET_NAME,
                    Key: fileKey,
                };

                await s3Client.send(new DeleteObjectCommand(deleteParams));
            } catch (deleteError) {
                console.error('기존 프로필 이미지 삭제 오류:', deleteError.message);
                // 이미지 삭제 실패 시에도 계속 진행
            }
        }

        // 새로운 프로필 이미지 업로드
        const timestamp = Date.now();
        const fileExtension = file.originalname.split('.').pop();
        const fileKey = `profiles/${user._id}_${timestamp}.${fileExtension}`; // 폴더 경로 추가

        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        // 파일 업로드
        await s3Client.send(new PutObjectCommand(uploadParams));

        // 명시적으로 region을 설정하여 URL 생성
        const region = 'us-east-1'; // S3 리전 설정 (필요한 리전으로 교체)
        const profileImageUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${fileKey}`;

        // 사용자 정보에 profileImage 필드 업데이트
        await usersCollection.updateOne(
            { _id: objectId },
            { $set: { profileImage: profileImageUrl } }
        );

        res.status(200).json({
            message: '프로필 이미지가 성공적으로 업로드되었습니다.',
            profileImage: profileImageUrl,
        });
    } catch (error) {
        console.error('프로필 이미지 업로드 오류:', error.message);
        res.status(500).json({ error: '서버 오류로 인해 프로필 이미지를 업로드할 수 없습니다.' });
    }
});

export default router;
