// File: frontend/src/pages/MainMenuPage.tsx
// Main menu page, shows dashboard and navigation cards.

import React from 'react'

export default function MainMenuPage() {
  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <h2 className="text-2xl font-bold mb-4">Welcome to UniMessenger</h2>
      <p className="mb-6 text-gray-600">
        Here you can manage all your messaging platforms in one place.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dashboard card */}
        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Dashboard</h3>
          <p className="text-gray-500">Overview of your accounts and activity</p>
        </div>

        {/* Unified Inbox card */}
        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Unified Inbox</h3>
          <p className="text-gray-500">See all messages at a glance</p>
        </div>

        {/* Compose card */}
        <div className="p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">Compose</h3>
          <p className="text-gray-500">Create a post for multiple channels</p>
        </div>

        {/* та інші… */}
      </div>
    </div>
  )
}
