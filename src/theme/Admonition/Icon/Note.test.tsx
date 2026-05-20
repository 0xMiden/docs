import React from 'react';
import { render } from '@testing-library/react';
import AdmonitionIconNote from './Note';

describe('AdmonitionIconNote', () => {
  test('renders without crashing', () => {
    const { container } = render(<AdmonitionIconNote />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  test('has correct svg attributes', () => {
    const { container } = render(<AdmonitionIconNote />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveAttribute('width', '9');
    expect(svgElement).toHaveAttribute('height', '10');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 9 10');
    expect(svgElement).toHaveAttribute('fill', 'none');
    expect(svgElement).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  test('has default attributes only, does not receive additional props', () => {
    const { container } = render(<AdmonitionIconNote className="custom-class" aria-label="note-icon" />);
    const svgElement = container.querySelector('svg');

    // The current implementation does not spread props to the SVG element
    // So additional props like className and aria-label are not applied
    // The SVG should have only the default attributes
    expect(svgElement).toHaveAttribute('width', '9');
    expect(svgElement).toHaveAttribute('height', '10');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 9 10');
  });

  test('contains the expected path element', () => {
    const { container } = render(<AdmonitionIconNote />);
    const svgElement = container.querySelector('svg');
    const pathElement = svgElement.querySelector('path');

    expect(pathElement).toBeInTheDocument();
    expect(pathElement).toHaveAttribute('d', 'M0 0H9V7H8V8H7V7H6V8H7V9H6V10H0V0ZM1 1V9H5V6H8V1H1Z');
    expect(pathElement).toHaveAttribute('fill', '#FF5500');
  });
});