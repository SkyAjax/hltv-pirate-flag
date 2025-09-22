const DEFAULT_FLAG = 'neutral';

async function loadSavedPreference() {
  try {
    const result = await chrome.storage.sync.get(['selectedFlag']);
    const selectedFlag = result.selectedFlag || DEFAULT_FLAG;

    document.querySelectorAll('.flag-option').forEach((option) => {
      option.classList.remove('selected');
      if (option.dataset.flag === selectedFlag) {
        option.classList.add('selected');
      }
    });
  } catch (error) {
    console.error('Error loading saved preference:', error);
    document.querySelector('[data-flag="pirate"]').classList.add('selected');
  }
}

async function saveFlagPreference(flagType) {
  try {
    await chrome.storage.sync.set({ selectedFlag: flagType });
    console.log('Flag preference saved:', flagType);
  } catch (error) {
    console.error('Error saving preference:', error);
  }
}

function handleFlagSelection(event) {
  const flagOption = event.currentTarget;
  const selectedFlag = flagOption.dataset.flag;

  document.querySelectorAll('.flag-option').forEach((option) => {
    option.classList.remove('selected');
  });
  flagOption.classList.add('selected');

  saveFlagPreference(selectedFlag);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes('hltv.org')) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateFlag',
        flagType: selectedFlag,
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSavedPreference();

  document.querySelectorAll('.flag-option').forEach((option) => {
    option.addEventListener('click', handleFlagSelection);
  });
});
