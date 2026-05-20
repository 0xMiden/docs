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

  it('passes props to the original SearchBar', () => {
    const testClass = 'test-class-name';
    render(<SearchBarWrapper className={testClass} />);
    
    const originalSearchBar = screen.getByTestId('search-bar-original');
    expect(originalSearchBar).toHaveClass(testClass);
  });
});