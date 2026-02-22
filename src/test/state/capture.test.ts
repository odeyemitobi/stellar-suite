import { StateCaptureService } from '../../services/stateCaptureService';

describe('StateCaptureService', () => {
  const service = new StateCaptureService();

  test('captures direct before/after states', () => {
    const payload = {
      stateBefore: { a: 1 },
      stateAfter: { a: 2 }
    };

    const { before, after } = service.captureSnapshots(payload);

    expect(before.entries.length).toBe(1);
    expect(after.entries.length).toBe(1);
  });

  test('extracts changes array', () => {
    const payload = {
      stateChanges: [
        { key: 'k', before: 1, after: 2 }
      ]
    };

    const { before, after } = service.captureSnapshots(payload);

    expect(before.entries[0].value).toBe(1);
    expect(after.entries[0].value).toBe(2);
  });
});