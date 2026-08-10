import { ProblemStructure, SolutionResult } from '../types/problem';

export async function solveProblem(problem: ProblemStructure): Promise<SolutionResult> {
  const response = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem }),
  });

  if (!response.ok) {
    throw new Error('풀이 생성 서버 오류');
  }

  return response.json();
}
