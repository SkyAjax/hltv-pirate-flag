// Pirate flag data URL (same SVG as in styles.css)
const PIRATE_FLAG_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="#000"/>
  <g fill="#fff">
    <circle cx="320" cy="200" r="80"/>
    <circle cx="290" cy="185" r="12"/><circle cx="350" cy="185" r="12"/>
    <rect x="290" y="220" width="60" height="18" rx="9"/>
    <g transform="translate(320,350) rotate(25)">
      <rect x="-200" y="-12" width="400" height="24" rx="12"/>
    </g>
    <g transform="translate(320,350) rotate(-25)">
      <rect x="-200" y="-12" width="400" height="24" rx="12"/>
    </g>
  </g>
</svg>`);

const MARK = 'pirateFlagSwapped';

const RUSSIA_PATTERNS = {
  textish: /\b(russia|руссия|rus)\b/i,
  src: [/\/ru(\.|\/)/i, /russia/i, /\/flags?\//i],
};

// Is this <img> clearly a Russia flag?
function isRussiaImg(img) {
  const alt = img.getAttribute('alt') || '';
  const title = img.getAttribute('title') || '';
  const aria = img.getAttribute('aria-label') || '';
  const src = img.getAttribute('src') || '';
  const srcset = img.getAttribute('srcset') || '';
  const dataSrc = img.getAttribute('data-src') || '';

  if (RUSSIA_PATTERNS.textish.test(alt)) return true;
  if (RUSSIA_PATTERNS.textish.test(title)) return true;
  if (RUSSIA_PATTERNS.textish.test(aria)) return true;

  if (RUSSIA_PATTERNS.src.some((rx) => rx.test(src) && /ru|russia/i.test(src)))
    return true;
  if (
    RUSSIA_PATTERNS.src.some(
      (rx) => rx.test(srcset) && /ru|russia/i.test(srcset)
    )
  )
    return true;
  if (
    RUSSIA_PATTERNS.src.some(
      (rx) => rx.test(dataSrc) && /ru|russia/i.test(dataSrc)
    )
  )
    return true;

  // Heuristic: image sits inside a node that says "Russia"
  const containerText =
    (img.closest('[title],[aria-label]')?.getAttribute('title') || '') +
    ' ' +
    (img.closest('[title],[aria-label]')?.getAttribute('aria-label') || '');
  if (RUSSIA_PATTERNS.textish.test(containerText)) return true;

  return false;
}

function swapImg(img) {
  if (img.dataset[MARK]) return;
  img.dataset[MARK] = '1';

  // Preserve rendered size to avoid layout shift
  const cs = getComputedStyle(img);
  const w = img.width || img.naturalWidth || parseInt(cs.width) || 16;
  const h = img.height || img.naturalHeight || parseInt(cs.height) || 11;

  img.src = PIRATE_FLAG_DATA_URL;
  img.removeAttribute('srcset');
  img.removeAttribute('data-src');
  img.style.width = w ? `${w}px` : '';
  img.style.height = h ? `${h}px` : '';
  img.alt = 'Pirate flag';
  img.title = 'Pirate flag';
}

function looksLikeRussiaFlagElement(el) {
  if (!(el instanceof Element)) return false;
  if (el.tagName === 'IMG') return isRussiaImg(el);

  const cls = el.className || '';
  const title = el.getAttribute('title') || '';
  const aria = el.getAttribute('aria-label') || '';
  const country =
    el.getAttribute('data-country') || el.getAttribute('data-nation') || '';

  if (/\b(flag-?ru|country-?ru|flag\s+ru|ru-flag)\b/i.test(cls)) return true;
  if (/^ru$/i.test(country)) return true;
  if (RUSSIA_PATTERNS.textish.test(title) || RUSSIA_PATTERNS.textish.test(aria))
    return true;

  // Background/sprite heuristic: node that has a "flag" class and is near text "Russia"
  if (/\bflag\b/i.test(cls)) {
    const nearText =
      (el.closest('[title],[aria-label]')?.getAttribute('title') || '') +
      ' ' +
      (el.closest('[title],[aria-label]')?.getAttribute('aria-label') || '') +
      ' ' +
      (el.parentElement?.textContent || '');
    if (RUSSIA_PATTERNS.textish.test(nearText)) return true;
  }

  return false;
}

function swapBackground(el) {
  if (el.dataset[MARK]) return;
  el.dataset[MARK] = '1';

  const cs = getComputedStyle(el);
  const w = parseInt(cs.width) || 16;
  const h = parseInt(cs.height) || 11;

  if (!w || !h) {
    el.style.display = 'inline-block';
    el.style.width = (w || 16) + 'px';
    el.style.height = (h || 11) + 'px';
  }

  el.style.setProperty(
    'background-image',
    `url("${PIRATE_FLAG_DATA_URL}")`,
    'important'
  );
  el.style.setProperty('background-position', 'center', 'important');
  el.style.setProperty('background-repeat', 'no-repeat', 'important');
  el.style.setProperty('background-size', 'contain', 'important');

  // If the flag was on a pseudo-element, the CSS we inject handles it.
}

function processNode(node) {
  if (!(node instanceof Element)) return;

  // Node itself
  if (node.tagName === 'IMG') {
    if (isRussiaImg(node)) swapImg(node);
  } else if (looksLikeRussiaFlagElement(node)) {
    swapBackground(node);
  }

  // Descendants
  node.querySelectorAll('img').forEach((img) => {
    if (isRussiaImg(img)) swapImg(img);
  });

  node
    .querySelectorAll(
      '[class*="flag"], [data-country], [data-nation], [aria-label], [title]'
    )
    .forEach((el) => {
      if (looksLikeRussiaFlagElement(el)) swapBackground(el);
    });
}

function start() {
  // Initial sweep (document_start means DOM may still be building)
  const kick = () => processNode(document.documentElement);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick, { once: true });
  } else {
    kick();
  }

  // Observe dynamic changes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) processNode(n);
      } else if (m.type === 'attributes' && m.target instanceof Element) {
        processNode(m.target);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class',
      'src',
      'srcset',
      'title',
      'aria-label',
      'style',
      'data-country',
      'data-nation',
    ],
  });

  // Safety net: periodic rescan for tricky lazy-loaders
  let rescans = 0;
  const int = setInterval(() => {
    rescans += 1;
    processNode(document.documentElement);
    if (rescans > 30) clearInterval(int); // stop after ~30s
  }, 1000);
}

start();
