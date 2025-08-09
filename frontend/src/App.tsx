// src/App.tsx — remove unused React import (new JSX transform handles it)

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './layouts/Header'
import Sidebar from './layouts/Sidebar'
import MainMenuPage      from './pages/MainMenuPage'
// import UnifiedInboxPage  from './pages/UnifiedInboxPage'
// import ChannelsPage      from './pages/ChannelsPage'
// import ComposePage       from './pages/ComposePage'
// import NotificationsPage from './pages/NotificationsPage'
// import AccountsPage      from './pages/AccountsPage'
// import SettingsPage      from './pages/SettingsPage'

import AccountsPage      from './pages/AccountsPage'
import UnifiedInboxPage  from './pages/UnifiedInboxPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col w-screen h-screen">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <Routes>
            <Route path="/"            element={<MainMenuPage />} />
            <Route path="/inbox"       element={<UnifiedInboxPage />} />
            {/* <Route path="/channels"    element={<ChannelsPage />} /> */}
            {/* <Route path="/compose"     element={<ComposePage />} /> */}
            {/* <Route path="/notifications" element={<NotificationsPage />} /> */}
            {/* <Route path="/accounts"    element={<AccountsPage />} /> */}
            {/* <Route path="/settings"    element={<SettingsPage />} /> */}
            
            {/* Додано для Telegram: */}
            <Route path="/accounts"    element={<AccountsPage />} />
            {/* <Route path="/inbox"       element={<UnifiedInboxPage />} /> */}
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
