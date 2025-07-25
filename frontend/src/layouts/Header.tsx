import React from 'react'

export default function Header() {
  return (
    <header className="w-full h-12 flex items-center px-4 bg-white shadow">
      <h1 className="text-xl font-bold">UniMessenger</h1>
      <button className="ml-auto px-2 py-1 rounded hover:bg-gray-100">
        Profile
      </button>
    </header>
  )
}
