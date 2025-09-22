const FLAG_TYPES = {
  pirate: 'flags/pirate.png',
  neutral: 'flags/neutral-flag.png',
  blue: 'flags/blue-flag.png',
};

const DEFAULT_FLAG = 'neutral';
const MARK = 'flagSwapped';

function getCurrentFlagUrl() {
  return chrome.runtime.getURL(FLAG_TYPES[DEFAULT_FLAG]);
}

async function updateFlagUrl() {
  try {
    const result = await chrome.storage.sync.get(['selectedFlag']);
    const selectedFlag = result.selectedFlag || DEFAULT_FLAG;
    const flagUrl = chrome.runtime.getURL(FLAG_TYPES[selectedFlag]);

    const style = document.querySelector('#flag-style');
    if (style) {
      style.textContent = `:root{--replacement-flag: url("${flagUrl}") !important;}`;
    }

    return flagUrl;
  } catch (error) {
    console.error('Error loading flag preference:', error);
    return getCurrentFlagUrl();
  }
}

(function injectCSSVar() {
  const style = document.createElement('style');
  style.id = 'flag-style';
  style.textContent = `:root{--replacement-flag: url("${getCurrentFlagUrl()}") !important;}`;
  document.documentElement.appendChild(style);

  updateFlagUrl();
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

async function swapImg(img) {
  if (img.dataset[MARK]) return;
  img.dataset[MARK] = '1';

  const cs = getComputedStyle(img);
  const w = parseInt(cs.width) || img.width || img.naturalWidth || 18;
  const h = parseInt(cs.height) || img.height || img.naturalHeight || 12;
  const smallFlag = w <= 24 && h <= 16;

  const flagUrl = await updateFlagUrl();
  img.src = flagUrl;
  img.removeAttribute('srcset');
  img.removeAttribute('data-src');

  if (smallFlag) {
    img.style.width = '18px';
    img.style.height = '12px';
  } else {
    img.style.width = w + 'px';
    img.style.height = h + 'px';
  }

  img.alt = 'Replacement flag';
  img.title = 'Replacement flag';
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

async function swapBackground(el) {
  if (el.dataset[MARK]) return;
  el.dataset[MARK] = '1';

  const flagUrl = await updateFlagUrl();

  el.style.setProperty('width', '18px', 'important');
  el.style.setProperty('height', '12px', 'important');
  el.style.setProperty('background-image', `url("${flagUrl}")`, 'important');
  el.style.setProperty('background-position', 'center', 'important');
  el.style.setProperty('background-repeat', 'no-repeat', 'important');
  el.style.setProperty('background-size', '18px 12px', 'important');
  el.style.display = 'inline-block';
}

async function processNode(node) {
  if (!(node instanceof Element)) return;

  if (node.tagName === 'IMG') {
    if (isRussiaImg(node)) await swapImg(node);
  } else if (looksLikeRussiaFlagElement(node)) {
    await swapBackground(node);
  }

  const imgPromises = Array.from(node.querySelectorAll('img')).map(
    async (img) => {
      if (isRussiaImg(img)) await swapImg(img);
    }
  );
  await Promise.all(imgPromises);

  const backgroundPromises = Array.from(
    node.querySelectorAll(
      '[class*="flag"], [data-country], [data-nation], [aria-label], [title]'
    )
  ).map(async (el) => {
    if (looksLikeRussiaFlagElement(el)) await swapBackground(el);
  });
  await Promise.all(backgroundPromises);
}

(function start() {
  const kick = async () => await processNode(document.documentElement);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick, { once: true });
  } else {
    kick();
  }

  const observer = new MutationObserver(async (muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        const promises = Array.from(m.addedNodes).map(processNode);
        await Promise.all(promises);
      } else if (m.type === 'attributes' && m.target instanceof Element) {
        await processNode(m.target);
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateFlag') {
      document.querySelectorAll(`[data-${MARK}]`).forEach((el) => {
        delete el.dataset[MARK];
      });

      updateFlagUrl().then(() => {
        processNode(document.documentElement);
      });

      sendResponse({ success: true });
    }
  });
})();
