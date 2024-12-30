import express from 'express';
import { MeiliSearch } from 'meilisearch';

const router = express.Router();

const client = new MeiliSearch({
  host: 'http://127.0.0.1:7700'
});

// POST 요청: 약품명 또는 성분명으로 검색
router.post('/', async (req, res) => {
  try {
    const { medicine_name, ingredient_name } = req.body;

    const index = client.index('medicine');
    let searchResult;

    if (medicine_name) {
      searchResult = await index.search(medicine_name, {
        attributesToSearchOn: ['itemName'], // itemName 필드로 검색 제한
      });
    }
    // 성분명으로 검색
    else if (ingredient_name) {
      searchResult = await index.search(ingredient_name, {
        attributesToSearchOn: ["cautionaryIngr", "ingredient"], // 성분명 관련 필드로 검색 제한
      });
    }

    console.log('Search Result:', searchResult); // 디버깅을 위한 로그

    if (!searchResult || !searchResult.hits || searchResult.hits.length === 0) {
      return res.status(404).json({ message: '검색 결과가 없습니다.' });
    }

    // 모든 속성을 포함한 검색 결과 반환
    const modifiedHits = searchResult.hits.map(hit => ({
      companyName: hit.companyName,
      itemName: hit.itemName,
      efficacy: hit.efficacy,
      instruction: hit.instruction,
      caution: hit.caution,
      sotrageInstruction: hit.sotrageInstruction,
      ITEM_ENG_NAME: hit.ITEM_ENG_NAME,
      cautionaryIngr: hit.cautionaryIngr,
      ingredient: hit.ingredient,
    }));

    res.json({ results: modifiedHits });
  } catch (error) {
    console.error('약품 검색 오류:', error);
    res.status(500).json({ message: '약품 검색 중 오류가 발생했습니다.' });
  }
});

router.post('/autocomplete', async (req, res) => {
  const { query, searchType } = req.body;

  try {
    const index = client.index('medicine');
    let searchResult;

    if (searchType === 'name') {
      // 이름으로 검색 (itemName 필드)
      searchResult = await index.search(query, {
        limit: 10,
        attributesToRetrieve: ['itemName'], // itemName 필드만 반환
      });

      const suggestions = searchResult.hits.map(hit => hit.itemName);
      return res.json({ suggestions });
    } else if (searchType === 'ingredient') {
      // 성분으로 검색 (cautionaryIngr와 ingredient 필드)
      searchResult = await index.search(query, {
        limit: 10,
        attributesToRetrieve: ['CombinedIngredients'], // 관련 필드만 반환
      });

      // CombinedIngredients는 문자열 형태로 저장되어 있으므로, 배열로 변환
      const suggestions = searchResult.hits.flatMap(hit => {
        if (hit.CombinedIngredients) {
          try {
            // CombinedIngredients를 JSON 배열로 파싱
            return JSON.parse(hit.CombinedIngredients.replace(/'/g, '"'));
          } catch (error) {
            console.error('JSON 파싱 오류:', error);
            return []; // 오류 발생 시 빈 배열 반환
          }
        }
        return [];
      });

      return res.json({ suggestions: [...new Set(suggestions)] });
    } else {
      return res.status(400).json({ message: 'Invalid search type' });
    }
  } catch (error) {
    console.error('Autocomplete search error:', error);
    res.status(500).json({ message: 'Error fetching autocomplete suggestions.' });
  }
});

export default router;
