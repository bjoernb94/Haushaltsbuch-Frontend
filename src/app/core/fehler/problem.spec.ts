import { HttpErrorResponse } from '@angular/common/http';
import { problemCode, problemFelder } from './problem';

describe('problemCode', () => {
  it('liest den Code aus dem ProblemDetail', () => {
    const error = new HttpErrorResponse({ status: 403, error: { code: 'ANMELDUNG_GESPERRT' } });
    expect(problemCode(error)).toBe('ANMELDUNG_GESPERRT');
  });

  it('liefert null ohne Code', () => {
    expect(problemCode(new HttpErrorResponse({ status: 0 }))).toBeNull();
    expect(
      problemCode(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
    ).toBeNull();
    expect(problemCode(new HttpErrorResponse({ status: 502, error: '<html>' }))).toBeNull();
    expect(problemCode(new HttpErrorResponse({ status: 500, error: { code: 500 } }))).toBeNull();
    expect(problemCode(new Error('x'))).toBeNull();
  });
});

describe('problemFelder', () => {
  it('liest die Feldfehler aus dem ProblemDetail', () => {
    const felder = [{ feld: 'email', code: 'Email', parameter: {} }];
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'VALIDIERUNG', felder },
    });
    expect(problemFelder(error)).toEqual(felder);
  });

  it('liefert sonst eine leere Liste', () => {
    expect(problemFelder(new HttpErrorResponse({ status: 400, error: { code: 'X' } }))).toEqual([]);
    expect(problemFelder(new HttpErrorResponse({ status: 502, error: '<html>' }))).toEqual([]);
    expect(problemFelder(new Error('x'))).toEqual([]);
  });
});
