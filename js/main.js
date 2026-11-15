(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function qs(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  function splitTitle() {
    qsa('.split').forEach(function (title) {
      var index = 0;
      function wrap(node) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var outer = doc.createElement('span');
          outer.className = 'w';
          var inner = doc.createElement('span');
          inner.style.setProperty('--i', index++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        return frag;
      }
      Array.prototype.slice.call(title.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          title.replaceChild(wrap(child), child);
        } else if (child.nodeType === 1) {
          var frag = wrap(child);
          var holder = child.cloneNode(false);
          holder.appendChild(frag);
          title.replaceChild(holder, child);
        }
      });
    });
  }

  function initReveal() {
    var items = qsa('.reveal-up, .reveal-scale');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var nodes = qsa('[data-count]');
    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduceMotion) { el.textContent = target + suffix; return; }
      var start = null;
      var duration = 1400;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    nodes.forEach(function (el) { io.observe(el); });
  }

  function initHeader() {
    var header = qs('#header');
    if (!header) return;
    function update() { header.classList.toggle('scrolled', window.scrollY > 40); }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initParallax() {
    if (reduceMotion || window.matchMedia('(max-width: 920px)').matches) return;
    var els = qsa('[data-parallax]');
    if (!els.length) return;
    var ticking = false;
    function apply() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var center = rect.top + rect.height / 2 - vh / 2;
        var speed = parseFloat(el.getAttribute('data-parallax'));
        el.style.translate = '0 ' + (center * speed).toFixed(1) + 'px';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener('resize', apply);
    apply();
  }

  function initDrawer() {
    var burger = qs('#burger');
    var drawer = qs('#drawer');
    var header = qs('#header');
    var links = qsa('a', drawer);
    function setOpen(open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      drawer.classList.toggle('open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      header.classList.toggle('open', open);
      body.classList.toggle('locked', open);
      if (open) { links[0].focus({ preventScroll: true }); } else { burger.focus({ preventScroll: true }); }
    }
    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });
    links.forEach(function (a) {
      a.addEventListener('click', function () {
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Ouvrir le menu');
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        header.classList.remove('open');
        body.classList.remove('locked');
      });
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false);
    });
    window.matchMedia('(min-width: 1101px)').addEventListener('change', function (m) {
      if (m.matches && drawer.classList.contains('open')) setOpen(false);
    });
  }

  function initMarks() {
    var btn = qs('#toggleMarks');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var off = body.classList.toggle('marks-off');
      btn.setAttribute('aria-pressed', String(off));
      btn.textContent = off ? 'Afficher les repères' : 'Masquer les repères';
    });
  }

  function initLightbox() {
    var box = qs('#lightbox');
    if (!box) return;
    var img = qs('#lbImg');
    var cap = qs('#lbCap');
    var items = [];
    var current = 0;
    var lastFocus = null;
    function collect(from) {
      var scope = qs('.page:not([hidden])') || doc;
      items = qsa('.g-item', scope).filter(function (it) { return !it.hidden; });
      return items.indexOf(from);
    }
    function show(i) {
      current = (i + items.length) % items.length;
      var source = qs('img', items[current]);
      img.src = source.getAttribute('src');
      img.alt = source.getAttribute('alt');
      cap.textContent = qs('span', items[current]).textContent;
    }
    function open(i) {
      lastFocus = doc.activeElement;
      show(i);
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      body.classList.add('locked');
      qs('.lb-close', box).focus();
    }
    function close() {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      body.classList.remove('locked');
      if (lastFocus) lastFocus.focus();
    }
    doc.addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.g-item') : null;
      if (!it) return;
      var idx = collect(it);
      if (idx > -1) open(idx);
    });
    qs('.lb-close', box).addEventListener('click', close);
    qs('.lb-prev', box).addEventListener('click', function () { show(current - 1); });
    qs('.lb-next', box).addEventListener('click', function () { show(current + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    doc.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'Tab') {
        var f = qsa('button', box);
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var startX = null;
    box.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  function initFilters() {
    var chips = qsa('.chip');
    if (!chips.length) return;
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        qsa('.gal-grid .g-item').forEach(function (it) {
          it.hidden = !(cat === 'all' || it.getAttribute('data-cat') === cat);
        });
      });
    });
  }

  function initForm() {
    var form = qs('#quote');
    if (!form) return;
    var phoneRe = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/;
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var rules = {
      nom: function (v) { return v.trim().length >= 2 ? '' : 'Indiquez votre nom.'; },
      tel: function (v) { return phoneRe.test(v.trim()) ? '' : 'Indiquez un numéro de téléphone valide (ex. 06 12 34 56 78).'; },
      email: function (v) { return emailRe.test(v.trim()) ? '' : 'Indiquez une adresse e-mail valide.'; },
      type: function (v) { return v ? '' : 'Choisissez un type de travaux.'; },
      message: function (v) { return v.trim().length >= 10 ? '' : 'Décrivez votre projet en quelques mots (10 caractères minimum).'; }
    };
    function setError(name, msg) {
      var input = form.elements[name];
      var err = qs('#' + name + '-err');
      var field = input.closest('.field');
      if (field) field.classList.toggle('invalid', Boolean(msg));
      err.textContent = msg;
      if (!field) err.classList.toggle('show', Boolean(msg));
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    function validate(name) {
      var el = form.elements[name];
      var msg = '';
      if (name === 'consent') { msg = el.checked ? '' : 'Votre accord est nécessaire pour traiter la demande.'; }
      else if (rules[name]) { msg = rules[name](el.value); }
      setError(name, msg);
      return !msg;
    }
    Object.keys(rules).concat(['consent']).forEach(function (name) {
      var el = form.elements[name];
      el.addEventListener('blur', function () { validate(name); });
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true') validate(name);
      });
      el.addEventListener('change', function () {
        if (el.getAttribute('aria-invalid') === 'true') validate(name);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.website && form.elements.website.value) return;
      var names = Object.keys(rules).concat(['consent']);
      var firstInvalid = null;
      names.forEach(function (n) {
        if (!validate(n) && !firstInvalid) firstInvalid = form.elements[n];
      });
      if (firstInvalid) { firstInvalid.focus(); return; }
      var endpoint = form.getAttribute('data-endpoint');
      form.classList.add('sending');
      var finish = function () {
        form.classList.remove('sending');
        form.classList.add('done');
        qs('#formOk').focus();
      };
      if (!endpoint) { setTimeout(finish, 900); return; }
      var data = new FormData(form);
      fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('send'); finish(); })
        .catch(function () {
          form.classList.remove('sending');
          var msg = qs('#consent-err');
          msg.textContent = "L'envoi a échoué. Appelez-nous au 06 79 42 98 64.";
          msg.classList.add('show');
        });
    });
  }

  function initTypes() {
    doc.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-type]') : null;
      if (!el) return;
      try { sessionStorage.setItem('besneType', el.getAttribute('data-type')); } catch (err) {}
      var s = qs('#type');
      if (s) s.value = el.getAttribute('data-type');
    });
    var s = qs('#type');
    if (s) {
      try { var t = sessionStorage.getItem('besneType'); if (t) s.value = t; } catch (err) {}
    }
  }

  splitTitle();
  initReveal();
  initCounters();
  initHeader();
  initParallax();
  initDrawer();
  initMarks();
  initLightbox();
  initForm();
  initFilters();
  initTypes();
})();
