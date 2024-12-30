import express from 'express';
import { MeiliSearch } from 'meilisearch';

const router = express.Router();

// MeiliSearch 클라이언트 설정
const client = new MeiliSearch({
  host: 'http://127.0.0.1:7700',
});

// Haversine 거리 계산 함수
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.post('/', async (req, res) => {
  try {
    const {
      hospitalName = '',
      user_latitude,
      user_longitude,
      limit = 30,
      offset = 0,
      filters = {
        distance: 100,
        rating: [],
        type: '모든 병원',
        info: [],
      },
    } = req.body;

    const indexMapping = {
      '상급종합병원': 'sangjonghap_hospital',
      '종합병원': 'jonghap_hospital',
      '요양병원': 'yoyang_hospital',
      '병원': 'byungwon_hospital',
      '의원': 'uione_hospital',
    };

    let indexesToSearch = [];
    if (filters.info && Array.isArray(filters.info) && filters.info.length > 0) {
      indexesToSearch = filters.info
        .map((info) => indexMapping[info])
        .filter(Boolean);
    } else {
      indexesToSearch = Object.values(indexMapping);
    }

    const searchOptions = {
      limit: 1000,
      filter: [],
    };

    if (filters.rating && Array.isArray(filters.rating) && filters.rating.length > 0) {
      searchOptions.filter.push(`rating IN [${filters.rating.join(', ')}]`);
    }

    if (filters.type && filters.type !== '모든 병원') {
      searchOptions.filter.push(`type = "${filters.type}"`);
    }

    const searchPromises = indexesToSearch.map(async (indexName) => {
      try {
        const index = client.index(indexName);
        const searchResult = await index.search(hospitalName, searchOptions);
        return searchResult.hits;
      } catch (error) {
        console.error(`Error searching index ${indexName}:`, error);
        return [];
      }
    });

    let mergedResults = (await Promise.all(searchPromises)).flat();

    mergedResults = mergedResults.map((hospital) => {
      const hospitalLatitude = parseFloat(hospital['좌표(Y)']);
      const hospitalLongitude = parseFloat(hospital['좌표(X)']);

      let distance = Infinity;
      if (
        !isNaN(hospitalLatitude) &&
        !isNaN(hospitalLongitude) &&
        user_latitude != null &&
        user_longitude != null
      ) {
        distance = haversineDistance(
          user_latitude,
          user_longitude,
          hospitalLatitude,
          hospitalLongitude
        );
      }

      return {
        ...hospital,
        distance,
        rating: hospital.rating || 0,
      };
    });

    if (filters.distance && filters.distance < 100) {
      mergedResults = mergedResults.filter(
        (hospital) =>
          typeof hospital.distance === 'number' && hospital.distance <= filters.distance
      );
    }

    mergedResults.sort((a, b) => {
      const distanceA = typeof a.distance === 'number' ? a.distance : Infinity;
      const distanceB = typeof b.distance === 'number' ? b.distance : Infinity;
      return distanceA - distanceB; // 올바르게 a.distance와 b.distance 비교
    });
    
    // 결과 확인용 로그
    // console.log('Sorted results:', mergedResults.map(h => ({ id: h.id, distance: h.distance })));
    
    const paginatedResults = mergedResults.slice(offset, offset + limit);
    
    res.json({
      total: mergedResults.length,
      results: paginatedResults,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(mergedResults.length / limit),
    });
    
  } catch (error) {
    console.error('Error during hospital search:', error);
    res.status(500).json({
      message: '병원 검색 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development'
        ? { message: error.message, stack: error.stack }
        : undefined,
    });
  }
});

export default router;
