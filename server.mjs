import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors({ origin: true }));
app.use(express.json());

const upstageApiKey = process.env.UPSTAGE_API_KEY || process.env.VITE_UPSTAGE_API_KEY;
const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/ocr', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 필요합니다.' });
  }

  if (!upstageApiKey) {
    return res.json({
      ocrResult: {
        text: '업스테이지 API 키가 설정되지 않아 샘플 인식 결과를 반환합니다.',
        source: 'ocr',
      },
      documentParseResult: {
        text: '문제 이미지를 업로드하면 문서 파싱 결과를 확인할 수 있습니다.',
        source: 'document-parse',
      },
    });
  }

  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname,
    );

    const [ocrResponse, documentParseResponse] = await Promise.all([
      fetch('https://api.upstage.ai/v1/ocr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstageApiKey}` },
        body: formData,
      }),
      fetch('https://api.upstage.ai/v1/document-parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstageApiKey}` },
        body: formData,
      }),
    ]);

    if (!ocrResponse.ok || !documentParseResponse.ok) {
      throw new Error('Upstage API 요청이 실패했습니다.');
    }

    const ocrData = await ocrResponse.json();
    const documentData = await documentParseResponse.json();

    res.json({
      ocrResult: {
        text: extractText(ocrData),
        rawText: JSON.stringify(ocrData),
        confidence: 0.86,
        source: 'ocr',
      },
      documentParseResult: {
        text: extractText(documentData),
        rawText: JSON.stringify(documentData),
        confidence: 0.84,
        source: 'document-parse',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR 처리 실패' });
  }
});

app.post('/api/parse', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!llmApiKey) {
    return res.json({
      problem_text: text || '문제 내용을 인식하지 못했습니다.',
      question: '문제의 질문을 확인해 주세요.',
      conditions: [],
      choices: [],
      equations: [],
      has_graph: false,
      has_table: false,
      ocr_uncertain_parts: ['LLM 비활성 상태라 기본 구조로 반환합니다.'],
    });
  }

  try {
    const result = await callLlmJson(problemParserPrompt, text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : '문제 구조화 실패' });
  }
});

app.post('/api/solve', async (req, res) => {
  const problem = req.body?.problem;

  if (!llmApiKey) {
    return res.json({
      problem_summary: '문제의 핵심을 요약합니다.',
      solution_steps: [
        {
          step: 1,
          title: '조건 정리',
          explanation: 'LLM API가 비활성 상태라 기본 샘플 풀이를 반환합니다.',
        },
      ],
      final_answer: '답을 확인하려면 LLM API를 연결해 주세요.',
      key_concepts: [],
    });
  }

  try {
    const solution = await callLlmJson(mathSolverPrompt, JSON.stringify(problem));
    const verified = await callLlmJson(verifierPrompt, JSON.stringify({ problem, solution }));
    const concepts = await callLlmJson(conceptPrompt, JSON.stringify({ problem, solution: verified ?? solution }));

    res.json({
      problem_summary: solution?.problem_summary ?? '문제의 핵심을 요약합니다.',
      solution_steps: solution?.solution_steps ?? [],
      final_answer: solution?.final_answer ?? '답을 구하지 못했습니다.',
      key_concepts: concepts?.key_concepts ?? [],
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : '풀이 생성 실패' });
  }
});

app.listen(3001, () => {
  console.log('Math solver server listening on http://localhost:3001');
});

function extractText(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object') {
    const record = data;
    if (typeof record.text === 'string') {
      return record.text;
    }

    if (Array.isArray(record.pages)) {
      return record.pages
        .map((page) => {
          if (page && typeof page === 'object' && typeof page.text === 'string') {
            return page.text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
  }

  return '인식된 텍스트가 없습니다.';
}

async function callLlmJson(prompt, content) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error('LLM API 요청이 실패했습니다.');
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const problemParserPrompt = `당신은 수학 문제 인식 전문가입니다. OCR/Document Parse 결과를 바탕으로 수학 문제를 구조화된 JSON으로 정리하세요.
- 일반 텍스트, 수식, 조건, 보기, 문제 번호를 분리하세요.
- 수식이 있는 경우 equations 배열에 정리하세요.
- 객관식이 아니면 choices는 빈 배열로 둡니다.
- 불확실한 인식 부분은 ocr_uncertain_parts 배열에 담으세요.
- 결과는 반드시 JSON 형식으로만 반환하세요.`;

const mathSolverPrompt = `당신은 고등학생이 이해할 수 있는 수학 풀이 도우미입니다. 다음 구조화된 문제를 바탕으로 단계별 풀이를 작성하세요.
규칙:
1. 주어진 조건을 먼저 정리하세요.
2. 어떤 공식을 사용하는지 설명하세요.
3. 계산 과정에서 식이 생략되지 않도록 하세요.
4. 중요한 변형에는 이유를 설명하세요.
5. 고등학교 교육과정 수준으로 설명하세요.
6. 객관식 문제라면 정답 번호와 값을 모두 표시하세요.
7. 결과는 JSON 형식으로만 반환하세요.`;

const verifierPrompt = `다음 풀이가 문제 조건과 일치하는지 검증하세요.
- 문제 조건을 모두 사용했는가?
- 계산 오류가 없는가?
- 최종 답이 풀이 과정과 일치하는가?
- 객관식이라면 선택지와 답이 일치하는가?
결과는 JSON 형식으로만 반환하세요.`;

const conceptPrompt = `다음 풀이 과정에서 실제로 사용된 핵심 수학 개념을 최대 3개만 추출하세요. 결과는 JSON 형식으로만 반환하세요.`;
