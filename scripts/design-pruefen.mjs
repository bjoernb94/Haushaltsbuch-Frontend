#!/usr/bin/env node
// Prüft einen geladenen Stand des Design-Canvas „Haushaltsbuch“ oder des Design Systems selbst (#147):
// Farben nur als Token-Verweis var(--app-…), Abstände, Radien und Schriftgrößen nur aus den Skalen (#124).
// Außerdem: Die Tokens im Canvas stimmen mit src/styles.scss und src/styles/_masse.scss überein.
//
// Aufruf: npm run design:pruefen -- <Ordner>   (der Ordner enthält project/ wie im Canvas bzw. Design System)
// Die CI kann den Canvas nicht laden; das Skript läuft nach jeder Änderung am Canvas (CLAUDE.md).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = new URL('..', import.meta.url).pathname;

const ordner = process.argv[2];
if (!ordner) {
  console.error('Aufruf: npm run design:pruefen -- <Ordner mit project/>');
  process.exit(2);
}
const projekt = join(ordner, 'project');
// Im Canvas liegt die installierte Kopie des Design Systems unter ds/, im Design System die Tokens selbst.
const kopie = join(projekt, 'ds/haushaltsbuch/tokens.json');
const tokens = JSON.parse(
  readFileSync(existsSync(kopie) ? kopie : join(projekt, 'tokens.json'), 'utf8'),
);

/**
 * Gleiche Farben gleich schreiben: klein, ohne Leerzeichen, #fff als #ffffff, Zahlen in rgba() ohne Nullen am Ende.
 * Hex-Werte bleiben, wie sie sind: Nullen sind dort Ziffern (#7a4b00 ist nicht #7a4b0).
 */
function farbe(wert) {
  const w = wert.toLowerCase().replace(/\s+/g, '');
  if (/^#[0-9a-f]{3}$/.test(w)) {
    return '#' + [...w.slice(1)].map((z) => z + z).join('');
  }
  if (w.startsWith('#')) return w;
  return w.replace(/\d*\.\d+|\d+/g, (zahl) => String(Number(zahl)));
}

const farbToken = new Map(
  tokens.color.tokens.map((t) => [t.name, farbe(Object.values(t.value)[0])]),
);
const tokenZuFarbe = new Map([...farbToken].map(([name, wert]) => [wert, name]));
const skala = (familie) => new Set(familie.tokens.map((t) => parseFloat(t.value)));
const massNamen = new Set(
  [tokens.spacing, tokens.radius, tokens.schriftgroesse].flatMap((f) =>
    f.tokens.map((t) => t.name),
  ),
);
const abstaende = skala(tokens.spacing);
const radien = skala(tokens.radius);
const schriften = skala(tokens.schriftgroesse);
// Layoutmaße ohne Token (README des Design Systems): Platz für die Tab-Leiste unten.
const LAYOUT = new Set([84]);

const fehler = [];
const melden = (datei, text, index, meldung) =>
  fehler.push(`${datei}:${text.slice(0, index).split('\n').length}  ${meldung}`);

// 1. Tokens im Canvas = Tokens im Code.
const styles = readFileSync(join(repo, 'src/styles.scss'), 'utf8');
const codeFarben = new Map(
  [...styles.matchAll(/--(app-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], farbe(m[2])]),
);
for (const [name, wert] of farbToken) {
  if (!codeFarben.has(name)) {
    fehler.push(`src/styles.scss  --${name} fehlt (Design System: ${wert})`);
  } else if (codeFarben.get(name) !== wert) {
    fehler.push(`src/styles.scss  --${name} ist ${codeFarben.get(name)}, im Design System ${wert}`);
  }
}
for (const name of codeFarben.keys()) {
  if (!farbToken.has(name)) {
    fehler.push(`src/styles.scss  --${name} gibt es im Design System nicht`);
  }
}
const masse = readFileSync(join(repo, 'src/styles/_masse.scss'), 'utf8');
const codeMasse = new Map(
  [...masse.matchAll(/^\$([a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]]),
);
for (const familie of [tokens.spacing, tokens.radius, tokens.schriftgroesse]) {
  for (const t of familie.tokens) {
    if (codeMasse.get(t.name) !== t.value) {
      fehler.push(
        `src/styles/_masse.scss  $${t.name} ist ${codeMasse.get(t.name)}, im Design System ${t.value}`,
      );
    }
  }
}

// 2. Farben in den Artboards.
const FARBE = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^()]*\)/g;
const VERWEIS = /var\(\s*--([\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*?))?\s*\)/g;

