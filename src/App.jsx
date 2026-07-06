import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase";
import { ref, get, set, onValue } from "firebase/database";

// ---------------- Tournament data (official 2026 knockout bracket) ----------------

const TEAMS = {
  GER: { n: "Germany", f: "🇩🇪" }, PAR: { n: "Paraguay", f: "🇵🇾" },
  FRA: { n: "France", f: "🇫🇷" }, SWE: { n: "Sweden", f: "🇸🇪" },
  RSA: { n: "South Africa", f: "🇿🇦" }, CAN: { n: "Canada", f: "🇨🇦" },
  NED: { n: "Netherlands", f: "🇳🇱" }, MAR: { n: "Morocco", f: "🇲🇦" },
  POR: { n: "Portugal", f: "🇵🇹" }, CRO: { n: "Croatia", f: "🇭🇷" },
  ESP: { n: "Spain", f: "🇪🇸" }, AUT: { n: "Austria", f: "🇦🇹" },
  USA: { n: "USA", f: "🇺🇸" }, BIH: { n: "Bosnia-Herz.", f: "🇧🇦" },
  BEL: { n: "Belgium", f: "🇧🇪" }, SEN: { n: "Senegal", f: "🇸🇳" },
  BRA: { n: "Brazil", f: "🇧🇷" }, JPN: { n: "Japan", f: "🇯🇵" },
  CIV: { n: "Ivory Coast", f: "🇨🇮" }, NOR: { n: "Norway", f: "🇳🇴" },
  MEX: { n: "Mexico", f: "🇲🇽" }, ECU: { n: "Ecuador", f: "🇪🇨" },
  ENG: { n: "England", f: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" }, COD: { n: "DR Congo", f: "🇨🇩" },
  AUS: { n: "Australia", f: "🇦🇺" }, EGY: { n: "Egypt", f: "🇪🇬" },
  ARG: { n: "Argentina", f: "🇦🇷" }, CPV: { n: "Cape Verde", f: "🇨🇻" },
  SUI: { n: "Switzerland", f: "🇨🇭" }, DZA: { n: "Algeria", f: "🇩🇿" },
  COL: { n: "Colombia", f: "🇨🇴" }, GHA: { n: "Ghana", f: "🇬🇭" },
};

// Ordered so each pair of R32 matches feeds the correct official R16 tie
const R32_MATCHES = [
  ["GER", "PAR"], ["FRA", "SWE"], // -> R16: Paraguay v France (M89)
  ["RSA", "CAN"], ["NED", "MAR"], // -> R16: Canada v Morocco (M90)
  ["POR", "CRO"], ["ESP", "AUT"], // -> R16: Portugal v Spain (M93)
  ["USA", "BIH"], ["BEL", "SEN"], // -> R16: USA v Belgium (M94)
  ["BRA", "JPN"], ["CIV", "NOR"], // -> R16: Brazil v Norway (M91)
  ["MEX", "ECU"], ["ENG", "COD"], // -> R16: Mexico v England (M92)
  ["AUS", "EGY"], ["ARG", "CPV"], // -> R16: M95
  ["SUI", "DZA"], ["COL", "GHA"], // -> R16: M96
];

const ROUNDS = [
  { id: "r32", label: "Round of 32", short: "R32", count: 16 },
  { id: "r16", label: "Round of 16", short: "R16", count: 8 },
  { id: "qf", label: "Quarterfinals", short: "QF", count: 4 },
  { id: "sf", label: "Semifinals", short: "SF", count: 2 },
  { id: "f", label: "Final", short: "F", count: 1 },
];

const DEFAULT_POINTS = { r32: 1, r16: 2, qf: 4, sf: 8, f: 16 };

// Real results already decided as of July 3, 2026
const SEED_ACTUAL = {
  "r32-0": "PAR", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "MAR",
  "r32-4": "POR", "r32-5": "ESP", "r32-6": "USA", "r32-7": "BEL",
  "r32-8": "BRA", "r32-9": "NOR", "r32-10": "MEX", "r32-11": "ENG",
  "r32-12": "EGY", "r32-13": "ARG", "r32-14": "SUI", "r32-15": "COL",
  // Round of 32 complete.
  "r16-1": "MAR", // Morocco 3-0 Canada (Jul 4)
  "r16-0": "FRA", // France 1-0 Paraguay (Jul 4)
  "r16-4": "NOR", // Norway 2-1 Brazil (Jul 5)
};

// Goal scores for completed games, keyed by slot id. `pens: true` marks a
// draw in regulation decided by a shootout (the winner is in SEED_ACTUAL).
const SEED_SCORES = {
  "r32-1": { FRA: 3, SWE: 0 },
  "r32-3": { NED: 1, MAR: 1, pens: true },
  "r32-4": { POR: 2, CRO: 1 },
  "r32-5": { ESP: 3, AUT: 0 },
  "r32-6": { USA: 2, BIH: 0 },
  "r32-7": { BEL: 3, SEN: 2 },
  "r32-9": { CIV: 1, NOR: 2 },
  "r32-10": { MEX: 2, ECU: 0 },
  "r32-11": { ENG: 2, COD: 1 },
  "r32-12": { AUS: 1, EGY: 1, pens: true },
  "r32-13": { ARG: 3, CPV: 2 },
  "r32-14": { SUI: 2, DZA: 0 },
  "r32-15": { COL: 1, GHA: 0 },
  "r16-1": { CAN: 0, MAR: 3 },
  "r16-0": { PAR: 0, FRA: 1 },
  "r16-4": { BRA: 1, NOR: 2 },
};

// Witty one-liners for completed games, keyed by slot id. Kept accurate to the
// scoreline and story; the live sync fills these in for future rounds.
const SEED_BLURBS = {
  "r32-0": "Paraguay didn't read the script — Germany packed their bags in the tournament's first real shocker.",
  "r32-1": "France flexed, Sweden folded: three unanswered and Les Bleus barely broke a sweat.",
  "r32-2": "Canada found a way past South Africa to keep the host-continent party going.",
  "r32-3": "Ice-cold from twelve yards — Morocco won the shootout and sent the Dutch home heartbroken.",
  "r32-4": "Portugal outlasted a stubborn Croatia in a proper old-school tussle.",
  "r32-5": "Spain passed Austria dizzy — three goals, no reply, no mercy.",
  "r32-6": "Home crowd, happy ending: the USA shut the door on Bosnia.",
  "r32-7": "Five-goal chaos — Belgium edged a Senegal side that refused to go quietly.",
  "r32-8": "Brazil shrugged off Japan's press and sambaed into the next round.",
  "r32-9": "Down but not out — Norway came from behind to break Ivorian hearts.",
  "r32-10": "All business from Mexico, blanking Ecuador to punch their ticket.",
  "r32-11": "England made it harder than it needed to be, but survived a spirited Congo.",
  "r32-12": "Egypt struck early, rode out the Aussie storm, and held their nerve in the shootout.",
  "r32-13": "Cape Verde gave the favourites the fright of their lives before Argentina scraped through 3–2.",
  "r32-14": "Clinical and clean — Switzerland closed out Algeria without conceding.",
  "r32-15": "One goal was all Colombia needed to squeeze past a game Ghana.",
  // Round of 16
  "r16-1": "So much for home advantage — Morocco bundled co-hosts Canada out 3–0 and strolled into the quarterfinals.",
  "r16-0": "No fairytale rematch — France did just enough to end Paraguay's giant-killing run 1–0.",
  "r16-4": "Haaland and friends turned up, 66% of the ball turned into two late Norway goals, and Brazil's late strike was just for pride.",
};

// Picks transcribed from the family's hand-filled wallcharts
const SEED_PLAYERS = [
  {
    id: "seed-rishab", name: "Rishab",
    picks: {
      "r32-0": "GER", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "NED",
      "r32-4": "POR", "r32-5": "ESP", "r32-6": "USA", "r32-7": "BEL",
      "r32-8": "BRA", "r32-9": "NOR", "r32-10": "MEX", "r32-11": "ENG",
      "r32-12": "EGY", "r32-13": "ARG", "r32-14": "SUI", "r32-15": "COL",
      "r16-0": "FRA", "r16-1": "NED", "r16-2": "ESP", "r16-3": "USA",
      "r16-4": "BRA", "r16-5": "ENG", "r16-6": "ARG", "r16-7": "COL",
      "qf-0": "FRA", "qf-1": "ESP", "qf-2": "ENG", "qf-3": "ARG",
      "sf-0": "FRA", "sf-1": "ARG", "f-0": "FRA",
    },
  },
  {
    id: "seed-umesh", name: "Umesh",
    picks: {
      "r32-0": "PAR", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "NED",
      "r32-4": "CRO", "r32-5": "ESP", "r32-6": "USA", "r32-7": "BEL",
      "r32-8": "BRA", "r32-9": "NOR", "r32-10": "ECU", "r32-11": "ENG",
      "r32-12": "AUS", "r32-13": "ARG", "r32-14": "SUI", "r32-15": "COL",
      "r16-0": "FRA", "r16-1": "NED", "r16-2": "ESP", "r16-3": "BEL",
      "r16-4": "BRA", "r16-5": "ENG", "r16-6": "ARG", "r16-7": "SUI",
      "qf-0": "FRA", "qf-1": "ESP", "qf-2": "BRA", "qf-3": "ARG",
      "sf-0": "ESP", "sf-1": "ARG", "f-0": "ARG",
    },
  },
  {
    id: "seed-nisha", name: "Nisha",
    picks: {
      "r32-0": "PAR", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "NED",
      "r32-4": "POR", "r32-5": "ESP", "r32-6": "USA", "r32-7": "SEN",
      "r32-8": "BRA", "r32-9": "NOR", "r32-10": "ECU", "r32-11": "ENG",
      "r32-12": "EGY", "r32-13": "ARG", "r32-14": "DZA", "r32-15": "GHA",
      "r16-0": "FRA", "r16-1": "NED", "r16-2": "POR", "r16-3": "USA",
      "r16-4": "BRA", "r16-5": "ECU", "r16-6": "ARG", "r16-7": "GHA",
      "qf-0": "FRA", "qf-1": "POR", "qf-2": "BRA", "qf-3": "ARG",
      "sf-0": "FRA", "sf-1": "BRA", "f-0": "BRA",
    },
  },
  {
    id: "seed-nitin", name: "Nitin",
    picks: {
      "r32-0": "GER", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "NED",
      "r32-4": "CRO", "r32-5": "ESP", "r32-6": "USA", "r32-7": "SEN",
      "r32-8": "BRA", "r32-9": "NOR", "r32-10": "MEX", "r32-11": "ENG",
      "r32-12": "EGY", "r32-13": "ARG", "r32-14": "SUI", "r32-15": "GHA",
      "r16-0": "FRA", "r16-1": "NED", "r16-2": "ESP", "r16-3": "SEN",
      "r16-4": "NOR", "r16-5": "ENG", "r16-6": "ARG", "r16-7": "GHA",
      "qf-0": "FRA", "qf-1": "ESP", "qf-2": "ENG", "qf-3": "ARG",
      "sf-0": "FRA", "sf-1": "ARG", "f-0": "FRA",
    },
  },
  {
    id: "seed-arati", name: "Arati",
    picks: {
      "r32-0": "GER", "r32-1": "FRA", "r32-2": "CAN", "r32-3": "MAR",
      "r32-4": "POR", "r32-5": "ESP", "r32-6": "USA", "r32-7": "BEL",
      "r32-8": "BRA", "r32-9": "NOR", "r32-10": "MEX", "r32-11": "ENG",
      "r32-12": "EGY", "r32-13": "ARG", "r32-14": "SUI", "r32-15": "COL",
      "r16-0": "FRA", "r16-1": "MAR", "r16-2": "ESP", "r16-3": "USA",
      "r16-4": "NOR", "r16-5": "MEX", "r16-6": "ARG", "r16-7": "COL",
      "qf-0": "FRA", "qf-1": "ESP", "qf-2": "MEX", "qf-3": "ARG",
      "sf-0": "ESP", "sf-1": "ARG", "f-0": "ARG",
    },
  },
];

// When the pre-loaded results were current, shown until manual edits update it.
const SEED_UPDATED = "2026-07-06T02:00:00Z";

// ---------------- Bracket helpers ----------------

const mid = (r, i) => `${ROUNDS[r].id}-${i}`;

// Format an ISO timestamp in the viewer's own locale and timezone.
function fmtUpdated(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  try {
    return d.toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

// Entrants of a match given a winners map (picks or actual results)
function entrantsOf(roundIdx, i, winners) {
  if (roundIdx === 0) return R32_MATCHES[i];
  const prev = ROUNDS[roundIdx - 1].id;
  return [winners[`${prev}-${2 * i}`] || null, winners[`${prev}-${2 * i + 1}`] || null];
}

// Remove downstream selections invalidated by an earlier change
function cleanDownstream(winners) {
  const w = { ...winners };
  for (let r = 1; r < ROUNDS.length; r++) {
    for (let i = 0; i < ROUNDS[r].count; i++) {
      const id = mid(r, i);
      if (w[id]) {
        const ents = entrantsOf(r, i, w);
        if (!ents.includes(w[id])) delete w[id];
      }
    }
  }
  return w;
}

function scorePlayer(player, actual, points) {
  const byRound = {};
  let total = 0;
  ROUNDS.forEach((rd, r) => {
    let pts = 0;
    for (let i = 0; i < rd.count; i++) {
      const id = mid(r, i);
      if (player.picks[id] && actual[id] && player.picks[id] === actual[id]) {
        pts += points[rd.id];
      }
    }
    byRound[rd.id] = pts;
    total += pts;
  });
  return { byRound, total };
}

// Can `team` still end up winning bracket slot (r, i), given actual results so far?
// True also when it already has (those points are earned, and count toward the max).
function teamCanWinSlot(team, r, i, actual) {
  const j = R32_MATCHES.findIndex((m) => m.includes(team));
  if (j === -1) return false;
  const span = Math.pow(2, r);
  if (j < i * span || j >= (i + 1) * span) return false; // wrong side of the bracket
  for (let rr = 0; rr <= r; rr++) {
    const idx = Math.floor(j / Math.pow(2, rr));
    const a = actual[mid(rr, idx)];
    if (a && a !== team) return false; // knocked out (or beaten) on the path
  }
  return true;
}

function maxPossible(player, actual, points) {
  let max = 0;
  ROUNDS.forEach((rd, r) => {
    for (let i = 0; i < rd.count; i++) {
      const pick = player.picks[mid(r, i)];
      if (pick && teamCanWinSlot(pick, r, i, actual)) max += points[rd.id];
    }
  });
  return max;
}

// ---------------- Storage (Firebase Realtime Database) ----------------
// One shared document at /leagues/wc26 — every visitor reads and writes the
// same league, exactly like the original app's shared storage.

const LEAGUE_PATH = "leagues/wc26";

async function loadLeague() {
  try {
    const snap = await get(ref(db, LEAGUE_PATH));
    if (snap.exists()) return snap.val();
  } catch (e) { console.error("Load failed", e); }
  return { players: [], actual: { ...SEED_ACTUAL }, scores: { ...SEED_SCORES }, blurbs: { ...SEED_BLURBS }, points: { ...DEFAULT_POINTS }, lastUpdated: SEED_UPDATED };
}

async function saveLeague(data) {
  try {
    await set(ref(db, LEAGUE_PATH), data);
    return true;
  } catch (e) {
    console.error("Save failed", e);
    return false;
  }
}

// Subscribes to live changes so every open tab/phone updates in real time
// when anyone else edits picks or results. Returns an unsubscribe function.
function subscribeLeague(callback) {
  const r = ref(db, LEAGUE_PATH);
  return onValue(r, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
}

// ---------------- UI pieces ----------------

function TeamRow({ code, state, onClick, big, goals, isWinner }) {
  const t = code ? TEAMS[code] : null;
  const hasGoals = goals !== null && goals !== undefined;
  return (
    <div
      className={`team-row ${state} ${onClick ? "tappable" : ""} ${big ? "big" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <span className="flag">{t ? t.f : "·"}</span>
      <span className="tname">{t ? t.n : "TBD"}</span>
      {hasGoals && <span className={`goals ${isWinner ? "gw" : ""}`}>{goals}</span>}
      {state === "correct" && <span className="mark ok">✓</span>}
      {state === "wrong" && <span className="mark no">✗</span>}
      {state === "picked" && !hasGoals && <span className="mark pick">●</span>}
    </div>
  );
}

function BracketGrid({ winners, actual, editable, onPick, scored }) {
  return (
    <div className="bracket-scroll">
      <div className="bracket">
        {ROUNDS.map((rd, r) => (
          <div className="round-col" key={rd.id}>
            <div className="round-head">{rd.label}</div>
            <div className="round-matches">
              {Array.from({ length: rd.count }).map((_, i) => {
                const id = mid(r, i);
                const ents = entrantsOf(r, i, winners);
                const pick = winners[id];
                return (
                  <div className="match" key={id}>
                    {ents.map((code, j) => {
                      let state = "idle";
                      if (code && pick === code) {
                        if (scored && actual[id]) {
                          state = actual[id] === code ? "correct" : "wrong";
                        } else {
                          state = "picked";
                        }
                      }
                      const clickable = editable && code
                        ? () => onPick(id, code)
                        : undefined;
                      return <TeamRow key={j + (code || "x")} code={code} state={state} onClick={clickable} />;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Main app ----------------

export default function App() {
  const [league, setLeague] = useState(null);
  const [tab, setTab] = useState("standings");
  const [viewId, setViewId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");
  const [showScoring, setShowScoring] = useState(false);

  // Tracks whether the initial load has finished, so the realtime subscription
  // (which fires immediately on mount) doesn't stomp on it.
  const loadedRef = useRef(false);

  useEffect(() => {
    loadLeague().then((d) => {
      // merge any newly-decided seeded results into an existing league
      let merged = { ...d, actual: { ...SEED_ACTUAL, ...d.actual }, scores: { ...SEED_SCORES, ...(d.scores || {}) }, blurbs: { ...SEED_BLURBS, ...(d.blurbs || {}) }, lastUpdated: d.lastUpdated || SEED_UPDATED };
      // Add each transcribed paper bracket exactly once — ever. Tracked by id so
      // a bracket deleted later isn't resurrected, yet seed players introduced in
      // a later update still get added on next load.
      const applied = new Set(merged.seededIds || []);
      // Migrate the older boolean flag: those three were already applied.
      if (merged.seededPlayers && !merged.seededIds) {
        ["seed-rishab", "seed-umesh", "seed-nisha"].forEach((id) => applied.add(id));
      }
      const existingNames = new Set(merged.players.map((p) => p.name.toLowerCase()));
      const toAdd = SEED_PLAYERS.filter((p) => !applied.has(p.id) && !existingNames.has(p.name.toLowerCase()));
      if (toAdd.length) {
        toAdd.forEach((p) => applied.add(p.id));
        merged = { ...merged, players: [...merged.players, ...toAdd] };
      }
      // Always record which seeds we've considered, and drop the old flag.
      SEED_PLAYERS.forEach((p) => { if (existingNames.has(p.name.toLowerCase())) applied.add(p.id); });
      merged = { ...merged, seededIds: [...applied], seededPlayers: true };
      saveLeague(merged);
      setLeague(merged);
      if (merged.players.length) setViewId(merged.players[0].id);
      loadedRef.current = true;
    });
  }, []);

  // Live sync: whenever anyone (any device) updates the shared league — new
  // picks, a result typed in, scoring rule changes — every open tab updates
  // instantly via Firebase's realtime subscription. No polling, no API calls.
  useEffect(() => {
    const unsubscribe = subscribeLeague((remote) => {
      if (!loadedRef.current) return; // ignore the initial echo of our own load
      setLeague(remote);
    });
    return unsubscribe;
  }, []);


  const persist = useCallback((next) => {
    setLeague(next);
    saveLeague(next).then((ok) => {
      if (!ok) setStatus("Couldn't save — check your connection and try again.");
    });
  }, []);

  if (!league) {
    return (
      <div className="shell">
        <Style />
        <div className="loading">Setting up the pitch…</div>
      </div>
    );
  }

  const { players, actual, points, scores: goalScores = {}, blurbs = {}, lastUpdated } = league;
  const scores = players
    .map((p) => ({ ...p, ...scorePlayer(p, actual, points), max: maxPossible(p, actual, points) }))
    .sort((a, b) => b.total - a.total || b.max - a.max);
  const viewPlayer = players.find((p) => p.id === viewId) || null;

  // ----- actions -----
  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    const p = { id: Date.now().toString(36), name, picks: {} };
    persist({ ...league, players: [...players, p] });
    setNewName("");
    setAdding(false);
    setViewId(p.id);
    setEditing(true);
    setTab("brackets");
  };

  const removePlayer = (id) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm(`Remove ${p.name}'s bracket? This can't be undone.`)) return;
    const next = players.filter((x) => x.id !== id);
    persist({ ...league, players: next });
    if (viewId === id) setViewId(next[0]?.id || null);
  };

  const setPick = (matchId, code) => {
    if (!viewPlayer) return;
    let picks = { ...viewPlayer.picks };
    picks[matchId] = picks[matchId] === code ? undefined : code;
    if (!picks[matchId]) delete picks[matchId];
    picks = cleanDownstream(picks);
    persist({
      ...league,
      players: players.map((p) => (p.id === viewPlayer.id ? { ...p, picks } : p)),
    });
  };

  const setActual = (matchId, code) => {
    let a = { ...actual };
    a[matchId] = a[matchId] === code ? undefined : code;
    if (!a[matchId]) delete a[matchId];
    a = cleanDownstream(a);
    persist({ ...league, actual: a, lastUpdated: new Date().toISOString() });
  };

  const setPointVal = (rid, val) => {
    const v = Math.max(0, parseInt(val || "0", 10));
    persist({ ...league, points: { ...points, [rid]: v } });
  };

  const picksComplete = (p) => {
    let n = 0;
    ROUNDS.forEach((rd, r) => {
      for (let i = 0; i < rd.count; i++) if (p.picks[mid(r, i)]) n++;
    });
    return n;
  };
  const TOTAL_PICKS = 31;

  // ----- render -----
  return (
    <div className="shell">
      <Style />
      <header className="hero">
        <div className="pitch-lines" aria-hidden="true" />
        <div className="eyebrow">FIFA World Cup 2026 · Knockout Stage</div>
        <div className="mast">
          <svg className="crest" viewBox="0 0 80 96" xmlns="http://www.w3.org/2000/svg" aria-label="World Cup 26 emblem" role="img">
            {/* shield */}
            <path d="M6 10 L40 4 L74 10 L74 48 C74 72 58 84 40 92 C22 84 6 72 6 48 Z"
              fill="var(--panel2)" stroke="var(--gold)" strokeWidth="2.5" />
            {/* pitch arc */}
            <path d="M14 60 Q40 74 66 60" fill="none" stroke="var(--chalk)" strokeWidth="1.5" />
            <circle cx="40" cy="60" r="7" fill="none" stroke="var(--chalk)" strokeWidth="1.5" />
            {/* trophy cup */}
            <path d="M30 22 H50 V30 C50 39 45 44 40 44 C35 44 30 39 30 30 Z" fill="var(--gold)" />
            <path d="M30 25 C23 25 22 33 30 34 M50 25 C57 25 58 33 50 34" fill="none" stroke="var(--gold)" strokeWidth="2.5" />
            <rect x="37" y="44" width="6" height="6" fill="var(--gold)" />
            <rect x="32" y="50" width="16" height="4" rx="1.5" fill="var(--gold)" />
            {/* 26 */}
            <text x="40" y="72" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif"
              fontWeight="800" fontSize="15" fill="var(--gold)" letterSpacing="1">26</text>
          </svg>
          <h1>THE FAMILY CUP</h1>
        </div>
        <div className="sub">One bracket each. Bragging rights forever.</div>
      </header>

      <nav className="tabs">
        {[
          ["standings", "Standings"],
          ["brackets", "Brackets"],
          ["results", "Results"],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? "tab on" : "tab"} onClick={() => { setTab(id); setStatus(""); }}>
            {label}
          </button>
        ))}
      </nav>

      {status && <div className="status">{status}</div>}

      {/* ---------------- STANDINGS ---------------- */}
      {tab === "standings" && (
        <section>
          {players.length === 0 ? (
            <div className="empty">
              No brackets yet. Head to the Brackets tab to enter everyone's picks.
            </div>
          ) : (
            <>
            <div className="updated-bar">
              <span className="updated-txt">
                Table updated as of {fmtUpdated(lastUpdated)}
              </span>
            </div>
            <div className="board">
              <div className="board-row head">
                <span className="pos"></span>
                <span className="pname">Player</span>
                <span className="cell champ" title="Champion pick">🏆</span>
                {ROUNDS.map((rd) => <span key={rd.id} className="cell">{rd.short}</span>)}
                <span className="cell total">Total</span>
                <span className="cell maxcol">Max</span>
              </div>
              {scores.map((p, i) => {
                const champ = p.picks["f-0"];
                const champAlive = champ && teamCanWinSlot(champ, ROUNDS.length - 1, 0, actual);
                return (
                  <div className={`board-row ${i === 0 && p.total > 0 ? "leader" : ""}`} key={p.id}>
                    <span className="pos">{i === 0 && p.total > 0 ? "🏆" : i + 1}</span>
                    <button
                      className="pname pname-link"
                      onClick={() => { setViewId(p.id); setEditing(false); setTab("brackets"); setStatus(""); }}
                      title={`View ${p.name}'s bracket`}
                    >
                      {p.name}
                    </button>
                    <span className={`cell champ ${champ && !champAlive ? "out" : ""}`}
                      title={champ ? `Champion pick: ${TEAMS[champ].n}${champAlive ? "" : " (eliminated)"}` : "No champion pick"}>
                      {champ ? TEAMS[champ].f : "–"}
                    </span>
                    {ROUNDS.map((rd) => (
                      <span key={rd.id} className="cell">{p.byRound[rd.id]}</span>
                    ))}
                    <span className="cell total">{p.total}</span>
                    <span className="cell maxcol">{p.max}</span>
                  </div>
                );
              })}
            </div>
            </>
          )}

          <button className="ghost-btn" onClick={() => setShowScoring(!showScoring)}>
            {showScoring ? "Hide scoring rules" : "Scoring rules"}
          </button>
          {showScoring && (
            <div className="scoring">
              <p>Points per correct pick in each round. Tap a number to change it.</p>
              <div className="score-grid">
                {ROUNDS.map((rd) => (
                  <label key={rd.id}>
                    <span>{rd.short}</span>
                    <input
                      type="number" min="0" value={points[rd.id]}
                      onChange={(e) => setPointVal(rd.id, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------- BRACKETS ---------------- */}
      {tab === "brackets" && (
        <section>
          <div className="chip-row">
            {players.map((p) => (
              <button
                key={p.id}
                className={viewId === p.id ? "chip on" : "chip"}
                onClick={() => { setViewId(p.id); setEditing(false); }}
              >
                {p.name}
              </button>
            ))}
            {!adding ? (
              <button className="chip add" onClick={() => setAdding(true)}>+ New bracket</button>
            ) : (
              <span className="add-form">
                <input
                  autoFocus placeholder="Name" value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                />
                <button className="chip on" onClick={addPlayer}>Add</button>
                <button className="chip" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</button>
              </span>
            )}
          </div>

          {viewPlayer ? (
            <>
              <div className="bracket-bar">
                <div>
                  <strong>{viewPlayer.name}</strong>
                  <span className="muted"> · {picksComplete(viewPlayer)}/{TOTAL_PICKS} picks</span>
                </div>
                <div className="bar-actions">
                  <button className="ghost-btn" onClick={() => setEditing(!editing)}>
                    {editing ? "Done" : "Edit picks"}
                  </button>
                  <button className="ghost-btn danger" onClick={() => removePlayer(viewPlayer.id)}>Remove</button>
                </div>
              </div>
              {editing && (
                <div className="hint">
                  Tap the team {viewPlayer.name} picked to win each match, left to right. Later rounds fill
                  in from earlier picks — copy them straight off the paper bracket.
                </div>
              )}
              {!editing && (
                <div className="legend">
                  <span><i className="dot ok" /> correct</span>
                  <span><i className="dot no" /> wrong</span>
                  <span><i className="dot pk" /> pick pending result</span>
                </div>
              )}
              <BracketGrid
                winners={viewPlayer.picks}
                actual={actual}
                editable={editing}
                onPick={setPick}
                scored={!editing}
              />
            </>
          ) : (
            <div className="empty">Add a bracket for each family member, then copy their hand-filled picks in.</div>
          )}
        </section>
      )}

      {/* ---------------- RESULTS ---------------- */}
      {tab === "results" && (
        <section>
          <div className="bracket-bar">
            <div><strong>Official results</strong><span className="muted"> · tap the winner</span></div>
          </div>
          <div className="hint">
            Tap a team to set (or clear) it as the winner. Updates sync live to everyone
            viewing this app — no refresh needed.
          </div>
          {ROUNDS.map((rd, r) => {
            const rows = [];
            for (let i = 0; i < rd.count; i++) {
              const id = mid(r, i);
              const [a, b] = entrantsOf(r, i, actual);
              if (!a || !b) continue;
              const sc = goalScores[id];
              const winner = actual[id];
              const blurb = winner ? blurbs[id] : null;
              rows.push(
                <div className="match wide" key={id}>
                  {[a, b].map((code) => (
                    <TeamRow
                      key={code}
                      code={code}
                      state={winner === code ? "picked" : "idle"}
                      onClick={() => setActual(id, code)}
                      goals={sc ? sc[code] : null}
                      isWinner={winner === code}
                      big
                    />
                  ))}
                  {sc && sc.pens && winner && (
                    <div className="pens-note">{TEAMS[winner].n} won on penalties</div>
                  )}
                  {blurb && <div className="blurb">“{blurb}”</div>}
                </div>
              );
            }
            if (!rows.length) return null;
            return (
              <div key={rd.id} className="result-round">
                <div className="round-head inline">{rd.label}</div>
                <div className="result-grid">{rows}</div>
              </div>
            );
          })}
        </section>
      )}

      <footer className="foot">Correct picks score {ROUNDS.map((rd) => `${points[rd.id]} (${rd.short})`).join(" · ")}</footer>
    </div>
  );
}

// ---------------- Styles ----------------

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Barlow:wght@400;600&display=swap');

      :root {
        --pitch: #0A2E23;
        --panel: #113B2D;
        --panel2: #16493A;
        --chalk: rgba(238,246,241,0.14);
        --text: #EDF5F0;
        --muted: #8FAE9F;
        --gold: #F0C24B;
        --ok: #56D08C;
        --no: #E5655E;
      }
      * { box-sizing: border-box; }
      .shell {
        min-height: 100vh;
        background:
          radial-gradient(1200px 500px at 50% -200px, #14503C 0%, var(--pitch) 60%),
          var(--pitch);
        color: var(--text);
        font-family: 'Barlow', system-ui, sans-serif;
        padding: 0 12px 40px;
        max-width: 960px;
        margin: 0 auto;
      }
      .loading { padding: 60px 0; text-align: center; color: var(--muted); font-size: 18px; }

      .hero { position: relative; text-align: center; padding: 26px 0 18px; overflow: hidden; }
      .pitch-lines {
        position: absolute; inset: 0; pointer-events: none;
        background:
          radial-gradient(circle at 50% 130%, transparent 118px, var(--chalk) 119px, var(--chalk) 121px, transparent 122px),
          linear-gradient(var(--chalk), var(--chalk)) 50% 100% / 100% 2px no-repeat;
        opacity: .9;
      }
      .eyebrow {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 600;
        letter-spacing: .22em; text-transform: uppercase; font-size: 12px; color: var(--gold);
      }
      .hero h1 {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
        font-size: clamp(44px, 9vw, 72px); margin: 4px 0 2px; letter-spacing: .02em; line-height: 1;
      }
      .mast { display: flex; align-items: center; justify-content: center; gap: 14px; }
      .crest { width: clamp(46px, 11vw, 68px); height: auto; flex-shrink: 0; filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); }
      .sub { color: var(--muted); font-size: 14px; }

      .tabs { display: flex; gap: 6px; margin: 14px 0 12px; }
      .tab {
        flex: 1; padding: 10px 0; background: var(--panel); color: var(--muted);
        border: 1px solid var(--chalk); border-radius: 10px; font-family: 'Barlow Condensed', sans-serif;
        font-weight: 600; font-size: 16px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
      }
      .tab.on { background: var(--gold); color: #2B2410; border-color: var(--gold); }

      .status {
        background: var(--panel2); border: 1px solid var(--chalk); border-radius: 10px;
        padding: 10px 12px; font-size: 14px; margin-bottom: 12px;
      }
      .empty { color: var(--muted); padding: 30px 10px; text-align: center; }
      .hint { color: var(--muted); font-size: 13px; margin: 8px 2px 12px; line-height: 1.45; }
      .muted { color: var(--muted); font-size: 13px; }

      /* Leaderboard */
      .board { border: 1px solid var(--chalk); border-radius: 12px; overflow: hidden; }
      .updated-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding: 0 2px; }
      .updated-txt { color: var(--muted); font-size: 12px; }
      .board-row {
        display: grid; grid-template-columns: 34px 1fr 30px repeat(5, 34px) 50px 46px;
        align-items: center; padding: 10px 10px; border-bottom: 1px solid var(--chalk);
        background: var(--panel);
      }
      .cell.champ { font-size: 17px; }
      .cell.champ.out { opacity: .3; filter: grayscale(1); }
      .board-row:last-child { border-bottom: none; }
      .board-row.head { background: transparent; color: var(--muted); font-size: 12px;
        text-transform: uppercase; letter-spacing: .08em; }
      .board-row.leader { background: linear-gradient(90deg, rgba(240,194,75,.18), rgba(240,194,75,.04)); }
      .board-row.leader .pname, .board-row.leader .total { color: var(--gold); }
      .pos { text-align: center; }
      .pname { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pname-link {
        background: none; border: none; padding: 0; margin: 0; text-align: left; cursor: pointer;
        color: var(--text); font-family: inherit; max-width: 100%;
        text-decoration: underline; text-decoration-color: var(--chalk);
        text-underline-offset: 3px; text-decoration-thickness: 1px;
      }
      .pname-link:hover { color: var(--gold); text-decoration-color: var(--gold); }
      .pname-link:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; border-radius: 3px; }
      .board-row.leader .pname-link { color: var(--gold); }
      .cell { text-align: center; font-variant-numeric: tabular-nums; font-size: 14px; }
      .cell.total { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 20px; }
      .cell.maxcol { color: var(--muted); font-size: 13px; }

      .ghost-btn {
        margin-top: 12px; background: transparent; border: 1px solid var(--chalk); color: var(--text);
        border-radius: 9px; padding: 8px 14px; font-size: 13px; cursor: pointer;
      }
      .ghost-btn.danger { color: var(--no); border-color: rgba(229,101,94,.4); }
      .ghost-btn.gold { color: var(--gold); border-color: rgba(240,194,75,.5); }
      .ghost-btn:disabled { opacity: .5; }

      .scoring { margin-top: 10px; background: var(--panel); border: 1px solid var(--chalk);
        border-radius: 12px; padding: 12px; font-size: 13px; color: var(--muted); }
      .score-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .score-grid label { display: flex; flex-direction: column; gap: 4px; color: var(--text);
        font-family: 'Barlow Condensed', sans-serif; font-weight: 600; }
      .score-grid input {
        width: 58px; padding: 6px; background: var(--pitch); color: var(--text);
        border: 1px solid var(--chalk); border-radius: 8px; font-size: 15px; text-align: center;
      }

      /* Player chips */
      .chip-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
      .chip {
        background: var(--panel); border: 1px solid var(--chalk); color: var(--text);
        border-radius: 999px; padding: 7px 14px; font-size: 14px; cursor: pointer;
      }
      .chip.on { background: var(--gold); color: #2B2410; border-color: var(--gold); font-weight: 600; }
      .chip.add { border-style: dashed; color: var(--muted); }
      .add-form { display: inline-flex; gap: 6px; align-items: center; }
      .add-form input {
        background: var(--pitch); border: 1px solid var(--chalk); color: var(--text);
        border-radius: 999px; padding: 7px 12px; font-size: 14px; width: 130px;
      }

      .bracket-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
      .bracket-bar .ghost-btn { margin-top: 0; }
      .bar-actions { display: flex; gap: 8px; }

      .legend { display: flex; gap: 14px; color: var(--muted); font-size: 12px; margin: 8px 2px 12px; }
      .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
      .dot.ok { background: var(--ok); } .dot.no { background: var(--no); } .dot.pk { background: var(--gold); }

      /* Bracket grid */
      .bracket-scroll { overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
      .bracket { display: flex; gap: 14px; min-width: 820px; }
      .round-col { display: flex; flex-direction: column; width: 158px; flex-shrink: 0; }
      .round-head {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: .1em;
        text-transform: uppercase; font-size: 12px; color: var(--gold); text-align: center; padding: 4px 0 8px;
        position: sticky; top: 0;
      }
      .round-head.inline { text-align: left; padding: 14px 0 8px; position: static; }
      .round-matches { display: flex; flex-direction: column; justify-content: space-around; flex: 1; gap: 10px; }
      .match {
        background: var(--panel); border: 1px solid var(--chalk); border-radius: 10px; overflow: hidden;
      }
      .team-row {
        display: flex; align-items: center; gap: 7px; padding: 7px 9px; font-size: 13px;
        border-bottom: 1px solid var(--chalk); min-height: 34px;
      }
      .team-row:last-child { border-bottom: none; }
      .team-row.big { font-size: 15px; padding: 10px 12px; }
      .team-row .flag { width: 20px; text-align: center; }
      .team-row .tname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .team-row .mark { font-size: 12px; font-weight: 700; }
      .mark.ok { color: var(--ok); } .mark.no { color: var(--no); } .mark.pick { color: var(--gold); font-size: 9px; }
      .team-row .goals {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 17px;
        min-width: 18px; text-align: center; color: var(--muted); font-variant-numeric: tabular-nums;
      }
      .team-row .goals.gw { color: var(--text); }
      .pens-note {
        padding: 5px 12px; font-size: 11px; color: var(--gold); background: rgba(240,194,75,.08);
        border-top: 1px solid var(--chalk); text-transform: uppercase; letter-spacing: .05em;
      }
      .blurb {
        padding: 8px 12px; font-size: 12.5px; line-height: 1.4; color: var(--muted);
        font-style: italic; border-top: 1px solid var(--chalk);
      }
      .team-row.picked { background: rgba(240,194,75,.14); }
      .team-row.correct { background: rgba(86,208,140,.16); }
      .team-row.correct .tname { color: var(--ok); font-weight: 600; }
      .team-row.wrong { background: rgba(229,101,94,.13); }
      .team-row.wrong .tname { color: var(--no); text-decoration: line-through; }
      .team-row.tappable { cursor: pointer; }
      .team-row.tappable:hover { background: var(--panel2); }
      .team-row.tappable:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
      .team-row.picked.tappable:hover { background: rgba(240,194,75,.22); }

      /* Results tab */
      .result-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
      .match.wide { width: 100%; }

      @media (max-width: 480px) {
        .board-row { grid-template-columns: 20px 1fr 20px repeat(5, 20px) 32px 30px; padding: 10px 5px; }
        .cell { font-size: 11px; }
        .cell.total { font-size: 16px; }
        .cell.maxcol { font-size: 11px; }
        .cell.champ { font-size: 15px; }
        .pname { font-size: 13px; }
        .tab { font-size: 14px; padding: 9px 0; }
        .bracket { min-width: 780px; }
        .round-col { width: 148px; }
      }

      .foot { margin-top: 26px; text-align: center; color: var(--muted); font-size: 12px; }

      @media (prefers-reduced-motion: no-preference) {
        .tab, .chip, .team-row, .ghost-btn { transition: background .15s ease, color .15s ease; }
      }
    `}</style>
  );
}
