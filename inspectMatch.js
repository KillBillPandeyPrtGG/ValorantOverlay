const fetch = require('node-fetch');
const config = require('./config.json');
const API_BASE = 'https://api.henrikdev.xyz/valorant';
const { name, tag, region } = config.player;

(async () => {
  try {
    const res = await fetch(`${API_BASE}/v3/matches/${region}/${name}/${tag}?size=1&api_key=${config.apiKey}`);
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