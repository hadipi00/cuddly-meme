import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './store/AppContext'
import './styles/fonts.css'
import './styles/tw.css'
import './styles/base.css'
import './styles/panel.css'

ReactDOM.createRoot(document.getElementById('root')).render(
 <React.StrictMode>
 <BrowserRouter>
 <AppProvider>
 <App />
 </AppProvider>
 </BrowserRouter>
 </React.StrictMode>
)
