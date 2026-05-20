import './server/index.js';
import { createServer } from 'vite';

async function startApp() {
  try {
    const viteServer = await createServer({
      configFile: './vite.config.js',
      root: process.cwd(),
      server: {
        port: 5173
      }
    });
    
    await viteServer.listen();
    viteServer.printUrls();
    console.log('\n✅ Frontend and Backend are both running successfully in a single process!');
  } catch (e) {
    console.error('Failed to start Vite:', e);
  }
}

startApp();
