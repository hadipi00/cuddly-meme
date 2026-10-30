import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './store/AppContext'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/fonts.css'
import './styles/tw.css'
import './styles/base.css'
import './styles/panel.css'
import './styles/theme.css'
import { initTextOverrides } from './services/textOverrides'

ReactDOM.createRoot(document.getElementById('root')).render(
 <React.StrictMode>
 <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <ThemeProvider>
 <AppProvider>
 <App />
 </AppProvider>
 </ThemeProvider>
 </BrowserRouter>
 </React.StrictMode>
)

/* ویرایش متون سایت از پنل مدیریت — لایه جایگزینی زنده روی همه صفحات */
initTextOverrides()
