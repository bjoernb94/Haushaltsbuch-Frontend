import { HttpContextToken } from '@angular/common/http';

/**
 * Für Aufrufe, bei denen 401 eine erwartete Antwort ist (Anmeldung, Statusabfrage): keine
 * Umleitung auf den Login, der Aufrufer wertet den Fehler selbst aus.
 */
export const OHNE_ANMELDE_UMLEITUNG = new HttpContextToken<boolean>(() => false);
