import React from 'react';
import { render, screen } from '@testing-library/react';
import Admonition from './index';

// Mock the dependencies
jest.mock('@docusaurus/theme-common', () => ({
  processAdmonitionProps: jest.fn((props) => props),
}));

// Mock the AdmonitionTypes object
jest.mock('./Types', () => ({
  __esModule: true,
  default: {
    note: (props: any) => (
      <div
        data-testid="admonition-note"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Note: {props.children}
      </div>
    ),
    tip: (props: any) => (
      <div
        data-testid="admonition-tip"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Tip: {props.children}
      </div>
    ),
    info: (props: any) => (
      <div
        data-testid="admonition-info"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Info: {props.children}
      </div>
    ),
    warning: (props: any) => (
      <div
        data-testid="admonition-warning"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Warning: {props.children}
      </div>
    ),
    danger: (props: any) => (
      <div
        data-testid="admonition-danger"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Danger: {props.children}
      </div>
    ),
    // Legacy aliases
    secondary: (props: any) => (
      <div
        data-testid="admonition-secondary"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Secondary: {props.children}
      </div>
    ),
    important: (props: any) => (
      <div
        data-testid="admonition-important"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Important: {props.children}
      </div>
    ),
    success: (props: any) => (
      <div
        data-testid="admonition-success"
        data-title={props.title}
        className={props.className}
        {...(props['data-custom'] ? {'data-custom': props['data-custom']} : {})}
      >
        Success: {props.children}
      </div>
    ),
  },
}));

describe('Admonition', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('renders note admonition correctly', () => {
    render(<Admonition type="note">This is a note</Admonition>);
    
    expect(screen.getByTestId('admonition-note')).toBeInTheDocument();
    expect(screen.getByText('Note: This is a note')).toBeInTheDocument();
  });

  it('renders tip admonition correctly', () => {
    render(<Admonition type="tip">This is a tip</Admonition>);
    
    expect(screen.getByTestId('admonition-tip')).toBeInTheDocument();
    expect(screen.getByText('Tip: This is a tip')).toBeInTheDocument();
  });

  it('renders info admonition correctly', () => {
    render(<Admonition type="info">This is an info</Admonition>);
    
    expect(screen.getByTestId('admonition-info')).toBeInTheDocument();
    expect(screen.getByText('Info: This is an info')).toBeInTheDocument();
  });

  it('renders warning admonition correctly', () => {
    render(<Admonition type="warning">This is a warning</Admonition>);
    
    expect(screen.getByTestId('admonition-warning')).toBeInTheDocument();
    expect(screen.getByText('Warning: This is a warning')).toBeInTheDocument();
  });

  it('renders danger admonition correctly', () => {
    render(<Admonition type="danger">This is a danger</Admonition>);
    
    expect(screen.getByTestId('admonition-danger')).toBeInTheDocument();
    expect(screen.getByText('Danger: This is a danger')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(
      <Admonition type="info" title="Custom Title">
        This is an info with title
      </Admonition>
    );
    
    const element = screen.getByTestId('admonition-info');
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute('data-title', 'Custom Title');
    expect(screen.getByText('Info: This is an info with title')).toBeInTheDocument();
  });

  it('renders with class name', () => {
    render(
      <Admonition type="warning" className="custom-class">
        This is a warning with custom class
      </Admonition>
    );
    
    const element = screen.getByTestId('admonition-warning');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('custom-class');
  });

  it('uses fallback to info type when unknown type is provided', () => {
    // Spy on console.warn to check if it logs a warning
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(<Admonition type="unknown-type">This is unknown</Admonition>);
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'No admonition component found for admonition type "unknown-type". Using Info as fallback.'
    );
    expect(screen.getByTestId('admonition-info')).toBeInTheDocument();
    
    consoleWarnSpy.mockRestore();
  });

  it('handles legacy aliases correctly', () => {
    // Test secondary alias
    render(<Admonition type="secondary">Secondary content</Admonition>);
    expect(screen.getByTestId('admonition-secondary')).toBeInTheDocument();
    expect(screen.getByText('Secondary: Secondary content')).toBeInTheDocument();

    // Test important alias
    render(<Admonition type="important">Important content</Admonition>);
    expect(screen.getByTestId('admonition-important')).toBeInTheDocument();
    expect(screen.getByText('Important: Important content')).toBeInTheDocument();

    // Test success alias
    render(<Admonition type="success">Success content</Admonition>);
    expect(screen.getByTestId('admonition-success')).toBeInTheDocument();
    expect(screen.getByText('Success: Success content')).toBeInTheDocument();
  });

  it('passes all props to the admonition type component', () => {
    const customProps = {
      type: 'note',
      className: 'my-admonition',
      title: 'My Title',
      'data-custom': 'custom-value',
    };

    render(
      <Admonition {...customProps}>
        Content with custom props
      </Admonition>
    );

    const element = screen.getByTestId('admonition-note');
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute('data-title', 'My Title');
    expect(element).toHaveClass('my-admonition');
    expect(element).toHaveAttribute('data-custom', 'custom-value');
  });

  it('processes children through processAdmonitionProps', () => {
    const ProcessAdmonitionPropsMock = require('@docusaurus/theme-common').processAdmonitionProps as jest.MockedFunction<any>;
    ProcessAdmonitionPropsMock.mockReturnValue({
      type: 'info',
      children: <span>Processed content</span>,
    });
  
    render(<Admonition type="info">Original content</Admonition>);
    
    expect(ProcessAdmonitionPropsMock).toHaveBeenCalled();
    expect(screen.getByTestId('admonition-info')).toBeInTheDocument();
    expect(screen.getByText('Info:')).toBeInTheDocument();
  });
});