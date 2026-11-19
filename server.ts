import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createApiApp } from './server/apiApp.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp();

  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const runningCompiledServer = Boolean(process.argv[1]?.endsWith('server.js'));
  const serveBuiltAssets =
    process.env.NODE_ENV === 'production' ||
    (runningCompiledServer && fs.existsSync(distIndexPath));

  if (serveBuiltAssets) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stoxify server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
