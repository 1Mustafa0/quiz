import React from 'react';
import { formatExtractedTextPreview } from '../utils/extractedText';

interface Props {
  text: string;
  className?: string;
}

type PreviewLine = {
  type: 'heading' | 'bullet' | 'text' | 'spacer';
  text: string;
};

const sectionPattern = /^(?:Slide|Page|Image|Sheet|Table|Row)\s+\d+(?:\s+\([^)]+\))?$|^(?:File|Document|Worksheet|Text|Code):/i;

const parsePreviewLines = (text: string): PreviewLine[] => {
  const formatted = formatExtractedTextPreview(text);
  if (!formatted) return [];

  return formatted.split('\n').map((line) => {
    const trimmed = line.trim();

    if (!trimmed) return { type: 'spacer', text: '' };
    if (sectionPattern.test(trimmed)) return { type: 'heading', text: trimmed };
    if (/^-\s+/.test(trimmed)) return { type: 'bullet', text: trimmed.replace(/^-\s+/, '') };

    return { type: 'text', text: trimmed };
  });
};

const ExtractedTextPreview: React.FC<Props> = ({ text, className = '' }) => {
  const lines = React.useMemo(() => parsePreviewLines(text), [text]);

  if (!lines.length) return null;

  return (
    <div
      dir="auto"
      className={`max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-800 shadow-inner dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 ${className}`}
    >
      <div className="space-y-2">
        {lines.map((line, index) => {
          if (line.type === 'spacer') {
            return <div key={index} className="h-2" />;
          }

          if (line.type === 'heading') {
            return (
              <div key={index} className="pt-2 first:pt-0">
                <span className="inline-flex rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  {line.text}
                </span>
              </div>
            );
          }

          if (line.type === 'bullet') {
            return (
              <div key={index} className="flex gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-slate-900">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                <p className="m-0 flex-1 whitespace-pre-wrap">{line.text}</p>
              </div>
            );
          }

          return (
            <p key={index} className="m-0 whitespace-pre-wrap rounded-lg px-1">
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default ExtractedTextPreview;
