import React from 'react';
import { render, screen } from '@testing-library/react';
import AdmonitionIconInfo from './Info';

describe('AdmonitionIconInfo', () => {
  test('renders without crashing', () => {
    const { container } = render(<AdmonitionIconInfo />);
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
  });

  test('has correct svg attributes', () => {
    const { container } = render(<AdmonitionIconInfo />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveAttribute('width', '13');
    expect(svgElement).toHaveAttribute('height', '17');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 13 17');
    expect(svgElement).toHaveAttribute('fill', 'none');
    expect(svgElement).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
  });

  test('applies additional props correctly', () => {
    const { container } = render(<AdmonitionIconInfo className="custom-class" aria-label="info-icon" />);
    const svgElement = container.querySelector('svg');

    expect(svgElement).toHaveClass('custom-class');
    expect(svgElement).toHaveAttribute('aria-label', 'info-icon');
  });

  test('contains the expected path element', () => {
    const { container } = render(<AdmonitionIconInfo />);
    const svgElement = container.querySelector('svg');
    const pathElement = svgElement.querySelector('path');

    expect(pathElement).toBeInTheDocument();
    expect(pathElement).toHaveAttribute('fill', '#102445');
    expect(pathElement).toHaveAttribute(
      'd',
      'M3.33332 0.583313H9.66666V2.16665H3.33332V0.583313ZM1.74999 3.74998V2.16665H3.33332V3.74998H1.74999ZM1.74999 8.49998H0.166656V3.74998H1.74999V8.49998ZM3.33332 10.0833H1.74999V8.49998H3.33332V10.0833ZM9.66666 10.0833V13.25H3.33332V10.0833H4.91666V11.6666H8.08332V10.0833H9.66666ZM11.25 8.49998V10.0833H9.66666V8.49998H11.25ZM11.25 3.74998H12.8333V8.49998H11.25V3.74998ZM11.25 3.74998V2.16665H9.66666V3.74998H11.25ZM9.66666 14.8333H3.33332V16.4166H9.66666V14.8333Z'
    );
  });

  test('accepts and applies spread props', () => {
    render(<AdmonitionIconInfo data-testid="info-icon" id="my-svg" />);

    const svgElement = screen.getByTestId('info-icon');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveAttribute('id', 'my-svg');
  });

  test('matches snapshot', () => {
    const { container } = render(<AdmonitionIconInfo />);
    expect(container.firstChild).toMatchSnapshot();
  });
});