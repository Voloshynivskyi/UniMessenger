// File: frontend/src/layouts/Header.tsx
// Header component, displays app title and logout button.

import { useTelegramAuth } from '../context/TelegramAuthContext'

export default function Header() {
  const { status, signOut } = useTelegramAuth();

  return (
    <header className="w-full h-12 flex items-center px-4 bg-white shadow">
      <h1 className="text-xl font-bold">UniMessenger</h1>
      {status === 'authorized' && (
        <button
          onClick={signOut}
          className="ml-auto px-2 py-1 rounded hover:bg-gray-100"
        >
          Logout
        </button>
      )}
    </header>
  )
}
