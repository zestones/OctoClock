// src/browser-bootstrap.js
//
// Registers all Chrome adapter implementations on the shared services.
// Must be imported before any service method is called in a browser context.
//
// Each of the three extension contexts (background, popup, content script)
// imports this module as its first side-effect import.
//
// TODO(#15): relocate to packages/browser-ext/bootstrap.js — services now live in packages/core.

import { ChromeMessagingAdapter } from '../packages/browser-ext/src/adapters/chrome-messaging.adapter.js';
import { ChromeStorageAdapter } from '../packages/browser-ext/src/adapters/chrome-storage.adapter.js';
import { StorageService } from '../packages/core/src/services/storage.service.js';
import { storageEvents } from '../packages/core/src/services/storage-events.js';
import { TimerService } from '../packages/core/src/services/timer.service.js';

StorageService.setAdapter(new ChromeStorageAdapter(storageEvents));
TimerService.setMessagingPort(new ChromeMessagingAdapter());
