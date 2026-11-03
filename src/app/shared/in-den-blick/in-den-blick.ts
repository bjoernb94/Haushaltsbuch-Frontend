/**
 * Scrollt nur so weit wie nötig: Was schon sichtbar ist, bleibt stehen, was aufs Fenster passt, kommt
 * ganz ins Bild, und was zu hoch ist, beginnt oben. {@code scroll-margin} des Elements zählt mit, z. B.
 * für eine fest eingeblendete Navigation.
 */
export function inDenBlick(element: HTMLElement): void {
  const fenster = element.ownerDocument.defaultView!;
  const { scrollMarginTop, scrollMarginBottom } = fenster.getComputedStyle(element);
  const platz =
    fenster.innerHeight -
    (parseFloat(scrollMarginTop) || 0) -
    (parseFloat(scrollMarginBottom) || 0);
  element.scrollIntoView({
    // „nearest“ könnte ein zu hohes Element auch am unteren Rand ausrichten.
    block: element.getBoundingClientRect().height <= platz ? 'nearest' : 'start',
    behavior: fenster.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
