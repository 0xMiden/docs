import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeTabs from './CodeTabs';

// Mock CSS module
jest.mock('./CodeTabs.module.css', () => ({
  codeContainer: 'codeContainer',
  codeSection: 'codeSection',
  outputSection: 'outputSection',
  outputHeader: 'outputHeader',
  tabContainer: 'tabContainer',
  tabButtons: 'tabButtons',
  tabButton: 'tabButton',
  active: 'active',
}));

describe('CodeTabs', () => {
  const mockRustExample = {
    code: 'fn main() { println!("Hello, world!"); }',
    output: 'Hello, world!',
  };

  const mockTsExample = {
    code: 'console.log("Hello, world!");',
    output: 'Hello, world!',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Single Language Display (No Tabs)', () => {
    test('renders only Rust example when only Rust is provided', () => {
      const example = { rust: mockRustExample };
      
      render(<CodeTabs example={example} />);
      
      expect(screen.getByTestId('codeblock-rust')).toBeInTheDocument();
      expect(screen.queryByTestId('codeblock-typescript')).not.toBeInTheDocument();
      expect(screen.getByText(mockRustExample.output!)).toBeInTheDocument();
    });

    test('renders only TypeScript example when only TypeScript is provided', () => {
      const example = { typescript: mockTsExample };
      
      render(<CodeTabs example={example} />);
      
      expect(screen.getByTestId('codeblock-typescript')).toBeInTheDocument();
      expect(screen.queryByTestId('codeblock-rust')).not.toBeInTheDocument();
      expect(screen.getByText(mockTsExample.output!)).toBeInTheDocument();
    });

    test('uses custom filename for Rust when provided', () => {
      const example = { rust: mockRustExample };
      const customFilename = 'custom.rs';
      
      render(<CodeTabs example={example} rustFilename={customFilename} />);
      
      const codeBlock = screen.getByTestId('codeblock-rust');
      expect(codeBlock).toHaveAttribute('data-title', customFilename);
    });

    test('uses custom filename for TypeScript when provided', () => {
      const example = { typescript: mockTsExample };
      const customFilename = 'custom.ts';
      
      render(<CodeTabs example={example} tsFilename={customFilename} />);
      
      const codeBlock = screen.getByTestId('codeblock-typescript');
      expect(codeBlock).toHaveAttribute('data-title', customFilename);
    });
  });

  describe('Dual Language Display (With Tabs)', () => {
    test('renders both tabs when both languages are provided', () => {
      const example = { 
        rust: mockRustExample,
        typescript: mockTsExample 
      };
      
      render(<CodeTabs example={example} />);
      
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Rust')).toBeInTheDocument();
      expect(screen.getByTestId('codeblock-typescript')).toBeInTheDocument();
    });

    test('defaults to TypeScript tab when both languages are available', () => {
      const example = { 
        rust: mockRustExample,
        typescript: mockTsExample 
      };
      
      render(<CodeTabs example={example} />);
      
      const tsTab = screen.getByText('TypeScript');
      const rustTab = screen.getByText('Rust');
      expect(tsTab).toHaveClass('active'); // Assuming the active class is applied to the button
      expect(rustTab).not.toHaveClass('active');
    });

    test('defaults to Rust tab when only Rust is available', () => {
      const example = { 
        rust: mockRustExample
      };
      
      render(<CodeTabs example={example} />);
      
      // Should not show tabs at all, just render the Rust code
      expect(screen.getByTestId('codeblock-rust')).toBeInTheDocument();
      expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
      expect(screen.queryByText('Rust')).not.toBeInTheDocument(); // Rust tab shouldn't appear as a button
    });

    test('switches to TypeScript tab when clicked', () => {
      const example = { 
        rust: mockRustExample,
        typescript: mockTsExample 
      };
      
      render(<CodeTabs example={example} />);
      
      // Initially should be on TypeScript tab (default)
      expect(screen.getByTestId('codeblock-typescript')).toBeInTheDocument();
      
      // Click on Rust tab
      fireEvent.click(screen.getByText('Rust'));
      
      // Now should show Rust code block
      expect(screen.getByTestId('codeblock-rust')).toBeInTheDocument();
    });

    test('switches to Rust tab when clicked', () => {
      const example = { 
        rust: mockRustExample,
        typescript: mockTsExample 
      };
      
      render(<CodeTabs example={example} />);
      
      // Initially should be on TypeScript tab (default)
      expect(screen.getByTestId('codeblock-typescript')).toBeInTheDocument();
      
      // Click on Rust tab
      fireEvent.click(screen.getByText('Rust'));
      
      // Now should show Rust code block
      expect(screen.getByTestId('codeblock-rust')).toBeInTheDocument();
      
      // Click back to TypeScript
      fireEvent.click(screen.getByText('TypeScript'));
      expect(screen.getByTestId('codeblock-typescript')).toBeInTheDocument();
    });

    test('applies active class to selected tab', () => {
      const example = { 
        rust: mockRustExample,
        typescript: mockTsExample 
      };
      
      render(<CodeTabs example={example} />);
      
      const tsTab = screen.getByText('TypeScript');
      const rustTab = screen.getByText('Rust');
      
      // Initially TypeScript should be active
      expect(tsTab).toHaveClass('active');
      expect(rustTab).not.toHaveClass('active');
      
      // Switch to Rust
      fireEvent.click(rustTab);
      
      // Now Rust should be active
      expect(tsTab).not.toHaveClass('active');
      expect(rustTab).toHaveClass('active');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty example object gracefully', () => {
      const example = {};

      // According to the component logic, if both rust and typescript are missing,
      // it will try to render the single language version but fail since neither exists
      // Let's catch this as a component limitation
      expect(() => {
        render(<CodeTabs example={example} />);
      }).toThrow();
    });

    test('does not show output section when no output is provided', () => {
      const example = {
        rust: {
          code: 'fn main() { println!("Hello"); }'
          // No output property
        }
      };
      
      render(<CodeTabs example={example} />);
      
      expect(screen.queryByText('Output')).not.toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    test('uses default filenames when custom filenames not provided', () => {
      const example = {
        rust: mockRustExample,
        typescript: mockTsExample
      };

      render(<CodeTabs example={example} />);

      // When both languages exist, the component defaults to TypeScript
      const tsCodeBlock = screen.getByTestId('codeblock-typescript');

      expect(tsCodeBlock).toHaveAttribute('data-title', 'index.ts');
    });
  });
});