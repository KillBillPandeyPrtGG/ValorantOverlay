const test = require("node:test");
const assert = require("node:assert/strict");

const { filterCompetitiveMatches, processMatches } = require("../utils/match-processing");

// ---------------------------------------------------------------------------
// Helper: build a minimal match object
// ---------------------------------------------------------------------------
function makeMatch({
  matchId = "m1",
  mode = "competitive",
  modeId = "competitive",
  gameStartEpoch = null,
  redWon = true,
  players = [],
}) {
  return {
    metadata: {
      matchid: matchId,
      mode,
      mode_id: modeId,
      ...(gameStartEpoch != null ? { game_start: gameStartEpoch } : {}),
    },
    teams: {
      red: { has_won: redWon },
      blue: { has_won: !redWon },
    },
    players: { all_players: players },
  };
}

function makePlayer({
  name = "Player",
  tag = "1234",
  team = "Red",
  character = "Jett",
  agentIconUrl = "https://example.com/jett.png",
} = {}) {
  return {
    name,
    tag,
    team,
    character,
    assets: { agent: { small: agentIconUrl } },
  };
}

// ---------------------------------------------------------------------------
// filterCompetitiveMatches
// ---------------------------------------------------------------------------

test("filterCompetitiveMatches keeps only competitive matches", () => {
  const matches = [
    makeMatch({ matchId: "m1", mode: "competitive", modeId: "competitive" }),
    makeMatch({ matchId: "m2", mode: "deathmatch", modeId: "deathmatch" }),
    makeMatch({ matchId: "m3", mode: "competitive", modeId: "competitive" }),
    makeMatch({ matchId: "m4", mode: "unrated", modeId: "unrated" }),
  ];

  const result = filterCompetitiveMatches(matches, "00:00");
  const ids = result.map(m => m.metadata.matchid);
  assert.deepEqual(ids, ["m1", "m3"]);
});

test("filterCompetitiveMatches returns empty for null/undefined input", () => {
  assert.deepEqual(filterCompetitiveMatches(null, "00:00"), []);
  assert.deepEqual(filterCompetitiveMatches(undefined, "00:00"), []);
  assert.deepEqual(filterCompetitiveMatches("not-array", "00:00"), []);
});

test("filterCompetitiveMatches keeps matches without a timestamp (fallback)", () => {
  const matches = [
    makeMatch({ matchId: "m1", mode: "competitive" }),
  ];
  // No game_start set — should still be included
  const result = filterCompetitiveMatches(matches, "00:00");
  assert.equal(result.length, 1);
});

test("filterCompetitiveMatches recognises mode_id regardless of mode label", () => {
  const matches = [
    makeMatch({ matchId: "m1", mode: "", modeId: "competitive" }),
    makeMatch({ matchId: "m2", mode: "Competitive", modeId: "" }),
  ];
  const result = filterCompetitiveMatches(matches, "00:00");
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------------------
// processMatches — basic win/loss counting
// ---------------------------------------------------------------------------

test("processMatches counts wins and losses for all matches", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m2", redWon: false, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m3", redWon: true, players: [makePlayer({ team: "Blue" })] }),
    makeMatch({ matchId: "m4", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m5", redWon: false, players: [makePlayer({ team: "Blue" })] }),
  ];

  const { results, wins, losses } = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results.length, 5, "all 5 matches should be processed");
  assert.equal(wins, 3);
  assert.equal(losses, 2);
});

test("processMatches processes ALL matches — no early break", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  // W, W, L, W, L — previously the break would stop after 3
  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m2", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m3", redWon: false, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m4", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m5", redWon: false, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results, wins, losses } = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results.length, 5, "must process all 5 matches without breaking");
  assert.equal(wins, 3);
  assert.equal(losses, 2);
  assert.deepEqual(
    results.map(r => r.result),
    ["W", "W", "L", "W", "L"]
  );
});

// ---------------------------------------------------------------------------
// processMatches — no streak fields in output
// ---------------------------------------------------------------------------

test("processMatches does not return streak or type fields", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
  ];

  const result = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal("streak" in result, false, "should not contain streak");
  assert.equal("type" in result, false, "should not contain type");
});

// ---------------------------------------------------------------------------
// processMatches — MMR change resolution
// ---------------------------------------------------------------------------

