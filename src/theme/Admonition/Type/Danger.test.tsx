import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the Docusaurus theme components
jest.mock('@theme/Admonition/Layout', () => ({
  __esModule: true,
  default: ({ children, className, title, icon }: any) => (
    <div
      className={className || ''}
      data-testid="admonition-layout"
      role="banner"
    >
      {icon && <span data-testid="admonition-icon" aria-label="danger">{icon}</span>}
      {title && <div data-testid="admonition-title">{title}</div>}
      {children}
    </div>
  )
}));

jest.mock('@theme/Admonition/Icon/Danger', () => ({
  __esModule: true,
  default: () => <svg data-testid="danger-icon">Danger Icon</svg>
}));

jest.mock('@docusaurus/Translate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span data-testid="translate">{children}</span>,
  Translate: ({ children }: { children: React.ReactNode }) => <span data-testid="translate">{children}</span>
}));

// Now import the component after mocking dependencies
import AdmonitionTypeDanger from './Danger';

describe('AdmonitionTypeDanger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', async () => {
    render(<AdmonitionTypeDanger />);

    await waitFor(() => {
      // Check that the alert--danger class is present
      const admonitionElement = screen.getByTestId('admonition-layout');
      expect(admonitionElement).toHaveClass('alert alert--danger');
    });

    // Check that the danger icon is rendered
    const iconElement = screen.getByTestId('danger-icon');
    expect(iconElement).toBeInTheDocument();

    // Check that the default title is rendered
    const translateElement = screen.getByTestId('translate');
    expect(translateElement).toBeInTheDocument();
    expect(translateElement).toHaveTextContent('danger');
  });

  it('renders with custom title', () => {
    const customTitle = 'Custom Title';
    render(
      <AdmonitionTypeDanger title={customTitle}>
        <p>Content</p>
      </AdmonitionTypeDanger>
    );

    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });

  it('renders with children content', () => {
    const childrenContent = 'This is the admonition content';
    render(<AdmonitionTypeDanger>{childrenContent}</AdmonitionTypeDanger>);

    expect(screen.getByText(childrenContent)).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    const customClassName = 'custom-class-name';
    render(
      <AdmonitionTypeDanger className={customClassName}>
        <p>Content</p>
      </AdmonitionTypeDanger>
    );

    await waitFor(() => {
      const admonitionElement = screen.getByTestId('admonition-layout');
      expect(admonitionElement).toHaveClass('alert alert--danger');
      expect(admonitionElement).toHaveClass(customClassName);
    });
  });

  it('merges defaultProps with provided props', async () => {
    const additionalProps = {
      'data-testid': 'danger-admonition',
    };
    render(
      <AdmonitionTypeDanger {...additionalProps}>
        <p>Content</p>
      </AdmonitionTypeDanger>
    );

    await waitFor(() => {
      const admonitionElement = screen.getByTestId('admonition-layout');
      expect(admonitionElement).toBeInTheDocument();
      expect(admonitionElement).toHaveClass('alert alert--danger');
    });
  });

  it('renders without children', async () => {
    render(<AdmonitionTypeDanger />);

    // Should still render the basic structure without errors
    await waitFor(() => {
      const admonitionElement = screen.getByTestId('admonition-layout');
      expect(admonitionElement).toBeInTheDocument();
      expect(admonitionElement).toHaveClass('alert alert--danger');
    });
  });
});