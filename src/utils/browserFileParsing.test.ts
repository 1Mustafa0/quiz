import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowserExtractionStrategy } from './browserFileParsing';

test('detects text files and office documents for browser fallback', () => {
  assert.equal(
    getBrowserExtractionStrategy({ name: 'notes.txt', type: 'text/plain' } as File),
    'text'
  );
  assert.equal(
    getBrowserExtractionStrategy({ name: 'chapter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as File),
    'docx'
  );
  assert.equal(
    getBrowserExtractionStrategy({ name: 'slides.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' } as File),
    'pptx'
  );
  assert.equal(
    getBrowserExtractionStrategy({ name: 'data.pdf', type: 'application/pdf' } as File),
    'pdf'
  );
  assert.equal(
    getBrowserExtractionStrategy({ name: 'archive.bin', type: 'application/octet-stream' } as File),
    'unsupported'
  );
});
