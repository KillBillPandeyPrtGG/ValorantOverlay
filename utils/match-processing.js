const { getTrackingWindowStart, getMatchTimestamp } = require("./config-helpers");

/**
 * Filter raw match data to only competitive matches within the tracking window.
 */
function filterCompetitiveMatches(matchData, trackingDayResetTime) {
  if (!Array.isArray(matchData)) return [];

  const trackingWindowStart = getTrackingWindowStart(new Date(), trackingDayResetTime);

  return matchData.filter((match) => {
    const modeId = String(match?.metadata?.mode_id || "").toLowerCase();
    const modeName = String(match?.metadata?.mode || "").toLowerCase();
    const isCompetitive = modeId === "competitive" || modeName === "competitive";
    if (!isCompetitive) return false;

    const matchTime = getMatchTimestamp(match);
    if (!matchTime) return true;
    return matchTime >= trackingWindowStart;
  });
}

/**
 * Process competitive matches into result entries with win/loss and MMR changes.
 *
 * @param {Array} matchesToProcess - Filtered competitive matches
 * @param {object} activePlayer - { name, tag }
 * @param {Map} mmrByMatchId - Map of matchId -> mmr_change_to_last_game
 * @param {Map} previousPointsByMatchId - Map of matchId -> previously cached points
 * @param {number|null} latestMmrChange - mmr_change_to_last_game from mmr endpoint (for index 0 fallback)
 * @param {function} resolveAgentIcon - async (rawIconUrl) => resolvedUrl
 * @returns {Promise<{ results: Array, wins: number, losses: number }>}
 */
async function processMatches(matchesToProcess, activePlayer, mmrByMatchId, previousPointsByMatchId, latestMmrChange, resolveAgentIcon) {
  const results = [];
  let wins = 0;
  let losses = 0;

  for (let index = 0; index < matchesToProcess.length; index++) {
    const match = matchesToProcess[index];
    const player = match.players.all_players.find(
      p => p.name === activePlayer.name && p.tag === activePlayer.tag
    );
    if (!player) continue;

    const matchId = match?.metadata?.matchid || null;

    const winningTeam = match.teams.red.has_won ? "Red" : "Blue";
    const isWin = player.team === winningTeam;
    const historyChange = matchId ? mmrByMatchId.get(matchId) : undefined;
    let mmrChange = typeof historyChange === "number" ? historyChange : null;

    if (mmrChange === null && matchId && previousPointsByMatchId.has(matchId)) {
      mmrChange = previousPointsByMatchId.get(matchId);
    }

    if (mmrChange === null && index === 0 && typeof latestMmrChange === "number") {
      mmrChange = latestMmrChange;
    }

    const rawAgentIcon = player.assets?.agent?.small || null;
    const cachedAgentIcon = await resolveAgentIcon(rawAgentIcon);

    results.push({
      matchId,
      result: isWin ? "W" : "L",
      points: mmrChange,
      agentIcon: cachedAgentIcon,
      agentName: player.character || null
    });

    if (isWin) wins++; else losses++;
  }

  return { results, wins, losses };
}

module.exports = { filterCompetitiveMatches, processMatches };
