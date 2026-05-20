import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from './index';

describe('Home Page', () => {
  it('should render Redirect component to /intro', () => {
    render(<Home />);

    const redirectElement = screen.getByTestId('redirect');
    expect(redirectElement).toBeInTheDocument();
    expect(redirectElement.getAttribute('data-to')).toBe('/intro');
  });

  it('renders without crashing', () => {
    const { container } = render(<Home />);

    expect(container).toBeInTheDocument();
  });
});