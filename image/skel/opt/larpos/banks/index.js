// app/banks/index.js — Unified entrypoint for asset banks
const loader = require('./loader');
const fonts = require('./fonts');
const icons = require('./icons');
const palettes = require('./palettes');
const sounds = require('./sounds');

module.exports = {
  loader,
  fonts,
  icons,
  palettes,
  sounds,
  getBankEntry: loader.getBankEntry,
  resolveIcon: loader.resolveIcon,
  resolveFont: loader.resolveFont,
  resolveSound: loader.resolveSound,
  resolvePalette: loader.resolvePalette,
  CATALOG: loader.CATALOG
};
