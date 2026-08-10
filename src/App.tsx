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

  const statusLabel = isLoading ? '문제를 분석하고 있습니다...' : selectedFile ? '이미지 업로드 완료' : '이미지를 업로드해 주세요';

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
      <header className="hero-card">
        <div>
          <p className="eyebrow">AI 수학 문제 풀이</p>
          <h1>사진 한 장으로 문제를 이해하고 풀이까지 받아보세요.</h1>
          <p className="hero-text">
            업로드한 수학 문제 이미지를 OCR과 AI가 함께 분석해, 단계별 풀이와 핵심 개념을 정리해드립니다.
          </p>
        </div>
        <div className="hero-badge">학생용 · 고등학교 수준</div>
      </header>

      <label className="upload-card">
        <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} />
        <div className="upload-content">
          <div className="upload-icon">📷</div>
          <div>
            <strong>{selectedFile ? selectedFile.name : '수학 문제 이미지 업로드'}</strong>
            <p>PNG, JPG, JPEG, WEBP 형식을 지원합니다.</p>
          </div>
        </div>
      </label>

      <div className="status-row">
        <span className={`status-pill ${isLoading ? 'loading' : ''}`}>{statusLabel}</span>
        {errorMessage && <div className="error">{errorMessage}</div>}
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panel-title-row">
            <h2>업로드 이미지</h2>
            <span>Preview</span>
          </div>
          {previewUrl ? <img src={previewUrl} alt="uploaded problem" className="preview-image" /> : <p className="empty-state">이미지를 업로드하면 미리보기가 표시됩니다.</p>}
        </section>

        <section className="panel">
          <div className="panel-title-row">
            <h2>문제 인식 결과</h2>
            <span>OCR</span>
          </div>
          <p className="summary-text">{summary || '인식된 문제가 없습니다.'}</p>
          {structuredProblem && (
            <div className="meta-block">
              <h3>조건</h3>
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

      <section className="panel wide-panel">
        <div className="panel-title-row">
          <h2>풀이 과정</h2>
          <span>Step-by-step</span>
        </div>
        {solution ? (
          <>
            <p className="summary">{solution.problem_summary}</p>
            <ol className="step-list">
              {solution.solution_steps.map((step) => (
                <li key={step.step} className="step-item">
                  <div className="step-number">{step.step}</div>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.explanation}</p>
                    {step.equation && <pre>{step.equation}</pre>}
                  </div>
                </li>
              ))}
            </ol>
            <div className="answer-box">
              <h3>최종 답</h3>
              <p>{solution.final_answer}</p>
            </div>
          </>
        ) : (
          <p className="empty-state">풀이 결과가 아직 없습니다.</p>
        )}
      </section>

      <section className="panel wide-panel">
        <div className="panel-title-row">
          <h2>핵심 개념</h2>
          <span>Concepts</span>
        </div>
        {solution?.key_concepts?.length ? (
          <div className="concept-grid">
            {solution.key_concepts.map((concept) => (
              <div key={concept.name} className="concept-card">
                <strong>{concept.name}</strong>
                <p>{concept.explanation}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">핵심 개념이 아직 없습니다.</p>
        )}
      </section>
    </div>
  );
}

export default App;
