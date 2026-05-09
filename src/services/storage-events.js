import { StorageEventsPort } from '../../packages/core/src/ports/storage-events.port.js';

/**
 * Process-scoped singleton StorageEventsPort.
 *
 * Each browser extension context (popup, background, content script) gets its
 * own instance because they run in separate JS processes. The ChromeStorageAdapter
 * feeds this singleton: local mutations are emitted immediately, and cross-context
 * changes from other extension processes are bridged via chrome.storage.onChanged.
 */
export const storageEvents = new StorageEventsPort();
