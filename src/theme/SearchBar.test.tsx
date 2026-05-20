import React from 'react';
import {render, screen} from '@testing-library/react';
import SearchBarWrapper from './SearchBar';

// Mock the dependencies
jest.mock('@theme-original/SearchBar', () => {
  return {
    __esModule: true,
    default: ({className}: {className?: string}) => <div data-testid="search-bar-original" className={className}>Original SearchBar</div>,
  };
});

jest.mock('@cookbookdev/docsbot/react', () => {
  return {
    __esModule: true,
    default: ({apiKey}: {apiKey: string}) => <div data-testid="ask-cookbook" data-api-key={apiKey}>Ask Cookbook Component</div>,
  };
});

describe('SearchBar', () => {
  const mockApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODI2NDYwNmFiYTQyMjdjNzM4OGMzNzUiLCJpYXQiOjE3NDczMzg3NTgsImV4cCI6MjA2MjkxNDc1OH0.t7wQtCXRjmNhfcyrdhVxK2l9kDQJTdUoZm9e87lwIh8';

  it('renders without crashing', () => {
    expect(() => {
      render(<SearchBarWrapper />);
    }).not.toThrow();
  });

  it('renders the original SearchBar component', () => {
    render(<SearchBarWrapper />);
    
    const originalSearchBar = screen.getByTestId('search-bar-original');
    expect(originalSearchBar).toBeInTheDocument();
    expect(originalSearchBar).toHaveTextContent('Original SearchBar');
  });

  it('renders the AskCookbook component', () => {
    render(<SearchBarWrapper />);
    
    const askCookbookComponent = screen.getByTestId('ask-cookbook');
    expect(askCookbookComponent).toBeInTheDocument();
    expect(askCookbookComponent).toHaveTextContent('Ask Cookbook Component');
  });

  it('passes props to the original SearchBar', () => {
    const testClass = 'test-class-name';
    render(<SearchBarWrapper className={testClass} />);
    
    const originalSearchBar = screen.getByTestId('search-bar-original');
    expect(originalSearchBar).toHaveClass(testClass);
  });

  it('passes the correct API key to AskCookbook', () => {
    render(<SearchBarWrapper />);
    
    const askCookbookComponent = screen.getByTestId('ask-cookbook');
    expect(askCookbookComponent).toHaveAttribute('data-api-key', mockApiKey);
  });

  it('renders both components in the correct order', () => {
    render(<SearchBarWrapper />);

    const searchBarElement = screen.getByTestId('search-bar-original');
    const cookbookElement = screen.getByTestId('ask-cookbook');

    // Check that both elements are present
    expect(searchBarElement).toBeInTheDocument();
    expect(cookbookElement).toBeInTheDocument();

    // Verify the order by checking that the SearchBar appears before the AskCookbook in the DOM
    expect(searchBarElement.compareDocumentPosition(cookbookElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
  });
});