const express = require('express');
const path = require('path');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);
const distRoot = path.join(__dirname, 'dist', 'naldadi', 'browser');
const fallbackDistRoot = path.join(__dirname, 'dist', 'naldadi');

// Prefer the modern Angular output path, but keep backward compatibility.
const staticRoot = distRoot;

app.use(express.static(staticRoot));

app.get('*', (_req, res) => {
  const indexPath = path.join(staticRoot, 'index.html');
  res.sendFile(indexPath, (error) => {
    if (error) {
      res.sendFile(path.join(fallbackDistRoot, 'index.html'));
    }
  });
});

app.listen(port, () => {
  console.log(`NalDadi server listening on port ${port}`);
});
