// Open the keepmarks main page once installed
chrome.runtime.onInstalled.addListener((_reason) => {
  chrome.tabs.create({
    url: 'keepmarks.html',
    index: 0,
    pinned: false
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: 'keepmarks.html',
    index: 0,
    pinned: false
  });
});
