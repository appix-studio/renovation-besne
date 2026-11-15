import base64, re, pathlib, zipfile, json

root = pathlib.Path(__file__).parent
PAGES = ['index', 'prestations', 'realisations', 'contact', 'mentions-legales']
NAMES = {'index': 'Accueil', 'prestations': 'Prestations', 'realisations': 'Réalisations', 'contact': 'Contact', 'mentions-legales': 'Mentions légales'}

layout = (root / 'layout.html').read_text(encoding='utf-8')
icons = (root / 'partials' / 'icons.html').read_text(encoding='utf-8')
header = (root / 'partials' / 'header.html').read_text(encoding='utf-8')
footer = (root / 'partials' / 'footer.html').read_text(encoding='utf-8')
css = (root / 'css' / 'styles.css').read_text(encoding='utf-8')
js = (root / 'js' / 'main.js').read_text(encoding='utf-8')


def parse(name):
    raw = (root / 'pages' / (name + '.html')).read_text(encoding='utf-8')
    head, body = raw.split('\n---\n', 1)
    meta = {}
    for line in head.splitlines():
        k, v = line.split(':', 1)
        meta[k.strip()] = v.strip()
    return meta, body


def jsonld(meta):
    if 'jsonld' not in meta:
        return ''
    return '<script type="application/ld+json">\n%s\n</script>' % meta['jsonld']


def current(html, page):
    key = {'index': None, 'prestations': 'prestations', 'realisations': 'realisations', 'contact': 'contact'}.get(page)
    if not key:
        return html
    return re.sub(r'(<a href="[^"]*" data-p="%s")' % key, r'\1 aria-current="page"', html)


def render_page(name):
    meta, body = parse(name)
    html = layout
    for k, v in {'{{title}}': meta['title'], '{{description}}': meta['description'], '{{jsonld}}': jsonld(meta),
                 '{{icons}}': icons, '{{header}}': current(header, name), '{{footer}}': footer, '{{body}}': body}.items():
        html = html.replace(k, v)
    return html


for p in PAGES:
    (root / (p + '.html')).write_text(render_page(p), encoding='utf-8')


def data_uri(match):
    path = root / match.group(0)
    mime = {'.png': 'image/png', '.woff2': 'font/woff2'}.get(path.suffix, 'image/jpeg')
    return 'data:%s;base64,%s' % (mime, base64.b64encode(path.read_bytes()).decode())


def route_links(html, page=None):
    def page_link(m):
        target = m.group(1)
        anchor = m.group(2)
        return 'href="#/%s%s"' % (target, ('/' + anchor) if anchor else '')
    html = re.sub(r'href="(index|prestations|realisations|contact|mentions-legales)\.html(?:#([\w-]+))?"', page_link, html)
    if page:
        html = re.sub(r'(<a [^>]*?)href="#([\w-]+)"', lambda m: '%shref="#/%s/%s"' % (m.group(1), page, m.group(2)), html)
    return html


ROUTER = """
(function () {
  var pages = %s;
  var titles = %s;
  var current = null;
  function parse(h) {
    var m = (h || '').match(/^#\\/([\\w-]+)(?:\\/([\\w-]+))?/);
    return m && pages.indexOf(m[1]) > -1 ? { page: m[1], anchor: m[2] || null } : null;
  }
  function show(page, anchor, push) {
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (el) {
      el.hidden = el.getAttribute('data-page') !== page;
    });
    document.title = titles[page];
    Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) {
      if (a.getAttribute('href') === '#/' + page) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var changed = page !== current;
    current = page;
    if (push) {
      try { history.pushState(null, '', '#/' + page + (anchor ? '/' + anchor : '')); } catch (e) {}
    }
    requestAnimationFrame(function () {
      var el = anchor ? document.getElementById(anchor) : null;
      if (el) { el.scrollIntoView(); }
      else { window.scrollTo(0, 0); }
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (!a) return;
    var r = parse(a.getAttribute('href'));
    if (!r) return;
    e.preventDefault();
    show(r.page, r.anchor, true);
  });
  window.addEventListener('hashchange', function () {
    var r = parse(location.hash);
    if (r) show(r.page, r.anchor, false);
  });
  window.addEventListener('popstate', function () {
    var r = parse(location.hash) || { page: 'index', anchor: null };
    show(r.page, r.anchor, false);
  });
  var first = parse(location.hash) || { page: 'index', anchor: null };
  show(first.page, first.anchor, false);
})();
"""


def build_single():
    parts = {}
    titles = {}
    for p in PAGES:
        meta, body = parse(p)
        titles[p] = meta['title']
        parts[p] = '<div class="page" data-page="%s"%s>\n%s\n</div>' % (p, '' if p == 'index' else ' hidden', route_links(body, p))
    meta, _ = parse('index')
    html = layout
    main = '\n'.join(parts[p] for p in PAGES)
    for k, v in {'{{title}}': meta['title'], '{{description}}': meta['description'], '{{jsonld}}': jsonld(meta),
                 '{{icons}}': icons, '{{header}}': route_links(header), '{{footer}}': route_links(footer), '{{body}}': main}.items():
        html = html.replace(k, v)
    html = html.replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n%s\n</style>' % css)
    html = html.replace('<script src="js/main.js" defer></script>', '<script>\n%s\n</script>\n<script>%s</script>' % (js, ROUTER % (json.dumps(PAGES), json.dumps(titles, ensure_ascii=False))))
    html = re.sub(r'assets/(?:img|fonts)/[\w.\-]+', data_uri, html)
    return html


dist = root / 'dist'
dist.mkdir(exist_ok=True)
(dist / 'besne-renovation-maquette.html').write_text(build_single(), encoding='utf-8')

with zipfile.ZipFile(dist / 'besne-renovation-projet.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in [p + '.html' for p in PAGES] + ['layout.html', 'build.py', 'README.md']:
        z.write(root / f, 'besne-renovation/' + f)
    for folder in ['css', 'js', 'assets', 'pages', 'partials']:
        for f in (root / folder).rglob('*'):
            if f.is_file():
                z.write(f, 'besne-renovation/' + str(f.relative_to(root)))
print('ok')
