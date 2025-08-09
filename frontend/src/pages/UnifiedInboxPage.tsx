import React from 'react';
import UnifiedInbox from '../components/UnifiedInbox';

export default function UnifiedInboxPage() {
  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <h2 className="text-2xl font-bold mb-4">Unified Inbox</h2>
      <p className="mb-6 text-gray-600">
        Here you can see all your recent chats from connected accounts.
      </p>

      {/* Компонент, що підтягує і показує прев’ю чатів */}
      <UnifiedInbox />
    </div>
  );
}
