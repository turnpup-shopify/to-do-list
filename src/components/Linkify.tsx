import { Fragment, type ReactNode } from "react";

// Matches http/https URLs. Kept intentionally simple; the surrounding text is
// rendered by React (never dangerouslySetInnerHTML), so it stays XSS-safe.
// The capturing group means the URLs are preserved in the split() output.
const URL_SPLIT_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g;
const URL_TEST_RE = /^https?:\/\//;

/** Render plain text, turning bare URLs into clickable links. */
export function Linkify({ text }: { text: string }): ReactNode {
  const parts = text.split(URL_SPLIT_RE);
  return parts.map((part, i) => {
    if (URL_TEST_RE.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
