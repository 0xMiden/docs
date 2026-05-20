import React from 'react';
import {render, screen} from '@testing-library/react';
import AdmonitionTypeCaution from './Caution';

describe('AdmonitionTypeCaution', () => {
  it('renders with default props', () => {
    render(<AdmonitionTypeCaution />);
    
    // Check that the default title "caution" is present
    expect(screen.getByText(/caution/i)).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    const testMessage = 'This is a caution message';
    render(
      <AdmonitionTypeCaution>
        {testMessage}
      </AdmonitionTypeCaution>
    );
    
    expect(screen.getByText(testMessage)).toBeInTheDocument();
  });

  it('applies the correct infima class name', () => {
    render(<AdmonitionTypeCaution />);

    // Check that the alert--warning class is applied
    const alertElement = screen.getByRole('banner');
    expect(alertElement).toHaveClass('alert--warning');
  });

  it('renders with custom title when provided', () => {
    render(
      <AdmonitionTypeCaution title="Custom Title">
        Test content
      </AdmonitionTypeCaution>
    );
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('applies additional class names when provided', () => {
    render(
      <AdmonitionTypeCaution className="custom-class">
        Test content
      </AdmonitionTypeCaution>
    );

    const alertElement = screen.getByRole('banner');
    expect(alertElement).toHaveClass('custom-class');
    expect(alertElement).toHaveClass('alert--warning'); // Should still have default class
  });

  it('renders with icon', () => {
    render(<AdmonitionTypeCaution>Test content</AdmonitionTypeCaution>);

    // Since the icon is a warning icon, we check if the icon element exists
    // Based on the output, the icon has a data-testid attribute
    const iconElement = screen.getByTestId('admonition-icon');
    expect(iconElement).toBeInTheDocument();
  });
});