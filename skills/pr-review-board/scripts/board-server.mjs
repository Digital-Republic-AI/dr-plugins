#!/usr/bin/env node
// Serves one board folder over http on 127.0.0.1. Started detached by
// `pr-board.mjs --open`, because a file path opens in whatever app owns .html
// (often a code editor) while an http:// URL always opens in the browser.
// Only board.html and board.json are served, read on every request so a later
// run shows fresh data, and the process exits after an idle period.
//
//   board-server.mjs DIR
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import {
  BOARD_HTML_FILE,
  BOARD_JSON_FILE,
  SERVER_HOST,
  SERVER_IDLE_TIMEOUT_MS,
  SERVER_LOG_FILE,
  SERVER_MARKER_HEADER,
  SERVER_STATE_FILE,
} from './lib/constants.mjs';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_SERVER_ERROR = 500;

const ROUTES = {
  '/': { file: BOARD_HTML_FILE, type: 'text/html; charset=utf-8' },
  [`/${BOARD_HTML_FILE}`]: { file: BOARD_HTML_FILE, type: 'text/html; charset=utf-8' },
  [`/${BOARD_JSON_FILE}`]: { file: BOARD_JSON_FILE, type: 'application/json; charset=utf-8' },
};
const READ_METHODS = new Set(['GET', 'HEAD']);

if (!process.argv[2]) {
  console.error('usage: board-server.mjs DIR');
  process.exit(EXIT_USAGE);
}
const dir = resolve(process.argv[2]);
const marker = encodeURIComponent(dir);
const statePath = join(dir, SERVER_STATE_FILE);
let idleTimer;

function logError(message) {
  try {
    appendFileSync(join(dir, SERVER_LOG_FILE), `${new Date().toISOString()} ${message}\n`);
  } catch (error) {
    if (process.connected) process.send({ error: `${message} (log not writable: ${error.message})` });
  }
}

function fail(message) {
  logError(message);
  if (process.connected) process.send({ error: message });
  process.exit(EXIT_FAILURE);
}

function removeOwnState() {
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (state.pid === process.pid) rmSync(statePath);
  } catch (error) {
    if (error.code !== 'ENOENT') logError(`could not remove ${statePath}: ${error.message}`);
  }
}

function shutdown() {
  removeOwnState();
  process.exit(EXIT_OK);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(shutdown, SERVER_IDLE_TIMEOUT_MS);
}

function reply(res, status, headers, body) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', [SERVER_MARKER_HEADER]: marker, ...headers });
  res.end(body);
}

async function handle(req, res) {
  resetIdleTimer();
  const route = ROUTES[new URL(req.url, `http://${SERVER_HOST}`).pathname];
  if (!route) return reply(res, HTTP_NOT_FOUND, { 'Content-Type': 'text/plain; charset=utf-8' }, 'not found');
  if (!READ_METHODS.has(req.method)) return reply(res, HTTP_METHOD_NOT_ALLOWED, { Allow: 'GET, HEAD' }, '');
  try {
    const body = await readFile(join(dir, route.file));
    return reply(res, HTTP_OK, { 'Content-Type': route.type, 'Content-Length': body.length }, req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const missing = error.code === 'ENOENT';
    if (!missing) logError(`could not read ${route.file}: ${error.message}`);
    const status = missing ? HTTP_NOT_FOUND : HTTP_SERVER_ERROR;
    return reply(res, status, { 'Content-Type': 'text/plain; charset=utf-8' }, missing ? `${route.file} is gone; run pr-board.mjs again` : error.message);
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    logError(`request ${req.url} failed: ${error.message}`);
    if (!res.headersSent) reply(res, HTTP_SERVER_ERROR, { 'Content-Type': 'text/plain; charset=utf-8' }, error.message);
  });
});

server.on('error', (error) => fail(`board server error: ${error.message}`));
process.on('uncaughtException', (error) => fail(`board server crashed: ${error.stack || error.message}`));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(0, SERVER_HOST, () => {
  const { port } = server.address();
  try {
    writeFileSync(statePath, `${JSON.stringify({ pid: process.pid, port, dir, startedAt: new Date().toISOString() })}\n`);
  } catch (error) {
    fail(`could not write ${statePath}: ${error.message}`);
  }
  resetIdleTimer();
  if (process.connected) process.send({ port });
});