test("processMatches uses mmrByMatchId as primary source for points", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;
  const mmrByMatchId = new Map([["m1", 22], ["m2", -14]]);

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m2", redWon: false, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results } = await processMatches(
    matches, player, mmrByMatchId, new Map(), null, noopResolve
  );

  assert.equal(results[0].points, 22);
  assert.equal(results[1].points, -14);
});

test("processMatches falls back to previousPointsByMatchId when mmrByMatchId lacks entry", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;
  const previousPoints = new Map([["m1", 18]]);

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results } = await processMatches(
    matches, player, new Map(), previousPoints, null, noopResolve
  );

  assert.equal(results[0].points, 18);
});

test("processMatches uses latestMmrChange for first match when other sources are empty", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
    makeMatch({ matchId: "m2", redWon: false, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results } = await processMatches(
    matches, player, new Map(), new Map(), 25, noopResolve
  );

  assert.equal(results[0].points, 25, "first match should use latestMmrChange");
  assert.equal(results[1].points, null, "second match should be null when no source exists");
});

test("processMatches sets points to null when no MMR data is available", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results } = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results[0].points, null);
});

// ---------------------------------------------------------------------------
// processMatches — player matching and agent info
// ---------------------------------------------------------------------------

test("processMatches skips matches where player is not found", async () => {
  const player = { name: "Someone", tag: "9999" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: true, players: [makePlayer({ name: "Other", tag: "0000" })] }),
    makeMatch({ matchId: "m2", redWon: true, players: [makePlayer({ name: "Someone", tag: "9999" })] }),
  ];

  const { results, wins, losses } = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].matchId, "m2");
  assert.equal(wins, 1);
  assert.equal(losses, 0);
});

test("processMatches captures agent name and icon via resolveAgentIcon", async () => {
  const player = { name: "Player", tag: "1234" };
  const resolveIcon = async (url) => url ? `/cached/${url.split("/").pop()}` : null;

  const matches = [
    makeMatch({
      matchId: "m1",
      redWon: true,
      players: [makePlayer({ team: "Red", character: "Phoenix", agentIconUrl: "https://cdn.example.com/phoenix.png" })],
    }),
  ];

  const { results } = await processMatches(
    matches, player, new Map(), new Map(), null, resolveIcon
  );

  assert.equal(results[0].agentName, "Phoenix");
  assert.equal(results[0].agentIcon, "/cached/phoenix.png");
});

test("processMatches handles null agent icon gracefully", async () => {
  const player = { name: "Player", tag: "1234" };
  const resolveIcon = async (url) => url;

  const matches = [
    makeMatch({
      matchId: "m1",
      redWon: true,
      players: [makePlayer({ team: "Red", agentIconUrl: null })],
    }),
  ];

  // Override the player asset to have no agent icon
  matches[0].players.all_players[0].assets.agent.small = null;

  const { results } = await processMatches(
    matches, player, new Map(), new Map(), null, resolveIcon
  );

  assert.equal(results[0].agentIcon, null);
});

// ---------------------------------------------------------------------------
// processMatches — empty input
// ---------------------------------------------------------------------------

test("processMatches returns zeros for empty match list", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const { results, wins, losses } = await processMatches(
    [], player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results.length, 0);
  assert.equal(wins, 0);
  assert.equal(losses, 0);
});

// ---------------------------------------------------------------------------
// processMatches — blue team wins
// ---------------------------------------------------------------------------

test("processMatches correctly identifies win when blue team wins", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const matches = [
    makeMatch({ matchId: "m1", redWon: false, players: [makePlayer({ team: "Blue" })] }),
    makeMatch({ matchId: "m2", redWon: false, players: [makePlayer({ team: "Red" })] }),
  ];

  const { results } = await processMatches(
    matches, player, new Map(), new Map(), null, noopResolve
  );

  assert.equal(results[0].result, "W", "blue player wins when blue team wins");
  assert.equal(results[1].result, "L", "red player loses when blue team wins");
});

// ---------------------------------------------------------------------------
// processMatches — match without matchId
// ---------------------------------------------------------------------------

test("processMatches handles match with no matchId", async () => {
  const player = { name: "Player", tag: "1234" };
  const noopResolve = async (url) => url;

  const match = makeMatch({ matchId: null, redWon: true, players: [makePlayer({ team: "Red" })] });
  match.metadata.matchid = undefined;

  const { results } = await processMatches(
    [match], player, new Map(), new Map(), 10, noopResolve
  );

  assert.equal(results[0].matchId, null);
  // latestMmrChange should still apply for index 0 since matchId is null/undefined
  assert.equal(results[0].points, 10);
});
