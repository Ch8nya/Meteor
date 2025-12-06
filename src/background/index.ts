/**
 * Meteor Background Service Worker
 * 
 * This is intentionally lightweight. Its only job is to:
 * 1. Handle browser action clicks
 * 2. Open the side panel
 * 
 * The heavy AI compute lives in the Side Panel, NOT here.
 * Service workers have strict lifecycle limits - they get terminated.
 * We never want our model to die with the service worker.
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Set side panel behavior - open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Log initialization for debugging
console.log('[Meteor] Background service worker initialized');

