import React from 'react';
import { render, screen } from '@testing-library/react';
import AdmonitionTypeInfo from './Info';

// Mock the dependencies that are used in the component
jest.mock('@docusaurus/Translate', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Translate: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('clsx', () => (...classNames: any[]) => classNames.filter(Boolean).join(' '));

// Mock the dependent components
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
    <div className={className} {...props} data-testid="admonition-layout">
      <div className="icon">{icon}</div>
      <div className="title">{title}</div>
      <div className="content">{children}</div>
    </div>
  ),
}));

jest.mock('@theme/Admonition/Icon/Info', () => ({
  __esModule: true,
  default: () => <span>InfoIcon</span>,
}));

describe('AdmonitionTypeInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<AdmonitionTypeInfo>Info content</AdmonitionTypeInfo>);

    // Check that the layout is rendered with correct class
    const layoutElement = screen.getByTestId('admonition-layout');
    expect(layoutElement).toBeInTheDocument();
    expect(layoutElement).toHaveClass('alert');
    expect(layoutElement).toHaveClass('alert--info');

    // Check that default icon is rendered
    expect(screen.getByText('InfoIcon')).toBeInTheDocument();

    // Check that default title is rendered
    expect(screen.getByText('info')).toBeInTheDocument();

    // Check that children are rendered
    expect(screen.getByText('Info content')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(
      <AdmonitionTypeInfo title="Custom Info Title">
        Info content
      </AdmonitionTypeInfo>
    );

    // Custom title should override default
    expect(screen.getByText('Custom Info Title')).toBeInTheDocument();
    expect(screen.queryByText('info')).not.toBeInTheDocument();
  });

  it('renders with custom className', () => {
    render(
      <AdmonitionTypeInfo className="custom-info-class">
        Info content
      </AdmonitionTypeInfo>
    );

    const layoutElement = screen.getByTestId('admonition-layout');
    expect(layoutElement).toHaveClass('alert alert--info custom-info-class');
  });

  it('renders with both default and custom classes combined', () => {
    render(
      <AdmonitionTypeInfo className="custom-additional-class">
        Info content
      </AdmonitionTypeInfo>
    );

    const layoutElement = screen.getByTestId('admonition-layout');
    // Check that all classes are present
    expect(layoutElement).toHaveClass('alert');
    expect(layoutElement).toHaveClass('alert--info');
    expect(layoutElement).toHaveClass('custom-additional-class');
  });

  it('renders multiple children correctly', () => {
    render(
      <AdmonitionTypeInfo>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </AdmonitionTypeInfo>
    );

    expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
    expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
  });

  it('renders with custom icon when provided', () => {
    const CustomIcon = () => <span data-testid="custom-icon">Custom</span>;

    render(
      <AdmonitionTypeInfo icon={<CustomIcon />}>
        Info content
      </AdmonitionTypeInfo>
    );

    // Custom icon should override default
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.queryByText('InfoIcon')).not.toBeInTheDocument();
  });

  it('preserves default icon when no custom icon is provided', () => {
    render(<AdmonitionTypeInfo>Info content</AdmonitionTypeInfo>);

    // Default icon should be present
    expect(screen.getByText('InfoIcon')).toBeInTheDocument();
  });

  it('renders with complex title elements', () => {
    render(
      <AdmonitionTypeInfo title={<strong>Strong Info Title</strong>}>
        Info content
      </AdmonitionTypeInfo>
    );

    expect(screen.getByText('Strong Info Title')).toBeInTheDocument();
    expect(screen.getByRole('strong')).toBeInTheDocument();
  });

  it('renders without title if null is passed', () => {
    render(
      <AdmonitionTypeInfo title={null as any}>
        Info content
      </AdmonitionTypeInfo>
    );

    // Should not render the default "info" title
    expect(screen.queryByText('info')).not.toBeInTheDocument();
  });

  it('merges default and custom props correctly', () => {
    render(
      <AdmonitionTypeInfo title="Custom Title" className="extra-class">
        Info content
      </AdmonitionTypeInfo>
    );

    const layoutElement = screen.getByTestId('admonition-layout');
    expect(layoutElement).toHaveClass('alert');
    expect(layoutElement).toHaveClass('alert--info');
    expect(layoutElement).toHaveClass('extra-class');
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders empty content when no children provided', () => {
    render(<AdmonitionTypeInfo />);

    const layoutElement = screen.getByTestId('admonition-layout');
    expect(layoutElement).toBeInTheDocument();
    // The layout is rendered but contains no child text content
  });

  it('applies correct infima class for info type', () => {
    render(<AdmonitionTypeInfo>Info content</AdmonitionTypeInfo>);

    const layoutElement = screen.getByTestId('admonition-layout');
    expect(layoutElement).toHaveClass('alert alert--info');
    expect(layoutElement).not.toHaveClass('alert--note');
    expect(layoutElement).not.toHaveClass('alert--tip');
    expect(layoutElement).not.toHaveClass('alert--warning');
    expect(layoutElement).not.toHaveClass('alert--danger');
  });
});