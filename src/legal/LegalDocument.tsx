import React from 'react';

export type LegalSegment = { text?: string; code?: string; email?: string };
export type LegalSection = { heading: string; body: LegalSegment[] };

/** Renders legal sections from src/legal/legalContent.json (shared with the static /terms/ and /privacy/ pages). */
export const LegalSections: React.FC<{ sections: LegalSection[] }> = ({ sections }) => (
  <>
    {sections.map(section => (
      <React.Fragment key={section.heading}>
        <h3 className="text-base font-bold text-white pt-2">{section.heading}</h3>
        <p>
          {section.body.map((segment, index) => {
            if (segment.code) {
              return <code key={index} className="bg-slate-950 px-1 py-0.5 rounded text-indigo-300">{segment.code}</code>;
            }
            if (segment.email) {
              return <a key={index} href={`mailto:${segment.email}`} className="text-indigo-400 underline">{segment.email}</a>;
            }
            return <React.Fragment key={index}>{segment.text}</React.Fragment>;
          })}
        </p>
      </React.Fragment>
    ))}
  </>
);
