// __mocks__/@theme/Admonition/Layout.js
// Mock for the Admonition Layout component

import React from 'react';

const AdmonitionLayout = ({ title, icon, children, className }) => {
  return (
    <div
      className={className}
      role="banner"
      data-testid="admonition-layout"
    >
      {icon && <span data-testid="admonition-icon">{icon}</span>}
      {title && <div data-testid="admonition-title">{title}</div>}
      {children && <div data-testid="admonition-content">{children}</div>}
    </div>
  );
};

module.exports = AdmonitionLayout;