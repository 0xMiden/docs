import React from 'react';

// Mock for @theme/CodeBlock
export default function CodeBlock({ children, language, title }) {
  return (
    <div data-testid={`codeblock-${language}`} data-title={title}>
      {children}
    </div>
  );
}