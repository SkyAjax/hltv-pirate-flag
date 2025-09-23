const FLAG_TYPES = {
  pirate: 'flags/pirate.png',
  neutral: 'flags/neutral-flag.png',
  blue: 'flags/blue-flag.png',
};

const DEFAULT_FLAG = 'neutral';
const MARK = 'flagSwapped';

// Players/coaches who should always get white flag
const WHITE_FLAG_EXCLUSIONS = [
  '22458/maddened', // coach
  '14055/propleh', // player
  '20430/alpha', // player
  '25412/pradiggg', // coach
  '16324/iksou', // coach
  '8660/sl4m', // player
  '7402/lk', // player
];

function getCurrentFlagUrl() {
  return chrome.runtime.getURL(FLAG_TYPES[DEFAULT_FLAG]);
}

function shouldUseWhiteFlag(element = null) {
  // Check current page URL first
  const currentUrl = window.location.href;
  if (
    WHITE_FLAG_EXCLUSIONS.some((exclusion) => currentUrl.includes(exclusion))
  ) {
    return true;
  }

  // If element is provided, check its context for player/coach links
  if (element) {
    // Look for player/coach links in the element's context
    const playerLink =
      element.closest('a[href*="/player/"]') ||
      element.closest('a[href*="/coach/"]') ||
      element.querySelector('a[href*="/player/"]') ||
      element.querySelector('a[href*="/coach/"]');

    if (playerLink) {
      const href = playerLink.getAttribute('href');
      return WHITE_FLAG_EXCLUSIONS.some((exclusion) =>
        href.includes(exclusion)
      );
    }

    // Check if the element itself is a player/coach link
    if (element.tagName === 'A') {
      const href = element.getAttribute('href');
      if (href && (href.includes('/player/') || href.includes('/coach/'))) {
        return WHITE_FLAG_EXCLUSIONS.some((exclusion) =>
          href.includes(exclusion)
        );
      }
    }

    // Check for sibling player/coach links (common pattern in news blocks)
    // Only apply white flag if THIS specific flag is associated with an excluded player
    const parent = element.parentElement;
    if (parent) {
      // Look for the next sibling link after this flag
      let nextSibling = element.nextSibling;
      while (nextSibling) {
        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
          if (nextSibling.tagName === 'A') {
            const href = nextSibling.getAttribute('href');
            if (
              href &&
              (href.includes('/player/') || href.includes('/coach/'))
            ) {
              return WHITE_FLAG_EXCLUSIONS.some((exclusion) =>
                href.includes(exclusion)
              );
            }
          }
          // If we hit a text node or other element, check if it contains links
          const links = nextSibling.querySelectorAll(
            'a[href*="/player/"], a[href*="/coach/"]'
          );
          if (links.length > 0) {
            const href = links[0].getAttribute('href');
            return WHITE_FLAG_EXCLUSIONS.some((exclusion) =>
              href.includes(exclusion)
            );
          }
        }
        nextSibling = nextSibling.nextSibling;
      }
    }
  }

  return false;
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
  const isMatchPageTeamFlag =
    (img.classList.contains('team1') || img.classList.contains('team2')) &&
    !!img.closest('.standard-box.teamsBox');
  const smallFlag = w <= 24 && h <= 16;

  // Check if this specific flag should use white flag
  const useWhiteFlag = shouldUseWhiteFlag(img);
  const flagUrl = useWhiteFlag
    ? chrome.runtime.getURL(FLAG_TYPES[DEFAULT_FLAG])
    : await updateFlagUrl();
  img.src = flagUrl;
  img.removeAttribute('srcset');
  img.removeAttribute('data-src');

  if (isMatchPageTeamFlag) {
    img.style.width = '300px';
    img.style.height = '200px';
  } else if (smallFlag) {
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

  // Check if this specific flag should use white flag
  const useWhiteFlag = shouldUseWhiteFlag(el);
  const flagUrl = useWhiteFlag
    ? chrome.runtime.getURL(FLAG_TYPES[DEFAULT_FLAG])
    : await updateFlagUrl();

  const isMatchPageTeamFlag =
    (el.classList.contains('team1') || el.classList.contains('team2')) &&
    !!el.closest('.standard-box.teamsBox');
  const widthPx = isMatchPageTeamFlag ? '30px' : '18px';
  const heightPx = isMatchPageTeamFlag ? '20px' : '12px';

  el.style.setProperty('width', widthPx, 'important');
  el.style.setProperty('height', heightPx, 'important');
  el.style.setProperty('background-image', `url("${flagUrl}")`, 'important');
  el.style.setProperty('background-position', 'center', 'important');
  el.style.setProperty('background-repeat', 'no-repeat', 'important');
  el.style.setProperty(
    'background-size',
    `${widthPx} ${heightPx}`,
    'important'
  );
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
