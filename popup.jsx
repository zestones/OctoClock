import { render } from 'preact'
import { ChromeMessagingAdapter } from './packages/browser-ext/src/adapters/chrome-messaging.adapter.js'
import { ChromeStorageAdapter } from './packages/browser-ext/src/adapters/chrome-storage.adapter.js'
import { storageEvents } from './src/services/storage-events.js'
import { StorageService } from './src/services/storage.service.js'
import { TimerService } from './src/services/timer.service.js'
import { App } from './src/popup/App.jsx'

// TODO(#14): move to a dedicated browser bootstrap module
StorageService.setAdapter(new ChromeStorageAdapter(storageEvents))
TimerService.setMessagingPort(new ChromeMessagingAdapter())

render(<App />, document.getElementById('root'))