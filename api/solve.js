import dotenv from 'dotenv';

dotenv.config();

const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const problem = req.body?.problem;

  if (!llmApiKey) {
    res.status(200).json({
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
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 고등학생용 수학 풀이 도우미입니다. JSON만 반환하세요.',
          },
          { role: 'user', content: JSON.stringify(problem) },
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
    res.status(500).json({ error: error instanceof Error ? error.message : '풀이 생성 실패' });
  }
}
