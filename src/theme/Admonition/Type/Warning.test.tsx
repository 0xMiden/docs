import React from 'react';
import {render, screen} from '@testing-library/react';
import AdmonitionTypeWarning from './Warning';

// Mock the Translate component
jest.mock('@docusaurus/Translate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Translate: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// Mock the AdmonitionLayout component
jest.mock('@theme/Admonition/Layout', () => ({
  __esModule: true,
  default: ({
    icon,
    title,
    children,
    className,
    ...props
  }: {
    icon?: React.ReactNode;
    title?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    [key: string]: any;
  }) => (
    <div className={className} {...props}>
      <div className="icon">{icon}</div>
      <div className="title">{title}</div>
      <div className="content">{children}</div>
    </div>
  ),
}));

// Mock the IconWarning component
jest.mock('@theme/Admonition/Icon/Warning', () => ({
  __esModule: true,
  default: () => <span>WarningIcon</span>,
}));

describe('AdmonitionTypeWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(
      <AdmonitionTypeWarning data-testid="admonition-layout" />
    );

    // Check that the warning icon is rendered
    expect(screen.getByText('WarningIcon')).toBeInTheDocument();

    // Check that the default title is rendered
    expect(screen.getByText('warning')).toBeInTheDocument();

    // Check that the correct class names are applied
    const element = screen.getByTestId('admonition-layout');
    expect(element).toHaveClass('alert');
    expect(element).toHaveClass('alert--warning');
  });

  it('renders with custom children', () => {
    render(
      <AdmonitionTypeWarning data-testid="admonition-layout">
        <p>This is a warning message</p>
      </AdmonitionTypeWarning>
    );

    expect(screen.getByText('This is a warning message')).toBeInTheDocument();
  });

  it('applies custom className in addition to default classes', () => {
    render(
      <AdmonitionTypeWarning className="custom-class" data-testid="admonition-layout">
        Content
      </AdmonitionTypeWarning>
    );

    const element = screen.getByTestId('admonition-layout');
    expect(element).toHaveClass('alert');
    expect(element).toHaveClass('alert--warning');
    expect(element).toHaveClass('custom-class');
  });

  it('overrides default title when custom title is provided', () => {
    render(
      <AdmonitionTypeWarning title="Custom Title" data-testid="admonition-layout">
        Content
      </AdmonitionTypeWarning>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.queryByText('warning')).not.toBeInTheDocument();
  });

  it('retains default icon even with custom title', () => {
    render(
      <AdmonitionTypeWarning title="Custom Title" data-testid="admonition-layout">
        Content
      </AdmonitionTypeWarning>
    );

    expect(screen.getByText('WarningIcon')).toBeInTheDocument();
  });

  it('renders without children when none are provided', () => {
    render(<AdmonitionTypeWarning data-testid="admonition-layout" />);

    // Find the content div by class and ensure it's empty
    const contentDiv = document.querySelector('.content');

    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv?.innerHTML).toBe('');
  });

  it('spreads additional props to the layout component', () => {
    render(
      <AdmonitionTypeWarning
        data-testid="admonition-layout"
        role="alert"
      >
        Content
      </AdmonitionTypeWarning>
    );

    const element = screen.getByTestId('admonition-layout');
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute('role', 'alert');
  });

  it('has the correct translation ID for warnings', () => {
    // Since we're mocking Translate, we can't directly test the ID
    // But we can ensure the correct default text is present
    render(<AdmonitionTypeWarning />);
    expect(screen.getByText('warning')).toBeInTheDocument();
  });
});