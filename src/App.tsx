import { ChangeEvent, useMemo, useState } from 'react';
import { isImageCorrupted, validateImageFile } from './utils/fileValidation';
import { runOcrAndParse } from './services/ocrService';
import { parseProblemToStructure } from './services/problemParser';
import { solveProblem } from './services/mathSolver';
import { ProblemStructure, SolutionResult } from './types/problem';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [problemText, setProblemText] = useState('');
  const [structuredProblem, setStructuredProblem] = useState<ProblemStructure | null>(null);
  const [solution, setSolution] = useState<SolutionResult | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? '업로드 오류');
      return;
    }

    const corrupted = await isImageCorrupted(file);
    if (corrupted) {
      setErrorMessage('이미지 파일이 손상되었거나 읽을 수 없습니다.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage('');
    setIsLoading(true);

    try {
      const { ocrResult, documentParseResult } = await runOcrAndParse(file);
      const combinedText = [ocrResult.text, documentParseResult.text].filter(Boolean).join('\n');
      setProblemText(combinedText);

      const parsed = await parseProblemToStructure(combinedText);
      setStructuredProblem(parsed);

      const solved = await solveProblem(parsed);
      setSolution(solved);
    } catch {
      setErrorMessage('문제를 분석하는 과정에서 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const summary = useMemo(() => structuredProblem?.problem_text ?? '', [structuredProblem]);

  return (
    <div className="app-shell">
      <header>
        <h1>수학 문제 풀이 AI</h1>
        <p>이미지 업로드로 문제를 인식하고, 단계별 풀이와 핵심 개념까지 제공합니다.</p>
      </header>

      <label className="upload-card">
        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} />
        <span>{selectedFile ? selectedFile.name : '수학 문제 이미지 업로드'}</span>
      </label>

      {isLoading && <div className="status">문제를 분석하고 있습니다...</div>}
      {errorMessage && <div className="error">{errorMessage}</div>}

      <div className="grid">
        <section className="panel">
          <h2>업로드된 이미지</h2>
          {previewUrl ? <img src={previewUrl} alt="uploaded problem" className="preview-image" /> : <p>이미지를 업로드하면 미리보기가 표시됩니다.</p>}
        </section>

        <section className="panel">
          <h2>문제 인식 결과</h2>
          <p>{summary || '인식된 문제가 없습니다.'}</p>
          {structuredProblem && (
            <div className="meta-block">
              <h3>구조화된 정보</h3>
              <ul>
                {structuredProblem.conditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
              {structuredProblem.choices.length > 0 && (
                <div>
                  <h3>선택지</h3>
                  <ul>
                    {structuredProblem.choices.map((choice) => (
                      <li key={choice}>{choice}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>풀이</h2>
        {solution ? (
          <>
            <p className="summary">{solution.problem_summary}</p>
            <ol>
              {solution.solution_steps.map((step) => (
                <li key={step.step}>
                  <strong>{step.title}</strong>
                  <p>{step.explanation}</p>
                  {step.equation && <pre>{step.equation}</pre>}
                </li>
              ))}
            </ol>
            <div className="answer-box">
              <h3>최종 답</h3>
              <p>{solution.final_answer}</p>
            </div>
          </>
        ) : (
          <p>풀이 결과가 아직 없습니다.</p>
        )}
      </section>

      <section className="panel">
        <h2>핵심 개념</h2>
        {solution?.key_concepts?.length ? (
          <ul>
            {solution.key_concepts.map((concept) => (
              <li key={concept.name}>
                <strong>{concept.name}</strong>
                <p>{concept.explanation}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>핵심 개념이 아직 없습니다.</p>
        )}
      </section>
    </div>
  );
}

export default App;
