import React from 'react';
import { render, screen } from '@testing-library/react';
import AdmonitionIconWarning from './Warning';

describe('AdmonitionIconWarning', () => {
  it('renders correctly with default props', () => {
    render(<AdmonitionIconWarning />);

    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveAttribute('width', '19');
    expect(svgElement).toHaveAttribute('height', '19');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 19 19');
    expect(svgElement).toHaveAttribute('fill', 'none');
    expect(svgElement).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  it('renders the warning icon path', () => {
    render(<AdmonitionIconWarning />);

    const pathElement = document.querySelector('path');
    expect(pathElement).toBeInTheDocument();
    expect(pathElement).toHaveAttribute('fill', '#FF5500');
  });

  it('passes additional props to the svg element', () => {
    render(<AdmonitionIconWarning data-testid="warning-icon" className="custom-class" />);

    const svgElement = screen.getByTestId('warning-icon');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveClass('custom-class');
  });

  it('renders with accessibility attributes', () => {
    render(<AdmonitionIconWarning aria-label="Warning" />);

    const svgElement = screen.getByLabelText('Warning');
    expect(svgElement).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { container } = render(<AdmonitionIconWarning />);
    expect(container.firstChild).toMatchSnapshot();
  });
});