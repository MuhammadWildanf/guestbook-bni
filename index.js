const cors = require('cors')
const express = require('express');
require('dotenv').config();
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const fs = require('fs');
const fetch = require('node-fetch');
const badWordsPath = path.join(__dirname, 'data.json');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Kirim notifikasi info ke Telegram — tanpa tombol approve/reject
async function sendTelegramNotif(name, comment) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const text =
    `💬 *Komentar Baru Masuk*\n\n` +
    `👤 *Nama:* ${name}\n` +
    `📝 *Komentar:* ${comment}\n\n` +
    `_Komentar sudah tampil di wall._`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('Gagal kirim notifikasi Telegram:', err);
  }
}

const leetMap = {
  'a': '[a4@]',
  's': '[s5$]',
  'i': '[i1!]',
  'o': '[o0]',
  'e': '[e3]',
  't': '[t7]',
  'g': '[g9]',
  'c': '[cC]',
  'b': '[bB]',
  'd': '[dD]',
  'f': '[fF]',
  'h': '[hH]',
  'j': '[jJ]',
  'k': '[kK]',
  'l': '[lL1]',
  'm': '[mM]',
  'n': '[nN]',
  'p': '[pP]',
  'r': '[rR]',
  'u': '[uU]',
  'v': '[vV]',
  'w': '[wW]',
  'x': '[xX]',
  'y': '[yY]',
  'z': '[zZ]'
};

function censorBadWords(text, badwords) {
  if (!text) return text;
  let censoredText = text;

  // Sort badwords from longest to shortest to avoid substring collision (e.g. "anjinggg" before "anjing")
  const sortedBadwords = [...badwords].sort((a, b) => b.length - a.length);

  for (const word of sortedBadwords) {
    if (!word) continue;

    const patternParts = [];
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const map = leetMap[char] || char;
      patternParts.push(`${map}+`);
    }
    let patternStr = patternParts.join('[^a-zA-Z0-9]*');

    // Enforce word boundaries for short words (length <= 4) to avoid false positives (e.g. "tai" in "pantai")
    if (word.length <= 4) {
      patternStr = `(?<=^|[^a-zA-Z0-9])${patternStr}(?=$|[^a-zA-Z0-9])`;
    }

    const regex = new RegExp(patternStr, 'gi');
    censoredText = censoredText.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  return censoredText;
}

