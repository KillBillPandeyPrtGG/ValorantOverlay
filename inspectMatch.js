const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const config = require('./config.json');
const API_BASE = 'https://api.henrikdev.xyz/valorant';
const { name, tag, region } = config.player;
const CONFIG_PATH = path.join(__dirname, 'config.json');

function getApiKey() {
  return typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
}

async function ensureApiKeyConfigured() {
  if (getApiKey()) return true;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('No HenrikDev API key configured. Set config.apiKey in config.json.');
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (!getApiKey()) {
      const entered = (await rl.question('Enter your HenrikDev API key (HDEV-...): ')).trim();
      if (!entered) {
        console.log('API key cannot be empty.');
        continue;
      }
      config.apiKey = entered;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    }
  } finally {
    rl.close();
  }

  return true;
}

(async () => {
  try {
    const ready = await ensureApiKeyConfigured();
    if (!ready) {
      process.exitCode = 1;
      return;
    }

    const apiKey = getApiKey();
    const res = await fetch(`${API_BASE}/v3/matches/${region}/${name}/${tag}?size=1&api_key=${apiKey}`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
    if (json.data && json.data.length > 0) {
      const match = json.data[0];
      console.log('\n=== PLAYER FIELDS ===');
      const player = match.players.all_players.find(p => p.name === name && p.tag === tag);
      console.log(JSON.stringify(player, null, 2));
      console.log('\n=== MATCH FIELDS ===');
      console.log(Object.keys(match));
    }
  } catch (err) {
    console.error(err);
  }
})();