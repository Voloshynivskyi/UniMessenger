// backend/index.js
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')

// Імпорти роутерів для авторизації та збереження сесії
const telegramAuthRoutes = require('./routes/telegramAuth')
const sessionRoutes      = require('./routes/session')

const app = express()
const PORT = process.env.PORT || 7007

// Парсимо JSON перед роутами
app.use(express.json())
// Дозволяємо запити з фронту (порт Vite)
app.use(cors({ origin: 'http://localhost:5173' }))

// Роут для етапу логіну в Telegram
app.use('/auth/telegram', telegramAuthRoutes)
// Роут для збереження отриманого stringSession
app.use('/session', sessionRoutes)

// Простий health–check
app.get('/', (req, res) => {
  res.send('Unified Messenger Backend is running')
})

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`)
})
