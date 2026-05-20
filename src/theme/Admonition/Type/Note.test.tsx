import React from 'react';
import {render, screen} from '@testing-library/react';
import AdmonitionTypeNote from './Note';

describe('AdmonitionTypeNote', () => {
  it('renders children correctly', () => {
    render(
      <AdmonitionTypeNote>
        <p>Test child content</p>
      </AdmonitionTypeNote>
    );

    expect(screen.getByText('Test child content')).toBeInTheDocument();
  });

  it('has the correct infima class name by default', () => {
    render(
      <AdmonitionTypeNote>
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    const alertElement = screen.getByRole('banner');
    expect(alertElement).toHaveClass('alert--secondary');
  });

  it('applies additional class names when provided', () => {
    render(
      <AdmonitionTypeNote className="custom-class">
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    const alertElement = screen.getByRole('banner');
    expect(alertElement).toHaveClass('alert--secondary');
    expect(alertElement).toHaveClass('custom-class');
  });

  it('renders with custom title when provided', () => {
    render(
      <AdmonitionTypeNote title="Custom Title">
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders with default translated title when no title provided', () => {
    render(
      <AdmonitionTypeNote>
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    // The default title should be 'note' as per the Translate component
    const titleElement = screen.getByText('note');
    expect(titleElement).toBeInTheDocument();
  });

  it('renders with custom icon when provided', () => {
    const customIcon = <span data-testid="custom-icon">Custom Icon</span>;

    render(
      <AdmonitionTypeNote icon={customIcon}>
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders with default icon when no icon provided', () => {
    render(
      <AdmonitionTypeNote>
        <p>Content</p>
      </AdmonitionTypeNote>
    );

    // Since the default icon is IconNote, we expect it to render
    // The icon should be present in the layout even though we can't directly test the imported component
    const iconContainer = screen.getByRole('banner');
    expect(iconContainer.firstElementChild?.firstElementChild).toBeInTheDocument();
  });
});