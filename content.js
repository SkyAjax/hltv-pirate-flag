// Resolve packaged image for CSS & <img> swaps
const PIRATE_URL = chrome.runtime.getURL('pirate.png');
const MARK = 'pirateFlagSwapped';

(function injectCSSVar() {
  const style = document.createElement('style');
  style.textContent = `:root{--pirate-flag: url("${PIRATE_URL}") !important;}`;
  document.documentElement.appendChild(style);
})();

const RUSSIA_PATTERNS = {
  textish: /\b(russia|руссия|rus)\b/i,
  src: [/\/ru(\.|\/)/i, /russia/i, /\/flags?\//i],
};

function isRussiaImg(img) {
  const alt = img.getAttribute('alt') || '';
  const title = img.getAttribute('title') || '';
  const aria = img.getAttribute('aria-label') || '';
  const src = img.getAttribute('src') || '';
  const srcset = img.getAttribute('srcset') || '';
  const dataSrc = img.getAttribute('data-src') || '';

  if ([alt, title, aria].some((t) => RUSSIA_PATTERNS.textish.test(t)))
    return true;
  if (
    [src, srcset, dataSrc].some((s) =>
      RUSSIA_PATTERNS.src.some((rx) => rx.test(s) && /ru|russia/i.test(s))
    )
  )
    return true;
  return false;
}

function swapImg(img) {
  if (img.dataset[MARK]) return;
  img.dataset[MARK] = '1';

  // If it looks like a standard small flag, force 18x12. Otherwise, preserve size.
  const cs = getComputedStyle(img);
  const w = parseInt(cs.width) || img.width || img.naturalWidth || 18;
  const h = parseInt(cs.height) || img.height || img.naturalHeight || 12;
  const smallFlag = w <= 24 && h <= 16;

  img.src = PIRATE_URL;
  img.removeAttribute('srcset');
  img.removeAttribute('data-src');

  if (smallFlag) {
    img.style.width = '18px';
    img.style.height = '12px';
  } else {
    img.style.width = w + 'px';
    img.style.height = h + 'px';
  }

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
  return false;
}

function swapBackground(el) {
  if (el.dataset[MARK]) return;
  el.dataset[MARK] = '1';

  // Size to exact 18x12 in case container had sprite sizing
  el.style.setProperty('width', '18px', 'important');
  el.style.setProperty('height', '12px', 'important');
  el.style.setProperty('background-image', `url("${PIRATE_URL}")`, 'important');
  el.style.setProperty('background-position', 'center', 'important');
  el.style.setProperty('background-repeat', 'no-repeat', 'important');
  el.style.setProperty('background-size', '18px 12px', 'important');
  el.style.display = 'inline-block';
}

function processNode(node) {
  if (!(node instanceof Element)) return;

  if (node.tagName === 'IMG') {
    if (isRussiaImg(node)) swapImg(node);
  } else if (looksLikeRussiaFlagElement(node)) {
    swapBackground(node);
  }

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

(function start() {
  const kick = () => processNode(document.documentElement);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick, { once: true });
  } else {
    kick();
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(processNode);
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
})();
