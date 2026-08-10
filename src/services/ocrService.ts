import { OcrResult } from '../types/problem';

export interface OcrServiceResponse {
  ocrResult: OcrResult;
  documentParseResult: OcrResult;
}

export async function runOcrAndParse(file: File): Promise<OcrServiceResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ocr', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('OCR 처리 서버 오류');
  }

  return response.json();
}
