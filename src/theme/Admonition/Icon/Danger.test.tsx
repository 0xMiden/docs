import React from 'react';
import { render } from '@testing-library/react';
import AdmonitionIconDanger from './Danger';

describe('AdmonitionIconDanger', () => {
  it('renders without crashing', () => {
    const { container } = render(<AdmonitionIconDanger />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  it('has correct SVG attributes', () => {
    const { container } = render(<AdmonitionIconDanger />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '15');
    expect(svg).toHaveAttribute('height', '19');
    expect(svg).toHaveAttribute('viewBox', '0 0 15 19');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  it('has the correct path element with red fill', () => {
    const { container } = render(<AdmonitionIconDanger />);
    const path = container.querySelector('svg path');

    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('fill', '#FF0000');
  });

  it('renders SVG with proper structure', () => {
    const { container } = render(<AdmonitionIconDanger />);
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.children).toHaveLength(1); // Only one child element (the path)
    expect(svg.firstElementChild).toHaveAttribute('fill', '#FF0000');
  });

  it('renders the correct shape path', () => {
    const { container } = render(<AdmonitionIconDanger />);
    const path = container.querySelector('svg path');

    expect(path).toBeInTheDocument();
    // Test that the path has the expected d attribute (or at least a long path string indicating complexity)
    const pathData = path.getAttribute('d');
    expect(pathData.length).toBeGreaterThan(50); // A complex path would have a long d string
  });
});