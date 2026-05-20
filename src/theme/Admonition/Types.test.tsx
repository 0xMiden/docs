import React from 'react';
import { render } from '@testing-library/react';
import AdmonitionTypes from './Types';

// Mock the imported components
jest.mock('@theme/Admonition/Type/Note', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="note-admonition" data-title={title}>
      Note: {children}
    </div>
  ),
}));

jest.mock('@theme/Admonition/Type/Tip', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="tip-admonition" data-title={title}>
      Tip: {children}
    </div>
  ),
}));

jest.mock('@theme/Admonition/Type/Info', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="info-admonition" data-title={title}>
      Info: {children}
    </div>
  ),
}));

jest.mock('@theme/Admonition/Type/Warning', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="warning-admonition" data-title={title}>
      Warning: {children}
    </div>
  ),
}));

jest.mock('@theme/Admonition/Type/Danger', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="danger-admonition" data-title={title}>
      Danger: {children}
    </div>
  ),
}));

jest.mock('@theme/Admonition/Type/Caution', () => ({
  __esModule: true,
  default: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="caution-admonition" data-title={title}>
      Caution: {children}
    </div>
  ),
}));

describe('AdmonitionTypes', () => {
  test('should have note type', () => {
    const NoteComponent = AdmonitionTypes.note;
    const { getByTestId } = render(<NoteComponent />);

    expect(getByTestId('note-admonition')).toBeInTheDocument();
    expect(getByTestId('note-admonition')).toHaveTextContent('Note:');
  });

  test('should have tip type', () => {
    const TipComponent = AdmonitionTypes.tip;
    const { getByTestId } = render(<TipComponent />);

    expect(getByTestId('tip-admonition')).toBeInTheDocument();
    expect(getByTestId('tip-admonition')).toHaveTextContent('Tip:');
  });

  test('should have info type', () => {
    const InfoComponent = AdmonitionTypes.info;
    const { getByTestId } = render(<InfoComponent />);

    expect(getByTestId('info-admonition')).toBeInTheDocument();
    expect(getByTestId('info-admonition')).toHaveTextContent('Info:');
  });

  test('should have warning type', () => {
    const WarningComponent = AdmonitionTypes.warning;
    const { getByTestId } = render(<WarningComponent />);

    expect(getByTestId('warning-admonition')).toBeInTheDocument();
    expect(getByTestId('warning-admonition')).toHaveTextContent('Warning:');
  });

  test('should have danger type', () => {
    const DangerComponent = AdmonitionTypes.danger;
    const { getByTestId } = render(<DangerComponent />);

    expect(getByTestId('danger-admonition')).toBeInTheDocument();
    expect(getByTestId('danger-admonition')).toHaveTextContent('Danger:');
  });

  test('should have secondary alias that renders as note with title', () => {
    const SecondaryComponent = AdmonitionTypes.secondary;
    const { getByTestId } = render(<SecondaryComponent />);

    expect(getByTestId('note-admonition')).toBeInTheDocument();
    expect(getByTestId('note-admonition')).toHaveAttribute('data-title', 'secondary');
    expect(getByTestId('note-admonition')).toHaveTextContent('Note:');
  });

  test('should have important alias that renders as info with title', () => {
    const ImportantComponent = AdmonitionTypes.important;
    const { getByTestId } = render(<ImportantComponent />);

    expect(getByTestId('info-admonition')).toBeInTheDocument();
    expect(getByTestId('info-admonition')).toHaveAttribute('data-title', 'important');
    expect(getByTestId('info-admonition')).toHaveTextContent('Info:');
  });

  test('should have success alias that renders as tip with title', () => {
    const SuccessComponent = AdmonitionTypes.success;
    const { getByTestId } = render(<SuccessComponent />);

    expect(getByTestId('tip-admonition')).toBeInTheDocument();
    expect(getByTestId('tip-admonition')).toHaveAttribute('data-title', 'success');
    expect(getByTestId('tip-admonition')).toHaveTextContent('Tip:');
  });

  test('should have caution alias', () => {
    const CautionComponent = AdmonitionTypes.caution;
    const { getByTestId } = render(<CautionComponent />);

    expect(getByTestId('caution-admonition')).toBeInTheDocument();
    expect(getByTestId('caution-admonition')).toHaveTextContent('Caution:');
  });

  test('should render with children', () => {
    const NoteComponent = AdmonitionTypes.note;
    const { getByTestId } = render(
      <NoteComponent>Test content</NoteComponent>
    );
    
    expect(getByTestId('note-admonition')).toHaveTextContent('Note: Test content');
  });

  test('should render with custom props', () => {
    const NoteComponent = AdmonitionTypes.note;
    const { getByTestId } = render(
      <NoteComponent customProp="customValue">Test</NoteComponent>
    );
    
    expect(getByTestId('note-admonition')).toBeInTheDocument();
  });
});