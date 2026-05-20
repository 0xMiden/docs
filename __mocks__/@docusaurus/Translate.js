// Mock for @docusaurus/Translate
// This is used in tests to replace the Docusaurus Translate module

import React from 'react';

const Translate = ({ children }) => {
  return <>{children}</>;
};

export default Translate;

// Also export translate function for cases where it's destructured
export const translate = (id, { message }) => message || id;