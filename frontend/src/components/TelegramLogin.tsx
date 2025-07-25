// src/components/TelegramLogin.tsx
import React, { useState } from 'react'
import axios from 'axios'

const TelegramLogin: React.FC = () => {
  const [step, setStep] = useState<number>(1)
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [sessionId] = useState<string>(`user-${Date.now()}`)
  const [phoneCodeHash, setPhoneCodeHash] = useState<string>('')
  const [stringSession, setStringSession] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    try {
      setError(null)
      const res = await axios.post<{ phoneCodeHash: string }>(
        'http://localhost:7007/auth/telegram/start',
        { phoneNumber, sessionId }
      )
      setPhoneCodeHash(res.data.phoneCodeHash)
      setStep(2)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
  }

  const handleVerify = async () => {
    try {
      setError(null)
      const res = await axios.post<{ stringSession: string }>(
        'http://localhost:7007/auth/telegram/verify',
        { phoneNumber, code, phoneCodeHash, sessionId }
      )
      setStringSession(res.data.stringSession)
      setStep(4)
    } catch (err: any) {
      if (err.response?.data?.error === '2FA_REQUIRED') {
        setStep(3)
      } else {
        setError(err.response?.data?.error || err.message)
      }
    }
  }

  const handle2FA = async () => {
    try {
      setError(null)
      const res = await axios.post<{ stringSession: string }>(
        'http://localhost:7007/auth/telegram/2fa',
        { password, sessionId }
      )
      setStringSession(res.data.stringSession)
      setStep(4)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded shadow mt-10">
      <h2 className="text-xl font-bold mb-4">🔐 Telegram Login</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}

      {step === 1 && (
        <>
          <label className="block mb-1">📱 Phone Number (+380...)</label>
          <input
            className="border px-2 py-1 w-full mb-2"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded"
            onClick={handleStart}
          >
            Send Code
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <label className="block mb-1">📨 Code from Telegram</label>
          <input
            className="border px-2 py-1 w-full mb-2"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded"
            onClick={handleVerify}
          >
            Verify
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <label className="block mb-1">🔐 2FA Password</label>
          <input
            className="border px-2 py-1 w-full mb-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded"
            onClick={handle2FA}
          >
            Submit
          </button>
        </>
      )}

      {step === 4 && (
        <>
          <p className="text-green-600 font-semibold">✅ Authorized!</p>
          <label className="block mt-2 mb-1">🗝 stringSession:</label>
          <textarea
            className="border p-2 w-full text-xs"
            rows={6}
            readOnly
            value={stringSession}
          />
          <p className="text-sm text-gray-600 mt-2">
            Збережи цей session — він дозволить бекенду отримувати твої повідомлення.
          </p>
        </>
      )}
    </div>
  )
}

export default TelegramLogin
