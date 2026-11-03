// Steht im Image-Test für das Backend: Antwortet auf alles mit dem, was nginx weitergeleitet hat.
import { createServer } from 'node:http';

createServer((anfrage, antwort) => {
  antwort.writeHead(200, { 'Content-Type': 'application/json', 'X-Backend-Attrappe': 'ja' });
  antwort.end(
    JSON.stringify({ methode: anfrage.method, pfad: anfrage.url, kopfzeilen: anfrage.headers }),
  );
}).listen(9000, '127.0.0.1');
