import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocCardWrapper from './index';

// Mock the styles module
jest.mock('./styles.module.css', () => ({
  customCard: 'customCard-mock',
}));

describe('DocCardWrapper', () => {
  const defaultProps = {
    item: {
      label: 'Test Card',
      href: '/test',
      description: 'Test description',
    },
  };

  it('renders the wrapper div with custom class', () => {
    render(<DocCardWrapper {...defaultProps} />);

    // Check if the wrapper div with custom class exists
    const wrapperDiv = screen.getByTestId('original-doc-card').parentElement;
    expect(wrapperDiv).toHaveClass('customCard-mock');
  });

  it('renders the original DocCard component inside the wrapper', () => {
    render(<DocCardWrapper {...defaultProps} />);

    // Check if the original DocCard renders correctly
    expect(screen.getByTestId('original-doc-card')).toBeInTheDocument();
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('passes props to the original DocCard component', () => {
    const testItem = {
      label: 'Documentation Link',
      href: '/docs/getting-started',
      description: 'Learn how to get started',
    };

    render(<DocCardWrapper item={testItem} />);

    // The mock component should render the label
    expect(screen.getByText('Documentation Link')).toBeInTheDocument();
  });

  it('handles empty item prop gracefully', () => {
    render(<DocCardWrapper item={{}} />);

    // Original card should render with default text when no label is provided
    expect(screen.getByText('Original Doc Card')).toBeInTheDocument();
  });

  it('maintains the component hierarchy', () => {
    render(<DocCardWrapper {...defaultProps} />);

    const originalCard = screen.getByTestId('original-doc-card');
    const wrapperDiv = originalCard.parentElement;

    // Verify that the original card is nested inside the wrapper div
    expect(wrapperDiv).toContainElement(originalCard);
    expect(wrapperDiv).toHaveClass('customCard-mock');
  });
});