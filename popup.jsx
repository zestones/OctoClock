import { render } from 'preact'
import { ChromeStorageAdapter } from './packages/browser-ext/src/adapters/chrome-storage.adapter.js'
import { StorageService } from './src/services/storage.service.js'
import { App } from './src/popup/App.jsx'

// TODO(#14): move to a dedicated browser bootstrap module
StorageService.setAdapter(new ChromeStorageAdapter())

render(<App />, document.getElementById('root'))