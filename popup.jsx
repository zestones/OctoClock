import { render } from 'preact'
import './src/browser-bootstrap.js'
import { App } from './src/popup/App.jsx'

render(<App />, document.getElementById('root'))