import React, { useEffect, useState } from 'react';
import { fetchChatPreviews } from '../api/telegramChats';
import type { ChatPreview } from '../api/telegramChats';
import { useTelegramAuth } from '../context/TelegramAuthContext';

const UnifiedInbox: React.FC = () => {
  const { sessionId, authorized, status } = useTelegramAuth();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooManyCounter, setTooManyCounter] = useState(0);

  useEffect(() => {
    if (status !== 'authorized' || !authorized) {
      setError('Будь ласка, увійдіть у Telegram');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);

    // Таймер скидання лічильника раз на 2 сек
    const resetInterval = setInterval(() => {
      setTooManyCounter(0);
    }, 2000);

    const loadChats = () => {
      setLoading(true);
      fetchChatPreviews(sessionId, 30)
        .then(data => {
          if (!cancelled) {
            setChats(data);
            setError(null);
          }
        })
        .catch(err => {
          if (!cancelled) {
            if (err.message.includes('Too many requests')) {
              setTooManyCounter(prev => {
                const next = prev + 1;
                if (next >= 5) {
                  setError('Ви робите запити занадто часто, зачекайте трохи.');
                }
                return next;
              });
            } else {
              setError(err.message);
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    loadChats();
    const interval = setInterval(loadChats, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(resetInterval);
    };
  }, [sessionId, authorized, status]);

  if (loading && chats.length === 0) return <div className="p-4">Завантаження...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4 space-y-2">
      {chats.map(chat => (
        <div
          key={chat.peerId}
          className="flex items-start p-3 bg-white rounded-lg shadow hover:bg-gray-50 cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex justify-between">
              <span className="font-semibold">{chat.title}</span>
              <span className="text-sm text-gray-500">
                {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString() : ''}
              </span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {chat.lastMessageText || (
                <span className="italic text-gray-400">Без повідомлень</span>
              )}
            </div>
          </div>
          {chat.unreadCount > 0 && (
            <div className="ml-2 flex items-center justify-center w-6 h-6 text-white bg-blue-500 rounded-full text-xs">
              {chat.unreadCount}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UnifiedInbox;
