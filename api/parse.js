import dotenv from 'dotenv';

dotenv.config();

const upstageApiKey = process.env.UPSTAGE_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!upstageApiKey) {
    res.status(200).json({
      problem_text: text || '문제 내용을 인식하지 못했습니다.',
      question: '문제의 질문을 확인해 주세요.',
      conditions: [],
      choices: [],
      equations: [],
      has_graph: false,
      has_table: false,
      ocr_uncertain_parts: ['LLM 비활성 상태라 기본 구조로 반환합니다.'],
    });
    return;
  }

  try {
    const response = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${upstageApiKey}`,
      },
      body: JSON.stringify({
        model: 'solar-pro',
        messages: [
          {
            role: 'system',
            content: '당신은 수학 문제 인식 전문가입니다. OCR 결과를 바탕으로 JSON만 반환하세요.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error('LLM 요청 실패');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';

    try {
      res.status(200).json(JSON.parse(content));
    } catch {
      res.status(200).json({ raw: content });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : '문제 구조화 실패' });
  }
}
