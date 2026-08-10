const cors = require('cors')
const express = require('express');
require('dotenv').config();
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const fs = require('fs');
const badWordsPath = path.join(__dirname, 'data.json');

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
  databaseURL: 'https://infocomm-bangkok-default-rtdb.asia-southeast1.firebasedatabase.app'
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

    // Server-side censorship
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      name = censorBadWords(name, badwords);
      comment = censorBadWords(comment, badwords);
    } catch (err) {
      console.error('Error during server-side censorship:', err);
    }

    const timestamp = admin.database.ServerValue.TIMESTAMP;
    const ref = db.ref('testguest');
    const newRef = await ref.push({ name, char, comment, timestamp })
    const newKey = newRef.key
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

    // Server-side censorship
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      name = censorBadWords(name, badwords);
      comment = censorBadWords(comment, badwords);
    } catch (err) {
      console.error('Error during server-side censorship:', err);
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

// Ambil semua data
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

    // Apply censorship on edit
    try {
      const data = fs.readFileSync(badWordsPath, 'utf-8');
      const badwords = JSON.parse(data);
      if (name) name = censorBadWords(name, badwords);
      if (comment) comment = censorBadWords(comment, badwords);
    } catch (err) {
      console.error('Error during censorship in edit:', err);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (comment !== undefined) updateData.comment = comment;
    if (char !== undefined) updateData.char = char;
    updateData.timestamp = admin.database.ServerValue.TIMESTAMP;

    await ref.update(updateData);
    res.json({ success: true, censoredName: name, censoredComment: comment });
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

    const names = ['Wildan', 'Budi', 'Rina', 'Andi', 'Dewi', 'Sinta', 'Hadi', 'Adit', 'Mega', 'Tono'];
    const comments = [
      'Mantap BNI WondrX!',
      'Event-nya seru banget dan interaktif!',
      'Maju terus BNI!',
      'Aplikasi WondrX keren banget fiturnya 👍',
      'Senang bisa hadir di acara ini.',
      'Sangat informatif dan seru!',
      'Moga makin sukses ke depannya!',
      'Vibes acaranya luar biasa!'
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