/** Stellen, die keine Farbe der Oberfläche sind oder anders geprüft werden, durch Leerzeichen ersetzen. */
function ohne(text, muster) {
  return text.replace(muster, (treffer) => ' '.repeat(treffer.length));
}

function farbenPruefen(datei, text) {
  // Masken des Logos (schwarz/weiß sind dort Technik), Kommentare und Holes bleiben außen vor.
  let rest = ohne(text, /<mask\b[\s\S]*?<\/mask>/g);
  rest = ohne(rest, /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g);
  // Editoren für Farb-Props (data-props) brauchen Hex-Werte; die müssen aber Tokens sein.
  for (const m of rest.matchAll(/data-props='[^']*'/g)) {
    for (const f of m[0].matchAll(FARBE)) {
      if (!tokenZuFarbe.has(farbe(f[0]))) {
        melden(datei, text, m.index + f.index, `Farbe ${f[0]} in data-props ist kein Token`);
      }
    }
  }
  rest = ohne(rest, /data-props='[^']*'/g);
  for (const v of rest.matchAll(VERWEIS)) {
    const [ganz, name, ersatz] = v;
    if (/^(abstand|radius|schrift)-/.test(name)) {
      if (!massNamen.has(name)) melden(datei, text, v.index, `--${name} ist kein Token`);
      continue;
    }
    if (!name.startsWith('app-')) {
      continue;
    }
    if (!farbToken.has(name)) {
      melden(datei, text, v.index, `--${name} ist kein Farb-Token`);
    } else if (ersatz && farbe(ersatz) !== farbToken.get(name)) {
      melden(
        datei,
        text,
        v.index,
        `Ersatzwert ${ersatz} passt nicht zu --${name} (${farbToken.get(name)})`,
      );
    }
    rest = rest.slice(0, v.index) + ' '.repeat(ganz.length) + rest.slice(v.index + ganz.length);
  }
  for (const f of rest.matchAll(FARBE)) {
    const name = tokenZuFarbe.get(farbe(f[0]));
    melden(
      datei,
      text,
      f.index,
      name ? `${f[0]} als Literal, besser var(--${name})` : `Farbe ${f[0]} ist kein Token`,
    );
  }
}

// 3. Abstände, Radien und Schriftgrößen in px.
const MASS =
  /(?<![\w-])(gap|row-gap|column-gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|font-size|border(?:-[a-z]+)*-radius)\s*:\s*([^;"'}{]+)/g;

function masseVon(eigenschaft) {
  if (eigenschaft === 'font-size') return ['Schriftgröße', schriften];
  if (eigenschaft.endsWith('radius')) return ['Radius', radien];
  return ['Abstand', abstaende];
}

function massePruefen(datei, text) {
  for (const m of text.matchAll(MASS)) {
    const [art, erlaubt] = masseVon(m[1]);
    // Funktionen (max(), calc(), env()) sind Layout, Holes ({{ … }}) kommen aus dem Skript.
    let wert = m[2];
    while (/[a-z-]+\([^()]*\)/.test(wert)) wert = wert.replace(/[a-z-]+\([^()]*\)/g, ' ');
    for (const px of wert.matchAll(/-?(\d+(?:\.\d+)?)px\b/g)) {
      const zahl = Number(px[1]);
      // 1-px-Linien und -Korrekturen sind erlaubt (README des Design Systems).
      if (zahl === 0 || zahl === 1 || erlaubt.has(zahl) || LAYOUT.has(zahl)) continue;
      melden(datei, text, m.index, `${art} ${px[0]} (${m[1]}) liegt nicht auf der Skala`);
    }
  }
}

// Canvas: Artboards und Stylesheets. Design System: die Vorschauen der Bausteine, ohne das Cover (Dekoration).
const dateien = readdirSync(projekt, { recursive: true })
  .filter(
    (d) =>
      /^[^/]+\.(dc\.html|css)$/.test(d) || /^components\/(?!Cover\/)[^/]+\/preview\.html$/.test(d),
  )
  .sort();
for (const datei of dateien) {
  const text = readFileSync(join(projekt, datei), 'utf8');
  farbenPruefen(datei, text);
  massePruefen(datei, text);
}

if (fehler.length > 0) {
  console.log(fehler.join('\n'));
  console.log(`\n${fehler.length} Abweichungen vom Design System.`);
  process.exit(1);
}
console.log(`${dateien.length} Dateien geprüft, keine Abweichungen vom Design System.`);
