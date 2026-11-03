import { inDenBlick } from './in-den-blick';

describe('inDenBlick', () => {
  const scrollen = vi.fn();

  function element(hoehe: number): HTMLElement {
    const el = document.createElement('div');
    el.scrollIntoView = scrollen;
    el.style.scrollMarginTop = '16px';
    el.style.scrollMarginBottom = '84px';
    el.getBoundingClientRect = () => ({ height: hoehe }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  function bewegungReduziert(reduziert: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduziert });
  }

  beforeEach(() => {
    scrollen.mockReset();
    bewegungReduziert(false);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('scrollt nur so weit wie nötig, wenn es aufs Fenster passt', () => {
    inDenBlick(element(700));
    expect(scrollen).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('beginnt oben, wenn es zu hoch ist; die Ränder zählen mit', () => {
    inDenBlick(element(701));
    expect(scrollen).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('verzichtet bei reduzierter Bewegung auf die Animation', () => {
    bewegungReduziert(true);
    inDenBlick(element(100));
    expect(scrollen).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });
});
