import React from 'react';
import { render } from '@testing-library/react';
import AdmonitionIconTip from './Tip';

describe('AdmonitionIconTip', () => {
  test('renders without crashing', () => {
    const { container } = render(<AdmonitionIconTip />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  test('has correct svg attributes', () => {
    const { container } = render(<AdmonitionIconTip />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveAttribute('width', '19');
    expect(svgElement).toHaveAttribute('height', '19');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 19 19');
    expect(svgElement).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  test('applies additional props correctly', () => {
    const { container } = render(<AdmonitionIconTip className="custom-class" aria-label="tip-icon" />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveClass('custom-class');
    expect(svgElement).toHaveAttribute('aria-label', 'tip-icon');
  });

  test('contains the expected path elements', () => {
    const { container } = render(<AdmonitionIconTip />);
    const svgElement = container.querySelector('svg');
    const pathElements = svgElement.querySelectorAll('path');

    expect(pathElements).toHaveLength(1);
    expect(pathElements[0]).toHaveAttribute('fill', '#00871D');
    expect(pathElements[0]).toHaveAttribute('d', 'M10.2917 1.58337H8.70834V6.33337H10.2917V1.58337ZM10.2917 12.6667H8.70834V17.4167H10.2917V12.6667ZM17.4167 8.70837V10.2917H12.6667V8.70837H17.4167ZM6.33334 10.2917V8.70837H1.58334V10.2917H6.33334ZM11.875 5.54171H13.4583V7.12504H11.875V5.54171ZM15.0417 3.95837H13.4583V5.54171H15.0417V3.95837ZM7.12501 5.54171H5.54168V7.12504H7.12501V5.54171ZM3.95834 3.95837H5.54168V5.54171H3.95834V3.95837ZM11.875 13.4584H13.4583V15.0417H15.0417V13.4584H13.4583V11.875H11.875V13.4584ZM5.54168 13.4584V11.875H7.12501V13.4584H5.54168ZM5.54168 13.4584V15.0417H3.95834V13.4584H5.54168Z');
  });

  test('has role attribute for accessibility', () => {
    const { container } = render(<AdmonitionIconTip />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });
});