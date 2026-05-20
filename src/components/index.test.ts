import { CodeTabs } from './index';

describe('Components Index Export', () => {
  test('should export CodeTabs component', () => {
    expect(CodeTabs).toBeDefined();
    expect(typeof CodeTabs).toBe('function');
  });

  test('CodeTabs should be truthy', () => {
    expect(CodeTabs).toBeTruthy();
  });
});