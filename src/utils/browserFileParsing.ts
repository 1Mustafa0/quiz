export type BrowserExtractionStrategy = 'pdf' | 'text' | 'docx' | 'pptx' | 'xlsx' | 'unsupported';

const TEXT_EXTENSIONS = /\.(txt|md|json|csv|js|ts|tsx|jsx|py|java|cpp|c|html|css)$/i;
const OFFICE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const OFFICE_EXTENSIONS = /\.(docx|doc|pptx|ppt|xlsx|xls)$/i;

export const getBrowserExtractionStrategy = (file: Pick<File, 'name' | 'type'>): BrowserExtractionStrategy => {
  const lowerName = file.name.toLowerCase();

  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.test(lowerName)) return 'text';
  if (OFFICE_MIME_TYPES.has(file.type) || OFFICE_EXTENSIONS.test(lowerName)) {
    if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') || file.type === 'application/vnd.ms-powerpoint' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return 'pptx';
    }
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return 'xlsx';
    }
    return 'docx';
  }

  return 'unsupported';
};
