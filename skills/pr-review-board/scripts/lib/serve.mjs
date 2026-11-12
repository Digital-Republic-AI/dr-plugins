// Starts the board server for a folder, or reuses the one already serving it,
// and returns the http:// URL of the board.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_HTML_FILE,
  SERVER_HOST,
  SERVER_MARKER_HEADER,
  SERVER_PROBE_TIMEOUT_MS,
  SERVER_START_TIMEOUT_MS,
  SERVER_STATE_FILE,
} from './constants.mjs';

const SERVER_SCRIPT = fileURLToPath(new URL('../board-server.mjs', import.meta.url));
const HTTP_OK = 200;

function boardUrl(port) {
  return `http://${SERVER_HOST}:${port}/${BOARD_HTML_FILE}`;
}

// A missing or unreadable state file only means no server can be reused; a new one is started.
function readServerPort(dir) {
  try {
    const { port } = JSON.parse(readFileSync(join(dir, SERVER_STATE_FILE), 'utf8'));
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}

// The marker header carries the folder, so a port reused by another process is never mistaken for this board.
function isServingFolder(port, dir) {
  return new Promise((done) => {
    const req = request({ host: SERVER_HOST, port, path: `/${BOARD_HTML_FILE}`, method: 'HEAD', timeout: SERVER_PROBE_TIMEOUT_MS }, (res) => {
      res.resume();
      done(res.statusCode === HTTP_OK && res.headers[SERVER_MARKER_HEADER] === encodeURIComponent(dir));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => done(false));
    req.end();
  });
}

function startServer(dir) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SERVER_SCRIPT, dir], {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const failWith = (message) => {
      clearTimeout(timer);
      fail(new Error(stderr.trim() ? `${message}: ${stderr.trim()}` : message));
    };
    const timer = setTimeout(() => {
      child.kill();
      failWith(`the board server did not start within ${SERVER_START_TIMEOUT_MS} ms`);
    }, SERVER_START_TIMEOUT_MS);
    child.once('error', (error) => failWith(`could not start the board server: ${error.message}`));
    child.once('exit', (code) => failWith(`the board server exited with code ${code} before it was ready`));
    child.once('message', (message) => {
      if (!Number.isInteger(message?.port)) return failWith(message?.error || 'the board server sent no port');
      clearTimeout(timer);
      child.removeAllListeners('exit');
      child.stderr.destroy();
      child.disconnect();
      child.unref();
      return done(message.port);
    });
  });
}

export async function serveBoard(dir) {
  const port = readServerPort(dir);
  if (port !== null && (await isServingFolder(port, dir))) return { url: boardUrl(port), reused: true };
  return { url: boardUrl(await startServer(dir)), reused: false };
}
