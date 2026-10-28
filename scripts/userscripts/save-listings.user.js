// ==UserScript==
// @name         Animal listing saver (manual browsing)
// @namespace    https://pawheaven.online/
// @version      1.1.0
// @description  While you browse, remembers each animal detail page you open and lets you export the list as JSON. It never loads pages by itself.
// @match        https://dekalbanimalservices.com/adopt/*
// @match        https://dekalbanimalservices.com/pet-details/*
// @match        https://petbridge.org/animals/*
// @match        https://www.petbridge.org/animals/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY = 'savedAnimals';
  const PAUSE_KEY = 'paused';
  const IS_TOP = window.top === window;

  // Label (lowercase, no colon) -> field name. Add synonyms here if a site words something differently.
  const LABELS = {
    species: ['species', 'type', 'animal type', 'kind'],
    breed: ['breed', 'primary breed', 'breeds'],
    secondaryBreed: ['secondary breed', 'mix', 'mixed with'],
    sex: ['sex', 'gender'],
    age: ['age'],
    size: ['size'],
    color: ['color', 'colour', 'coat', 'coat color', 'primary color'],
    weight: ['weight'],
    animalId: ['animal id', 'pet id', 'id', 'id #', 'id number', 'animal #', 'animal number', 'shelter id'],
    spayedNeutered: ['spayed/neutered', 'spayed / neutered', 'neutered/spayed', 'altered', 'spay/neuter', 'spayed or neutered'],
    location: ['location', 'kennel', 'cage', 'kennel number', 'shelter', 'facility'],
    intakeDate: ['here since', 'intake date', 'date available', 'available since', 'arrival date', 'date in', 'in shelter since'],
    status: ['status', 'adoption status'],
  };
  const LABEL_TO_FIELD = new Map();
  for (const [field, names] of Object.entries(LABELS)) for (const name of names) LABEL_TO_FIELD.set(name, field);

  /** Pure: turns text lines into {field: value} using "Label: value" and "Label" / "value" line pairs. */
  function parseFields(lines) {
    const fields = {};
    const clean = lines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (let i = 0; i < clean.length; i += 1) {
      const line = clean[i];
      const inline = line.match(/^([A-Za-z][A-Za-z /#.&-]{1,30}?)\s*:\s*(.*)$/);
      if (inline) {
        const field = LABEL_TO_FIELD.get(inline[1].toLowerCase().trim());
        if (field && !fields[field]) {
          const value = inline[2] || clean[i + 1] || '';
          if (value && value.length < 160 && !LABEL_TO_FIELD.has(value.toLowerCase().replace(/:$/, ''))) { fields[field] = value; continue; }
        }
      }
      const bare = LABEL_TO_FIELD.get(line.toLowerCase().replace(/:$/, ''));
      if (bare && !fields[bare] && clean[i + 1] && clean[i + 1].length < 160 && !LABEL_TO_FIELD.has(clean[i + 1].toLowerCase().replace(/:$/, ''))) {
        fields[bare] = clean[i + 1];
        i += 1;
      }
    }
    return fields;
  }

  const panelHost = IS_TOP ? document.createElement('div') : null;

  function bodyLines() {
    const hidden = panelHost ? panelHost.style.display : '';
    if (panelHost) panelHost.style.display = 'none';
    const text = document.body ? document.body.innerText : '';
    if (panelHost) panelHost.style.display = hidden;
    return text.split('\n');
  }

  function absolute(url) {
    try { return new URL(url, location.href).href; } catch { return ''; }
  }

  function pageImages() {
    const found = [];
    // Full-size photos are the gallery links (data-fancybox); the <img> tags are thumbnails.
    for (const link of document.querySelectorAll('.details_animal_photos a[href], a[data-fancybox][href]')) {
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(link.href)) found.push({ url: absolute(link.href), area: Number.MAX_SAFE_INTEGER - 1 });
    }
    const og = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (og?.content) found.push({ url: absolute(og.content), area: Number.MAX_SAFE_INTEGER });
    for (const image of document.images) {
      const src = image.currentSrc || image.src;
      if (!src || src.startsWith('data:') || /loading|spinner|logo|icon|sprite|pixel|blank/i.test(src)) continue;
      const area = (image.naturalWidth || image.width) * (image.naturalHeight || image.height);
      if (area >= 150 * 150) found.push({ url: absolute(src), area });
    }
    const seen = new Set();
    return found.sort((a, b) => b.area - a.area).map((item) => item.url).filter((url) => url && !seen.has(url) && seen.add(url));
  }

  function pageName() {
    const candidates = [
      document.querySelector('.details_animal_header_name')?.innerText,
      document.querySelector('h1')?.innerText,
      document.querySelector('meta[property="og:title"]')?.content,
      document.querySelector('.animal_name, .pet_name, [class*="animal-name"], [class*="animal_name"], [class*="pet-name"]')?.innerText,
      document.title,
    ];
    for (const raw of candidates) {
      const name = (raw || '').replace(/\s*[|–—-]\s*(DeKalb|PetBridge|Adopt|Animal Services).*$/i, '').replace(/\s+/g, ' ').trim();
      if (name && name.length <= 60 && !/^(adopt|adoptable|home|pets?|animals?|search|loading)/i.test(name)) return name;
    }
    return '';
  }

  function description(lines) {
    const panel = document.querySelector('.details_animal_right');
    if (panel) {
      const own = [];
      for (const raw of panel.innerText.split('\n')) {
        const line = raw.trim();
        if (/^how to meet me/i.test(line)) break;
        if (line.length > 40 && !/^[A-Za-z /#.&-]{1,30}:/.test(line)) own.push(line);
      }
      return own.join('\n');
    }
    const sentences = lines.filter((line) => line.length > 80 && /[.!?]/.test(line) && !/cookie|privacy|©|copyright/i.test(line));
    return sentences.sort((a, b) => b.length - a.length)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function paramId() {
    const params = new URLSearchParams(location.search);
    for (const key of ['aid', 'AnimalID', 'animalid', 'animal_id', 'id', 'ID']) if (params.get(key)) return params.get(key);
    return '';
  }

  function extract() {
    const lines = bodyLines();
    const fields = parseFields(lines);
    const images = pageImages();
    const name = pageName();
    const structured = ['species', 'breed', 'sex', 'age', 'color', 'size', 'weight', 'animalId'].filter((key) => fields[key]).length;
    const animalId = fields.animalId || paramId();
    return {
      isAnimalPage: Boolean(name && images.length && structured >= 2),
      animal: {
        name,
        animalId,
        species: fields.species ?? new URLSearchParams(location.search).get('tid') ?? '',
        breed: fields.breed ?? '',
        secondaryBreed: fields.secondaryBreed ?? '',
        sex: fields.sex ?? '',
        age: fields.age ?? '',
        size: fields.size ?? '',
        color: fields.color ?? '',
        weight: fields.weight ?? '',
        spayedNeutered: fields.spayedNeutered ?? '',
        location: fields.location ?? '',
        intakeDate: fields.intakeDate ?? '',
        status: fields.status ?? '',
        description: description(lines),
        imageUrl: images[0] ?? '',
        imageUrls: images.slice(0, 6),
        pageUrl: location.href.split('#')[0],
        savedAt: new Date().toISOString(),
      },
      debug: { structuredFieldCount: structured, fields, imageCount: images.length, firstLines: lines.map((l) => l.trim()).filter(Boolean).slice(0, 60) },
    };
  }

  const load = () => { try { return JSON.parse(GM_getValue(STORE_KEY, '[]')); } catch { return []; } };
  const save = (list) => GM_setValue(STORE_KEY, JSON.stringify(list));
  const keyOf = (animal) => (animal.animalId ? `id:${animal.animalId}` : `url:${animal.pageUrl}`);

  /** Adds the animal unless one with the same ID (or page URL) is already saved. Returns true when added. */
  function remember(animal) {
    const list = load();
    const key = keyOf(animal);
    if (list.some((item) => keyOf(item) === key || item.pageUrl === animal.pageUrl)) return false;
    list.push(animal);
    save(list);
    return true;
  }

  // Panel ----------------------------------------------------------------------------
  let status = 'Open an animal page and it is saved automatically.';
  let renderPanel = () => {};

  function buildPanel() {
    Object.assign(panelHost.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: 2147483647, font: '13px/1.4 system-ui, sans-serif' });
    const root = panelHost.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        .box{background:#fff;color:#1c1917;border:1px solid #57534e;box-shadow:0 2px 10px rgba(0,0,0,.25);width:250px;padding:10px}
        .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
        button{font:inherit;padding:4px 8px;border:1px solid #57534e;background:#f5f5f4;cursor:pointer}
        button.primary{background:#3f5a36;color:#fff;border-color:#3f5a36}
        .muted{color:#57534e;font-size:12px}
        ul{margin:6px 0 0;padding-left:16px;max-height:90px;overflow:auto}
        label{display:flex;align-items:center;gap:6px;margin-top:8px}
        .tab{background:#3f5a36;color:#fff;border:0;padding:6px 10px}
      </style>
      <div id="mini" hidden><button class="tab" id="open"></button></div>
      <div class="box" id="box">
        <strong>Saved animals: <span id="count">0</span></strong>
        <div class="muted" id="status"></div>
        <ul id="recent"></ul>
        <label><input type="checkbox" id="pause"> Pause auto-save</label>
        <div class="row">
          <button class="primary" id="export">Export JSON</button>
          <button id="copy">Copy JSON</button>
          <button id="force">Save this page</button>
          <button id="diag">Diagnostic</button>
          <button id="clear">Clear</button>
          <button id="hide">Hide</button>
        </div>
      </div>`;
    const $ = (id) => root.getElementById(id);
    renderPanel = () => {
      const list = load();
      $('count').textContent = String(list.length);
      $('status').textContent = status;
      $('recent').replaceChildren(...list.slice(-5).reverse().map((animal) => Object.assign(document.createElement('li'), { textContent: `${animal.name}${animal.breed ? ` (${animal.breed})` : ''}` })));
      $('pause').checked = Boolean(GM_getValue(PAUSE_KEY, false));
      $('open').textContent = `Animals: ${list.length}`;
    };
    $('pause').addEventListener('change', (event) => GM_setValue(PAUSE_KEY, event.target.checked));
    $('export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `animals-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    });
    $('copy').addEventListener('click', () => { GM_setClipboard(JSON.stringify(load(), null, 2)); status = 'Copied the JSON to your clipboard.'; renderPanel(); });
    $('force').addEventListener('click', () => {
      const { animal } = extract();
      if (!animal.name) { status = 'No animal name found on this page.'; renderPanel(); return; }
      status = remember(animal) ? `Saved ${animal.name} (manual).` : `${animal.name} was already saved.`;
      renderPanel();
    });
    $('diag').addEventListener('click', () => {
      const { isAnimalPage, animal, debug } = extract();
      GM_setClipboard(JSON.stringify({ url: location.href, isAnimalPage, animal, debug }, null, 2));
      status = 'Copied a diagnostic of this page to your clipboard.';
      renderPanel();
    });
    $('clear').addEventListener('click', () => {
      if (!confirm('Delete every saved animal? Export first if you need them.')) return;
      GM_deleteValue(STORE_KEY);
      status = 'Cleared the saved list.';
      renderPanel();
    });
    $('hide').addEventListener('click', () => { $('box').hidden = true; $('mini').hidden = false; });
    $('open').addEventListener('click', () => { $('box').hidden = false; $('mini').hidden = true; });
    document.documentElement.append(panelHost);
    renderPanel();
    setInterval(renderPanel, 1500); // Frames save to the same storage, so keep the count current.
  }

  // Detection ---------------------------------------------------------------------------
  let lastChecked = '';
  function check() {
    if (GM_getValue(PAUSE_KEY, false) || !document.body) return;
    const signature = `${location.href}|${document.body.innerText.length}`;
    if (signature === lastChecked) return;
    lastChecked = signature;
    const { isAnimalPage, animal } = extract();
    if (!isAnimalPage) { status = 'This does not look like an animal page (use "Save this page" if it is one).'; if (IS_TOP) renderPanel(); return; }
    const added = remember(animal);
    status = added ? `Saved ${animal.name}.` : `${animal.name} was already saved.`;
    if (IS_TOP) renderPanel();
  }

  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(check, 1200); };
  if (IS_TOP) buildPanel();
  new MutationObserver((mutations) => {
    if (panelHost && mutations.every((mutation) => panelHost.contains(mutation.target))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  schedule();

})();
