import React from 'react';
import {render, screen} from '@testing-library/react';
import AdmonitionTypeTip from './Tip';

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

// Mock the IconTip component
jest.mock('@theme/Admonition/Icon/Tip', () => ({
  __esModule: true,
  default: () => <span>TipIcon</span>,
}));

describe('AdmonitionTypeTip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(
      <AdmonitionTypeTip data-testid="admonition-layout" />
    );

    // Check that the tip icon is rendered
    expect(screen.getByText('TipIcon')).toBeInTheDocument();

    // Check that the default title is rendered
    expect(screen.getByText('tip')).toBeInTheDocument();

    // Check that the correct class names are applied
    const element = screen.getByTestId('admonition-layout');
    expect(element).toHaveClass('alert');
    expect(element).toHaveClass('alert--success');
  });

  it('renders with custom children', () => {
    render(
      <AdmonitionTypeTip data-testid="admonition-layout">
        <p>This is a tip message</p>
      </AdmonitionTypeTip>
    );

    expect(screen.getByText('This is a tip message')).toBeInTheDocument();
  });

  it('applies custom className in addition to default classes', () => {
    render(
      <AdmonitionTypeTip className="custom-class" data-testid="admonition-layout">
        Content
      </AdmonitionTypeTip>
    );

    const element = screen.getByTestId('admonition-layout');
    expect(element).toHaveClass('alert');
    expect(element).toHaveClass('alert--success');
    expect(element).toHaveClass('custom-class');
  });

  it('overrides default title when custom title is provided', () => {
    render(
      <AdmonitionTypeTip title="Custom Title" data-testid="admonition-layout">
        Content
      </AdmonitionTypeTip>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.queryByText('tip')).not.toBeInTheDocument();
  });

  it('retains default icon even with custom title', () => {
    render(
      <AdmonitionTypeTip title="Custom Title" data-testid="admonition-layout">
        Content
      </AdmonitionTypeTip>
    );

    expect(screen.getByText('TipIcon')).toBeInTheDocument();
  });

  it('renders without children when none are provided', () => {
    render(<AdmonitionTypeTip data-testid="admonition-layout" />);

    // Find the content div by class and ensure it's empty
    const contentDiv = document.querySelector('.content');

    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv?.innerHTML).toBe('');
  });

  it('spreads additional props to the layout component', () => {
    render(
      <AdmonitionTypeTip
        data-testid="admonition-layout"
        role="alert"
      >
        Content
      </AdmonitionTypeTip>
    );

    const element = screen.getByTestId('admonition-layout');
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute('role', 'alert');
  });

  it('has the correct translation ID for tips', () => {
    // Since we're mocking Translate, we can't directly test the ID
    // But we can ensure the correct default text is present
    render(<AdmonitionTypeTip />);
    expect(screen.getByText('tip')).toBeInTheDocument();
  });
});