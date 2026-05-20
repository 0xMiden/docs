module.exports = {
  __esModule: true,
  default: ({ item }) => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'original-doc-card' },
      item?.label || 'Original Doc Card'
    );
  },
};