// Deteksi apakah teks mengandung kata terlarang (tanpa mengubah teks)
function detectBadWords(text, badwords) {
  if (!text) return false;

  const sortedBadwords = [...badwords].sort((a, b) => b.length - a.length);

  for (const word of sortedBadwords) {
    if (!word) continue;

    const patternParts = [];
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase();
      const map = leetMap[char] || char;
      patternParts.push(`${map}+`);
    }
    let patternStr = patternParts.join('[^a-zA-Z0-9]*');

    if (word.length <= 4) {
      patternStr = `(?<=^|[^a-zA-Z0-9])${patternStr}(?=$|[^a-zA-Z0-9])`;
    }

    const regex = new RegExp(patternStr, 'gi');
    if (regex.test(text)) return true;
  }

  return false;
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running in port:${PORT}`);
});

admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://guestbook-bni-default-rtdb.asia-southeast1.firebasedatabase.app'
});

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.use(express.json())

app.use(bodyParser.json());

app.use(cors({ origin: true }));


app.post('/submit-form', async (req, res) => {
  try {
    const db = admin.database()
    let { name, char, comment } = req.body;

    // Server-side bad word detection — REJECT jika ada kata terlarang
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      if (detectBadWords(name, badwords) || detectBadWords(comment, badwords)) {
        return res.status(400).json({ error: 'BADWORD', message: 'Komentar mengandung kata yang tidak diperbolehkan.' });
      }
    } catch (err) {
      console.error('Error during server-side bad word check:', err);
    }

    const timestamp = admin.database.ServerValue.TIMESTAMP;
    const ref = db.ref('testguest');
    // Langsung simpan — tidak perlu approval
    const newRef = await ref.push({ name, char, comment, timestamp });
    const newKey = newRef.key;

    // Kirim notifikasi info ke Telegram
    sendTelegramNotif(name, comment); // fire-and-forget, tidak perlu await

    res.status(200).json({ key: newKey, name, char });
  } catch (error) {
    console.error('Error submitting data:', error);
    res.status(500).send('Error submitting data');
  }
});

app.post('/update-form', async (req, res) => {
  try {
    const db = admin.database()
    let { key, name, char, comment } = req.body;

    // Server-side bad word detection — REJECT jika ada kata terlarang
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      if (detectBadWords(name, badwords) || detectBadWords(comment, badwords)) {
        return res.status(400).json({ error: 'BADWORD', message: 'Komentar mengandung kata yang tidak diperbolehkan.' });
      }
    } catch (err) {
      console.error('Error during server-side bad word check:', err);
    }

    const ref = db.ref(`/testguest/${key}`);
    const timestamp = admin.database.ServerValue.TIMESTAMP;
    await ref.update({ name, char, comment, timestamp });
    res.status(200).json({ msg: "Data Updated Successfully" });

  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).send('Error updating data');
  }
});


app.get('/manage-badwords', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'badwords.html'));
});

app.get('/badwords', (req, res) => {
  try {
    const data = fs.readFileSync(badWordsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Gagal membaca data kata terlarang' });
  }
});

// ADD new bad word
app.post('/badwords', (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Kata tidak boleh kosong' });

  try {
    let data = JSON.parse(fs.readFileSync(badWordsPath));
    const lowerWord = word.toLowerCase();

    if (!data.includes(lowerWord)) {
      data.push(lowerWord);
      fs.writeFileSync(badWordsPath, JSON.stringify(data, null, 2));
    }

    res.json({ success: true, word: lowerWord });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah kata terlarang' });
  }
});

// DELETE bad word
app.delete('/badwords/:word', (req, res) => {
  const wordToDelete = req.params.word.toLowerCase();

  try {
    let data = JSON.parse(fs.readFileSync(badWordsPath));
    const filtered = data.filter(w => w !== wordToDelete);
    fs.writeFileSync(badWordsPath, JSON.stringify(filtered, null, 2));

    res.json({ success: true, deleted: wordToDelete });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kata terlarang' });
  }
});

app.put('/badwords/:oldWord', (req, res) => {
  const oldWord = req.params.oldWord.toLowerCase();
  const { newWord } = req.body;

  if (!newWord) {
    return res.status(400).json({ error: 'Kata baru tidak boleh kosong' });
  }

  try {
    let data = JSON.parse(fs.readFileSync(badWordsPath));
    const index = data.findIndex(w => w === oldWord);

    if (index === -1) {
      return res.status(404).json({ error: 'Kata lama tidak ditemukan' });
    }

    data[index] = newWord.toLowerCase();
    fs.writeFileSync(badWordsPath, JSON.stringify(data, null, 2));

    res.json({ success: true, oldWord, newWord: newWord.toLowerCase() });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate kata terlarang' });
  }
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dashboard.html"));
});

// DEBUG sementara — cek env vars Telegram (hapus setelah selesai)
app.get("/debug-telegram", async (req, res) => {
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasChatId = !!process.env.TELEGRAM_CHAT_ID;
  // Coba kirim pesan test
  let sendResult = null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: '🔧 Debug test dari Vercel — env vars terbaca!' })
    });
    sendResult = await r.json();
  } catch (e) {
    sendResult = { error: e.message };
  }
  res.json({ hasToken, hasChatId, sendResult });
});

// Ambil semua data (untuk wall publik)
app.get("/entries", async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref("testguest");
    const snapshot = await ref.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ambil data by key
app.get("/entries/:key", async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref(`testguest/${req.params.key}`);
    const snapshot = await ref.once("value");
    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/entries/:key", async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref(`testguest/${req.params.key}`);
    let { name, char, comment } = req.body;

    // Reject jika ada kata terlarang pada edit
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      if (detectBadWords(name, badwords) || detectBadWords(comment, badwords)) {
        return res.status(400).json({ error: 'BADWORD', message: 'Komentar mengandung kata yang tidak diperbolehkan.' });
      }
    } catch (err) {
      console.error('Error during bad word check in edit:', err);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (comment !== undefined) updateData.comment = comment;
    if (char !== undefined) updateData.char = char;
    updateData.timestamp = admin.database.ServerValue.TIMESTAMP;

    await ref.update(updateData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete("/entries/:key", async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref(`testguest/${req.params.key}`);
    await ref.remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/entries-all", async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref("testguest");
    await ref.remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seeder data dummy untuk guestbook (BNI)
app.get('/seed-random', async (req, res) => {
  try {
    const db = admin.database();
    const ref = db.ref('testguest');

    const names = [
      'Wildan', 'Budi', 'Rina', 'Andi', 'Dewi', 'Sinta', 'Hadi', 'Adit', 'Mega', 'Tono',
      'Fajar', 'Rizky', 'Amalia', 'Daffa', 'Sarah', 'Kevin', 'Fitri', 'Aditya', 'Indah', 'Yusuf',
      'Bagas', 'Anisa', 'Hendra', 'Putri', 'Ari', 'Dian', 'Satria', 'Bella', 'Gilang', 'Gita',
      'Bayu', 'Nanda', 'Taufik', 'Citra', 'Rama', 'Lestari', 'Doni', 'Kartika', 'Eko', 'Sri',
      'Farhan', 'Nabila', 'Rian', 'Lia', 'Rudi', 'Dimas', 'Tari', 'Agus', 'Wati', 'Reza',
      'Maya', 'Denny', 'Sari', 'Arif', 'Evi', 'Faisal', 'Ratih', 'Dani', 'Desi', 'Irfan',
      'Yuni', 'Rio', 'Ratna', 'Guntur', 'Wulan', 'Bobby', 'Melati', 'Dicky', 'Sandra'
    ];

    const comments = [
      'Mantap BNI WondrX!',
      'Event-nya seru banget dan interaktif!',
      'Maju terus BNI!',
      'Aplikasi WondrX keren banget fiturnya 👍',
      'Senang bisa hadir di acara ini.',
      'Sangat informatif dan seru!',
      'Moga makin sukses ke depannya!',
      'Vibes acaranya luar biasa!',
      'Tampilan wondr by BNI fresh banget, suka layout-nya!',
      'Fitur Insight ngebantu banget buat tracking pengeluaran harian.',
      'Gak nyangka dapet merchandise keren dari BNI. Thank you!',
      'Semoga wondr by BNI jadi superapp nomor satu!',
      'Seru banget main game interaktif di booth BNI.',
      'Mudah-mudahan BNI terus berinovasi tiada henti!',
      'Fitur Growth bikin investasi jadi makin gampang & praktis.',
      'Transaksi pake wondr cepet banget, gak pake lemot.',
      'Datang ke event ini dapet banyak ilmu keuangan baru.',
      'Sukses terus untuk peluncuran wondr by BNI!',
      'Booth-nya estetik parah, instagramable banget!',
      'Staf BNI ramah-ramah dan penjelasannya clear banget.',
      'WondrX emang beneran bikin hidup lebih simple!',
      'Keren bgt visualisasi 3 dimensi keuangan.',
      'Suka banget sama promo-promo merchant wondr by BNI!',
      'Gak sabar nunggu inovasi seru berikutnya dari BNI.',
      'Makin bangga jadi nasabah setia BNI!',
      'UI/UX wondr by BNI juara sih, clean dan responsif.',
      'Cara seru buat belajar financial planning ya di event ini.',
      'Terima kasih BNI atas event yang spektakuler ini!',
      'Sangat termotivasi buat mulai investasi setelah denger sesinya.',
      'Wondr by BNI recommended banget buat generasi muda!',
      'Transaksi makin praktis dan aman pake wondr.',
      'Fitur-fiturnya lengkap bgt, ngebantu kelola keuangan bulanan.',
      'Acara BNI WondrX serunya ga abis-abis!',
      'Gak nyesel dateng jauh-jauh ke event ini.',
      'Seru, dapet banyak promo menarik pas bikin rekening BNI!',
      'Wondr by BNI emang best deal bgt buat anak muda.',
      'Banyak aktivitas menarik di booth BNI hari ini.',
      'Semoga BNI terus menginspirasi masyarakat Indonesia!',
      'Event ter-kece tahun ini, BNI emang keren!',
      'Teknologinya makin canggih, transaksi cashless jadi makin nyaman.'
    ];

    const total = parseInt(req.query.total) || 20;
    const batch = [];

    for (let i = 0; i < total; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      const comment = comments[Math.floor(Math.random() * comments.length)];
      const char = Math.floor(Math.random() * 8) + 1; // 1-8

      const newData = {
        name,
        comment,
        char,
        timestamp: Date.now() - Math.floor(Math.random() * 3600000) // random time in last hour
      };

      batch.push(ref.push(newData));
    }

    await Promise.all(batch);
    res.json({ success: true, message: `${total} data dummy berhasil ditambahkan!` });
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    res.status(500).json({ error: error.message });
  }
});

