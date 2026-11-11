import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('docs/ba/images/actual');
fs.mkdirSync(outDir, { recursive: true });

// Use an isolated temp profile outside the workspace
const tempProfile = path.join(os.tmpdir(), 'denso_chrome_' + Date.now());

async function run() {
  console.log('1. Starting Chrome headless with isolated profile:', tempProfile);
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfile}`,
    '--window-size=1600,1050',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:3000',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const pageTab = tabs.find((t) => t.type === 'page');
      if (pageTab && pageTab.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('Could not get page debugger WebSocket');
    chromeProc.kill();
    return;
  }

  console.log('2. Connected to Page WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  let reqId = 1;
  const call = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      const onMsg = (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.id === id) {
          ws.off('message', onMsg);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalCode = async (expression) => {
    const res = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : null;
  };

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1050,
    deviceScaleFactor: 1.25,
    mobile: false,
  });

  console.log('3. Waiting for page load...');
  await new Promise((r) => setTimeout(r, 2000));

  // Check current page state
  const isLoginPage = await evalCode('document.body.innerText.includes("Đăng Nhập")');
  console.log('Is login page showing:', isLoginPage);

  // Take test screenshot
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, '00_login_screen.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved 00_login_screen.png');

  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}
}

run().catch(console.error);
