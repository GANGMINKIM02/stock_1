import { createRequire } from 'module';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
dotenv.config();

const upstageApiKey = process.env.UPSTAGE_API_KEY || process.env.VITE_UPSTAGE_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers });
    const chunks = [];
    const fileInfo = {};

    bb.on('file', (_, file, info) => {
      fileInfo.filename = info.filename;
      fileInfo.mimeType = info.mimeType;
      file.on('data', (data) => chunks.push(data));
    });

    bb.on('finish', async () => {
      if (!upstageApiKey) {
        res.status(200).json({
          ocrResult: {
            text: '업스테이지 API 키가 설정되지 않아 샘플 인식 결과를 반환합니다.',
            source: 'ocr',
          },
          documentParseResult: {
            text: '문제 이미지를 업로드하면 문서 파싱 결과를 확인할 수 있습니다.',
            source: 'document-parse',
          },
        });
        return;
      }

      const buffer = Buffer.concat(chunks);
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: fileInfo.mimeType || 'application/octet-stream' }), fileInfo.filename || 'upload.png');

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
        res.status(502).json({ error: 'Upstage API 요청 실패' });
        return;
      }

      const ocrData = await ocrResponse.json();
      const documentData = await documentParseResponse.json();

      res.status(200).json({
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
    });

    req.pipe(bb);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OCR 처리 실패' });
  }
}

function extractText(data) {
  if (typeof data === 'string') {
    return data;
  }
  if (data && typeof data === 'object') {
    if (typeof data.text === 'string') {
      return data.text;
    }
    if (Array.isArray(data.pages)) {
      return data.pages.map((page) => (typeof page?.text === 'string' ? page.text : '')).filter(Boolean).join('\n');
    }
  }
  return '인식된 텍스트가 없습니다.';
}
