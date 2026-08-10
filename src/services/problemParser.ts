import { ProblemStructure } from '../types/problem';

export async function parseProblemToStructure(text: string): Promise<ProblemStructure> {
  const fallback: ProblemStructure = {
    problem_text: text || '문제 내용을 인식하지 못했습니다.',
    question: '문제의 질문을 확인해 주세요.',
    conditions: [],
    choices: [],
    equations: [],
    has_graph: false,
    has_table: false,
    ocr_uncertain_parts: ['문제 인식 결과가 불완전할 수 있습니다.'],
  };

  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return fallback;
  }

  const result = await response.json();
  return {
    ...fallback,
    ...result,
  } as ProblemStructure;
}
