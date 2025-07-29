// index.js

require('dotenv').config();       // шукає .env поряд із цим файлом

const express = require('express');
const cors = require('cors');
const telegramAuthRoutes = require('./routes/telegramAuth');

const app = express();
const PORT = process.env.PORT || 7007;

app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));

app.use('/auth/telegram', telegramAuthRoutes);

app.get('/', (req, res) => res.send('Backend is running'));

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
