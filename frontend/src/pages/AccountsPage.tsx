import React from 'react'
import TelegramLogin from '../components/TelegramLogin'

const AccountsPage: React.FC = () => {
  return (
    <div className="p-6 w-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">🔐 Telegram Account Login</h1>
      <TelegramLogin />
    </div>
  )
}

export default AccountsPage
