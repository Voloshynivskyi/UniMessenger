import React from 'react'                   // React core
import ReactDOM from 'react-dom/client'     // React DOM API
import './index.css'                        // global styles
import App from './App'                     // main App component
// import { BrowserRouter } from 'react-router-dom' // router (optional)

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const root = ReactDOM.createRoot(rootElement)
root.render(
  <React.StrictMode>
    {/* wrap with <BrowserRouter> here if using routing */}
    <App />
  </React.StrictMode>
)
