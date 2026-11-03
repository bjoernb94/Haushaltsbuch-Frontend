import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Eine neue Seite beginnt oben, sonst bleibt z. B. eine Meldung außerhalb des Blickfelds.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      // Bricht die Rückfrage den Zurück-Button ab, muss der Browserverlauf stimmig bleiben.
      withRouterConfig({ canceledNavigationResolution: 'computed' }),
    ),
    provideHttpClient(
      // Passt zu Spring Securitys csrf.spa(): Cookie XSRF-TOKEN, Header X-XSRF-TOKEN.
      // Angular setzt den Header nur bei relativen URLs, deshalb laufen alle Aufrufe
      // über /api (im Dev-Betrieb per proxy.conf.json an das Backend weitergeleitet).
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([authInterceptor]),
    ),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' },
  ],
};
