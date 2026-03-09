// =============================================================================
// script.js — Unified shared module for F1 Predictions
// =============================================================================

document.addEventListener("touchstart", function() {}, false);

// =============================================================================
// SECTION 1 — FORM CONFIGURATION & DATA FETCHING
// =============================================================================

export async function fetchFormConfiguration() {
    try {
        const { data, error } = await supabase
            .from('form_configuration')
            .select('*')
            .order('id', { ascending: true });
        if (error) { console.error('Error fetching form configuration:', error); return []; }
        return data.filter(config => config.enabled !== false);
    } catch (err) { console.error('Unexpected error:', err); return []; }
}

export async function fetchData(table, fields = '*') {
    try {
        const { data, error } = await supabase.from(table).select(fields);
        if (error) { console.error(`Error fetching ${table}:`, error); return []; }
        return data || [];
    } catch (err) { console.error(`Unexpected error fetching ${table}:`, err); return []; }
}

// =============================================================================
// SECTION 2 — SHARED DATA & COLOUR HELPERS (used across multiple pages)
// =============================================================================

/** Fetch all rows from a Supabase table. Throws on error. */
export async function getTable(tableName) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) { console.error(`Error fetching ${tableName}:`, error); throw error; }
    return data;
}

/** Get the current season year from form_details. */
export async function getCurrentYear() {
    const { data } = await supabase.from('form_details').select('current_year').eq('id', 1).single();
    return data?.current_year;
}

/** Fetch the currently logged-in player's full record, or null. */
export async function getCurrentUser() {
    const playerId = getCookie('playerId');
    if (!playerId) return null;
    const { data, error } = await supabase.from('players').select('*').eq('id', playerId).single();
    return error ? null : data;
}

export function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const bigint = parseInt(hex, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

export function getContrastTextColor(backgroundColor) {
    const { r, g, b } = hexToRgb(backgroundColor);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000' : '#fff';
}

export function getUserBackgroundColor(name, avatar_settings) {
    if (avatar_settings?.backgroundColor) return avatar_settings.backgroundColor;
    if (!name?.length) return '#52c1fa';
    return getColorForLetter(name.charAt(0).toUpperCase());
}

export function normalizeAvatarSettings(avatar_settings) {
    if (!avatar_settings) return null;
    if (typeof avatar_settings === 'string') { try { return JSON.parse(avatar_settings); } catch { return null; } }
    return avatar_settings;
}

/**
 * Colour all th.your-results-header cells inside a given table element
 * using the logged-in player's avatar background colour.
 * @param {HTMLElement} tableEl  - the <table> element to search within
 * @param {object}      user     - player record with .name and .avatar_settings
 */
export function applyHeaderColor(tableEl, user) {
    if (!tableEl || !user) return;
    const bg = getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings));
    const fg = getContrastTextColor(bg);
    tableEl.querySelectorAll('th.your-results-header').forEach(el => {
        el.style.backgroundColor = bg;
        el.style.color = fg;
    });
}

// =============================================================================
// SECTION 3 — RACE DROPDOWN HELPER
// =============================================================================

/**
 * Populate a <select> element with races from team_scoring_{year}.
 * Selects the last (most recent) race by default.
 * @param {HTMLSelectElement} selectEl
 * @param {number|string}     year
 */
export async function populateRaceDropdown(selectEl, year) {
    const { data, error } = await supabase
        .from(`team_scoring_${year}`)
        .select('race_number, race_name');
    if (error) { console.error('Error fetching race options:', error.message); return; }

    const raceMap = {};
    data.forEach(r => { if (r.race_number != null && r.race_name) raceMap[r.race_number] = r.race_name; });
    const races = Object.keys(raceMap)
        .map(n => ({ race_number: parseInt(n, 10), race_name: raceMap[n] }))
        .sort((a, b) => a.race_number - b.race_number);

    selectEl.innerHTML = '';
    races.forEach(race => {
        const opt = document.createElement('option');
        opt.value = race.race_number;
        opt.textContent = `Race ${race.race_number}: ${race.race_name} GP`;
        selectEl.appendChild(opt);
    });
    if (races.length > 0) selectEl.value = races[races.length - 1].race_number;
}

// =============================================================================
// SECTION 4 — RACE RESULTS: PLAYER TABLE
// =============================================================================

/**
 * Build and render the player race results table, podium, and "your results" box.
 *
 * @param {object} config
 * @param {number|string} config.year          - season year
 * @param {number|string} config.raceNumber    - race number to display
 * @param {HTMLElement}   config.tableEl       - <table> element to populate
 * @param {Array}         config.drivers       - drivers rows from DB
 * @param {Array}         config.constructors  - constructors rows from DB
 * @param {object|null}   config.podium        - null = skip podium; or object with:
 *                                               { firstNamesEl, secondNamesEl, thirdNamesEl,
 *                                                 firstScoreEl, secondScoreEl, thirdScoreEl,
 *                                                 containerEl }
 * @param {object|null}   config.yourResults   - null = skip; or { boxEl, contentEl }
 * @param {HTMLElement|null} config.lowestEl   - element to show "did not play" text
 * @param {HTMLElement|null} config.toggleEl   - "Show Detailed Scoring" checkbox
 * @param {HTMLElement|null} config.pinBothEl  - "Pin both" checkbox to enable/disable
 * @returns {Promise<void>}
 */
export async function buildRaceResultsPlayerTable(config) {
    const {
        year, raceNumber, tableEl,
        drivers, constructors,
        podium = null,
        yourResults = null,
        lowestEl = null,
        toggleEl = null,
        pinBothEl = null,
    } = config;

    const currentUserId = getCookie('playerId');

    const { data: formResponses, error: frErr } = await supabase
        .from(`form_responses_${year}`)
        .select('*')
        .eq('race_number', raceNumber);
    if (frErr) { console.error(frErr.message); return; }

    const questions    = formResponses.find(r => r.entry_type === 'questions');
    const results      = formResponses.find(r => r.entry_type === 'results');
    let   players      = formResponses.filter(r => r.entry_type === 'player');
    const lowestScores = formResponses.filter(r => r.entry_type === 'player_lowest_score');

    // Move current user to front
    let userResultPulled = false;
    if (currentUserId) {
        const idx = players.findIndex(p => p.player_id == currentUserId);
        if (idx !== -1) { userResultPulled = true; const [up] = players.splice(idx, 1); players.unshift(up); }
    }

    // Merge avatar_settings onto player rows
    const { data: playersData } = await supabase.from('players').select('id, avatar_settings, name');
    const pm = {};
    (playersData || []).forEach(p => { pm[p.id] = p; });
    players = players.map(p => ({ ...p, ...pm[p.player_id] }));

    if (pinBothEl) pinBothEl.disabled = !userResultPulled;

    // ── Build table ──
    tableEl.innerHTML = '';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const thName = document.createElement('th'); thName.textContent = 'Name'; headerRow.appendChild(thName);
    const resultsTh = document.createElement('th'); resultsTh.textContent = 'Results'; headerRow.appendChild(resultsTh);
    players.forEach(player => {
        const th = document.createElement('th');
        th.textContent = player.player_name;
        if (currentUserId && player.player_id == currentUserId) th.classList.add('your-results-header');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');

    function createRow(id, label) {
        const isTotalCol = ['subtotal_1','subtotal_2','subtotal_3','subtotal_4','grand_total'].includes(id);
        if (isTotalCol) {
            const row = document.createElement('tr');
            const tdL = document.createElement('td'); tdL.textContent = label; row.appendChild(tdL);
            row.appendChild(document.createElement('td')); // empty Results cell for total rows
            players.forEach(player => {
                const td = document.createElement('td');
                td.textContent = player[id];
                td.className = `${id}_score`;
                td.dataset.playerId = player.player_id;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        } else if (results && results[`form_id_${id}`] !== null) {
            const row = document.createElement('tr');
            const tdL = document.createElement('td'); tdL.textContent = label; row.appendChild(tdL);
            const rt = document.createElement('td'); rt.textContent = results[`form_id_${id}`]; row.appendChild(rt);
            players.forEach(player => {
                const td = document.createElement('td');
                td.textContent = player[`form_id_${id}`];
                td.className = `form_id_${id}_score`;
                td.dataset.playerId = player.player_id;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        }
    }

    const addSpacer = () => {
        const r = document.createElement('tr');
        const c = document.createElement('td'); c.colSpan = players.length + 2; r.appendChild(c);
        r.classList.add('spacer-row');
        tbody.appendChild(r);
    };

    for (let i = 2; i <= 7; i++)  createRow(i, questions[`form_id_${i}`]);
    createRow('subtotal_2', 'Subtotal'); addSpacer();
    for (let i = 8; i <= 27; i++) createRow(i, questions[`form_id_${i}`]);
    createRow('subtotal_3', 'Subtotal'); addSpacer();
    createRow(28, questions[`form_id_28`]); addSpacer();
    createRow('grand_total', 'Grand Total');
    tableEl.appendChild(tbody);

    // ── Colour formatting ──
    const applyFmt = (cell, value) => {
        if (/^[A-Z]{3}$/.test(value)) {
            const drv = drivers?.find(d => d.abbreviation === value);
            if (drv) {
                const ctor = constructors?.find(c => c.id === drv.constructor_id);
                if (ctor) { cell.style.backgroundColor = ctor.background_colour; cell.style.color = ctor.text_colour; }
            }
        } else if (value === 'Yes') { cell.style.color = 'green'; }
          else if (value === 'No')  { cell.style.color = 'red'; }
          else {
            const ctor = constructors?.find(c => c.name === value);
            if (ctor) { cell.style.backgroundColor = ctor.background_colour; cell.style.color = ctor.text_colour; }
        }
    };
    tableEl.querySelectorAll('tbody td').forEach(cell => applyFmt(cell, cell.textContent));

    // ── Highlight highest scores ──
    const highlightHighest = (cells, colors) => {
        const items = cells.map(c => ({ cell: c, value: parseFloat(c.textContent) })).filter(i => !isNaN(i.value));
        items.sort((a, b) => b.value - a.value);
        let rank = 1, prev = null, cnt = 0;
        items.forEach(i => { if (prev !== null && i.value !== prev) rank = cnt + 1; i.rank = rank; prev = i.value; cnt++; });
        items.forEach(i => { if (i.rank <= colors.length) { i.cell.style.backgroundColor = colors[i.rank - 1]; i.cell.style.color = 'black'; } });
    };
    highlightHighest(Array.from(tableEl.querySelectorAll('td.subtotal_2_score')), ['lightyellow']);
    highlightHighest(Array.from(tableEl.querySelectorAll('td.subtotal_3_score')), ['lightyellow']);
    highlightHighest(Array.from(tableEl.querySelectorAll('td.grand_total_score')), ['gold', 'silver', '#cd7f32']);
    tableEl.querySelectorAll('td.form_id_28_score').forEach(cell => {
        const p = players.find(p => p.player_id == cell.dataset.playerId);
        if (p?.form_id_28_score === 1) { cell.style.backgroundColor = 'lightyellow'; cell.style.color = 'black'; }
    });

    // ── Podium ──
    if (podium) {
        const grandTotals = players
            .map(p => ({ id: p.player_id, name: p.player_name, total: parseFloat(p.grand_total), avatar_settings: p.avatar_settings }))
            .sort((a, b) => b.total - a.total);

        const getMedalIcon = r =>
            r === 1 ? '<img src="/media/awards/medal_first.png" class="medal-icon">' :
            r === 2 ? '<img src="/media/awards/medal_second.png" class="medal-icon">' :
            r === 3 ? '<img src="/media/awards/medal_third.png" class="medal-icon">' : '';

        let topPlayers = [], rank = 1, prevScore = null, cnt = 0, lastValidRank = 1;
        for (let i = 0; i < grandTotals.length; i++) {
            const p = grandTotals[i];
            if (prevScore !== null && p.total !== prevScore) {
                rank = cnt + 1;
                if (rank > 3 && lastValidRank !== 3) break;
                lastValidRank = rank;
            }
            if (rank <= 3) topPlayers.push({ ...p, rank }); else break;
            prevScore = p.total; cnt++;
        }
        const podiumGroups = { 1: [], 2: [], 3: [] };
        topPlayers.forEach(p => { if (podiumGroups[p.rank]) podiumGroups[p.rank].push(p); });

        if (podium.firstScoreEl  && podiumGroups[1][0]) podium.firstScoreEl.textContent  = `${podiumGroups[1][0].total} pts`;
        if (podium.secondScoreEl && podiumGroups[2][0]) podium.secondScoreEl.textContent = `${podiumGroups[2][0].total} pts`;
        if (podium.thirdScoreEl  && podiumGroups[3][0]) podium.thirdScoreEl.textContent  = `${podiumGroups[3][0].total} pts`;

        const genPodiumHTML = pl => pl.map(p =>
            `<div class="player-info"><div class="icons">${getMedalIcon(p.rank)}${createSmallAvatarHTML(p)}</div><div class="player-name">${p.name}</div></div>`
        ).join('');
        if (podium.firstNamesEl)  podium.firstNamesEl.innerHTML  = genPodiumHTML(podiumGroups[1]);
        if (podium.secondNamesEl) podium.secondNamesEl.innerHTML = genPodiumHTML(podiumGroups[2]);
        if (podium.thirdNamesEl)  podium.thirdNamesEl.innerHTML  = genPodiumHTML(podiumGroups[3]);
        if (podium.containerEl)   podium.containerEl.style.display = 'flex';
    }

    // ── Your results box ──
    if (yourResults && currentUserId && userResultPulled) {
        const userPlayer = players.find(p => p.player_id == currentUserId);
        const sortedTotals = [...players].map(p => parseFloat(p.grand_total)).sort((a, b) => b - a);
        const userRank = sortedTotals.indexOf(parseFloat(userPlayer?.grand_total)) + 1;
        if (userPlayer) {
            yourResults.boxEl.style.display = 'block';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${userRank}</strong></td>
                <td><div class="player-info"><div class="icons">${createSmallAvatarHTML(userPlayer)}</div><div class="player-name">${userPlayer.name}</div></div></td>
                <td>${userPlayer.grand_total ?? 0} pts</td>`;
            yourResults.contentEl.innerHTML = '';
            yourResults.contentEl.appendChild(row);
        }
    }

    // ── Toggle detailed scoring ──
    if (toggleEl) {
        const newToggle = toggleEl.cloneNode(true);
        toggleEl.parentNode.replaceChild(newToggle, toggleEl);
        newToggle.checked = false;
        newToggle.addEventListener('change', e => {
            const show = e.target.checked;
            tableEl.querySelectorAll('tbody td').forEach(cell => {
                const m = cell.className.match(/form_id_(\d+)_score/);
                if (m) {
                    const p = players.find(p => p.player_id == cell.dataset.playerId);
                    const score = p ? p[`form_id_${m[1]}_score`] : null;
                    if (score !== null) {
                        const base = cell.dataset.baseText || cell.textContent.split(' (')[0];
                        cell.dataset.baseText = base;
                        cell.textContent = show ? `${base} (${score})` : base;
                    }
                }
            });
        });
    }

    // ── Lowest scores text ──
    if (lowestEl) {
        lowestEl.textContent = lowestScores.length > 0
            ? `Did not play (receives lowest score): ${lowestScores.map(p => p.player_name).join(', ')}`
            : '';
    }

    // ── Header colour for logged-in user ──
    const user = await getCurrentUser();
    if (user) applyHeaderColor(tableEl, user);
}

// =============================================================================
// SECTION 5 — RACE RESULTS: TEAM TABLE
// =============================================================================

/**
 * Build and render the team race results table into tableEl.
 * The collapsible panel wrapper is handled by the calling page.
 *
 * @param {object} config
 * @param {number|string} config.year
 * @param {number|string} config.raceNumber
 * @param {HTMLElement}   config.tableEl
 */
export async function buildTeamResultsTable(config) {
    const { year, raceNumber, tableEl } = config;

    const { data: tsd, error } = await supabase
        .from(`team_scoring_${year}`)
        .select('*')
        .eq('race_number', raceNumber);
    if (error || !tsd?.length) {
        tableEl.innerHTML = '<tr><td class="text-muted p-3">No team scoring data for this race.</td></tr>';
        return;
    }

    tsd.sort((a, b) => b.grand_total - a.grand_total);

    let currentRank = 1, prevScore = null;
    const rankMap = {};
    tsd.forEach((team, i) => {
        if (prevScore === null || team.grand_total !== prevScore) currentRank = i + 1;
        rankMap[team.team_id] = currentRank;
        prevScore = team.grand_total;
    });

    const sortedTotals = [...new Set(tsd.map(t => t.grand_total))].sort((a, b) => b - a);
    const podiumBg = { [sortedTotals[0]]: 'gold', [sortedTotals[1]]: 'silver', [sortedTotals[2]]: '#cd7f32' };

    function cardsPlayedHTML(team) {
        if (team.casino_details?.trim()) return `<img src="/media/casino/casino.png" style="width:38px;height:auto;">`;
        let h = ''; const s = 'float:left;width:38px;height:51px;';
        if (team.card_aero_playedcol)      h += `<img src="/media/cards/card_aero.png" style="${s}">`;
        if (team.card_double_playedcol)    h += `<img src="/media/cards/card_double.png" style="${s}">`;
        if (team.card_halo_playedcol)      h += `<img src="/media/cards/card_halo.png" style="${s}">`;
        if (team.card_safetycar_playedcol) h += `<img src="/media/cards/card_safetycar.png" style="${s}">`;
        if (team.card_report_playedcol)    h += `<img src="/media/cards/card_report.png" style="${s}">`;
        if (team.card_swap_playedcol)      h += `<img src="/media/cards/card_swap.png" style="${s}">`;
        return h || '—';
    }

    function cardsAppliedHTML(team) {
        if (team.casino_details?.trim()) return `
            <img src="/media/casino/casino.png" style="display:block;width:80px;height:auto;margin-bottom:4px;">
            <div style="word-wrap:break-word;white-space:normal;font-size:0.75rem;">${team.casino_details}</div>`;
        let h = ''; const s = 'float:left;width:38px;height:51px;';
        const append = (n, name) => { for (let i = 0; i < (n || 0); i++) h += `<img src="/media/cards/card_${name}.png" style="${s}">`; };
        append(team.card_aero_applied, 'aero');       append(team.card_double_applied, 'double');
        append(team.card_halo_applied, 'halo');       append(team.card_report_applied, 'report');
        append(team.card_safetycar_applied, 'safetycar'); append(team.card_swap_applied, 'swap');
        if (team.card_report_details) h += `<div style="clear:both;word-wrap:break-word;white-space:normal;font-size:0.75rem;">${team.card_report_details}</div>`;
        if (team.card_swap_details)   h += `<div style="clear:both;word-wrap:break-word;white-space:normal;font-size:0.75rem;">${team.card_swap_details}</div>`;
        return h || '—';
    }

    const delta = t => (t.card_points_delta >= 0 ? '+' : '') + t.card_points_delta;

    let html = `<thead><tr>
        <th>Rank</th><th>Team</th>
        <th>Player 1</th><th>P1 Pts</th>
        <th>Player 2</th><th>P2 Pts</th>
        <th>Sub-total</th><th>Cards Played</th>
        <th>Cards Applied / Casino</th>
        <th>Bonus / Penalty</th><th>Total</th>
    </tr></thead><tbody>`;

    tsd.forEach(team => {
        const rank = rankMap[team.team_id];
        const bg   = podiumBg[team.grand_total] || '';
        const totalStyle = bg ? `background-color:${bg};color:black;font-weight:bold;` : 'font-weight:bold;';
        html += `<tr>
            <td>${rank}</td>
            <td><strong>${team.team_name}</strong></td>
            <td>${team.player_name_1}</td><td>${team.player_points_1}</td>
            <td>${team.player_name_2}</td><td>${team.player_points_2}</td>
            <td>${team.subtotal}</td>
            <td style="white-space:normal;min-width:44px;">${cardsPlayedHTML(team)}</td>
            <td style="white-space:normal;min-width:80px;">${cardsAppliedHTML(team)}</td>
            <td>${delta(team)}</td>
            <td style="${totalStyle}">${team.grand_total}</td>
        </tr>`;
    });
    html += '</tbody>';
    tableEl.innerHTML = html;

    // ── Highlight logged-in user's team ──
    const user = await getCurrentUser();
    if (user?.participant_team_id) {
        const bg = getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings));
        const fg = getContrastTextColor(bg);
        const matchingTeam = tsd.find(t => t.team_id === user.participant_team_id);
        if (matchingTeam) {
            tableEl.querySelectorAll('tbody tr').forEach(row => {
                const teamCell = row.children[1];
                if (!teamCell) return;
                const teamName = teamCell.querySelector('strong')?.textContent?.trim();
                if (teamName === matchingTeam.team_name) {
                    teamCell.style.backgroundColor = bg;
                    teamCell.style.color = fg;
                }
            });
        }
    }
}

// =============================================================================
// SECTION 6 — SEASON PLAYER TABLE
// =============================================================================

/**
 * Build and render the season player standings table.
 *
 * @param {object} config
 * @param {number|string} config.year
 * @param {HTMLElement}   config.tableEl
 * @param {boolean}       [config.detailed=true]  - true = show all race columns;
 *                                                   false = rank / name / total only
 */
export async function buildSeasonPlayerTable(config) {
    const { year, tableEl, detailed = true } = config;

    const seasonData = await getTable(`season_player_${year}`);
    if (!seasonData?.length) {
        tableEl.innerHTML = '<tr><td colspan="3">No season data available.</td></tr>';
        return;
    }

    const { data: playersData } = await supabase.from('players').select('id, avatar_settings, name');
    const pm = {};
    (playersData || []).forEach(p => { pm[p.id] = p; });

    const raceNamesRow = seasonData.find(r => r.player_id === 0);
    if (!raceNamesRow) { tableEl.innerHTML = '<tr><td colspan="3">No race names row found.</td></tr>'; return; }

    let lastRace = 0;
    for (let i = 1; i <= 32; i++) { if (raceNamesRow[`race_${i}`]) lastRace = i; else break; }
    if (!lastRace) { tableEl.innerHTML = '<tr><td colspan="3">No race scores available yet.</td></tr>'; return; }

    // Header
    let headerHTML = '<thead><tr><th>Rank</th><th>Player</th><th>Total</th>';
    if (detailed) {
        for (let i = 1; i <= lastRace; i++) headerHTML += `<th>${raceNamesRow[`race_${i}`]}</th>`;
    }
    headerHTML += '</tr></thead>';

    // Standings
    const playerRows = seasonData.filter(r => r.player_id !== 0);
    const standings = playerRows.map(row => {
        let total = 0, prevTotal = 0; const raceScores = [];
        for (let i = 1; i <= lastRace; i++) {
            const raw = row[`race_${i}`];
            if (raw !== null && raw !== '') {
                const num = parseFloat(raw.replace(/\(LS\)/, '').trim());
                raceScores.push(raw);
                if (!isNaN(num)) { total += num; if (i < lastRace) prevTotal += num; }
            } else { raceScores.push(''); }
        }
        const pd = pm[row.player_id] || {};
        return { player_id: row.player_id, player_name: row.player_name, total, prevTotal, raceScores, avatar_settings: pd.avatar_settings || null };
    }).sort((a, b) => b.total - a.total);

    let rank = 1, prevScore = null;
    const rankMap = {}, prevRankMap = {};
    standings.forEach((p, i) => {
        if (prevScore === null || p.total !== prevScore) rank = i + 1;
        rankMap[p.player_id] = rank; prevScore = p.total;
    });
    if (lastRace > 1) {
        const ps = [...standings].sort((a, b) => b.prevTotal - a.prevTotal);
        let r = 1, pp = null;
        ps.forEach((p, i) => { if (pp === null || p.prevTotal !== pp) r = i + 1; prevRankMap[p.player_id] = r; pp = p.prevTotal; });
    }

    let bodyHTML = '<tbody>';
    standings.forEach(player => {
        const cr = rankMap[player.player_id];
        const diff = lastRace > 1 && prevRankMap[player.player_id] !== undefined ? prevRankMap[player.player_id] - cr : null;
        const movement = diff === null ? '' : diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '(=)';

        bodyHTML += `<tr>
            <td>${cr} ${movement}</td>
            <td><div class="d-flex align-items-center">${createSmallAvatarHTML({ name: player.player_name, avatar_settings: player.avatar_settings })}<span>${player.player_name}</span></div></td>
            <td>${player.total}</td>`;
        if (detailed) {
            player.raceScores.forEach(score => { bodyHTML += `<td>${score}</td>`; });
        }
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';

    tableEl.innerHTML = headerHTML + bodyHTML;
    tableEl.querySelectorAll('thead th').forEach(c => { c.style.textAlign = 'center'; });

    if (detailed) {
        // Grey out (LS) cells and colour top 3 per race column
        tableEl.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            for (let j = 3; j < cells.length; j++) {
                if (cells[j].textContent.includes('(LS)')) {
                    cells[j].textContent = cells[j].textContent.replace(/\(LS\)/, '').trim();
                    cells[j].style.color = 'grey';
                }
            }
        });
        const numCols = tableEl.querySelector('thead tr').children.length;
        for (let col = 3; col < numCols; col++) {
            const colCells = Array.from(tableEl.querySelectorAll(`tbody tr td:nth-child(${col + 1})`));
            const values   = colCells.map(c => parseFloat(c.textContent.trim())).filter(v => !isNaN(v));
            // const sorted   = [...new Set(values)].sort((a, b) => b - a);
            const colors   = ['gold', 'silver', '#cd7f32'];
            colCells.forEach(cell => {
                const v = parseFloat(cell.textContent.trim());
                if (!isNaN(v)) {
                    const rank = values.filter(s => s > v).length;
                    if (rank < 3) { cell.style.backgroundColor = colors[rank]; if (cell.style.color !== 'grey') cell.style.color = 'black'; }
                }
            });
        }
    }

    // Highlight logged-in player row in name column
    const user = await getCurrentUser();
    if (user) {
        const bg = getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings));
        const fg = getContrastTextColor(bg);
        tableEl.querySelectorAll('tbody tr').forEach(row => {
            const nameCell = row.children[1];
            if (!nameCell) return;
            const renderedName = (nameCell.querySelector('span')?.textContent || nameCell.textContent || '').trim();
            if (renderedName === user.name) {
                nameCell.style.backgroundColor = bg; nameCell.style.color = fg; nameCell.style.fontWeight = '600';
            }
        });
    }
}

// =============================================================================
// SECTION 7 — SEASON TEAM TABLE
// =============================================================================

/**
 * Build and render the season team standings table.
 *
 * @param {object} config
 * @param {number|string} config.year
 * @param {HTMLElement}   config.tableEl
 * @param {boolean}       [config.detailed=true]  - true = show all race columns with card icons;
 *                                                   false = rank / team / total only
 */
export async function buildSeasonTeamTable(config) {
    const { year, tableEl, detailed = true } = config;

    const seasonTeamData = await getTable(`season_team_${year}`);
    if (!seasonTeamData?.length) {
        tableEl.innerHTML = '<tr><td colspan="3">No season team data available.</td></tr>';
        return;
    }

    const raceNamesRow = seasonTeamData.find(r => r.team_id === 0);
    if (!raceNamesRow) { tableEl.innerHTML = '<tr><td colspan="3">No race names row found.</td></tr>'; return; }

    let lastRace = 0;
    for (let i = 1; i <= 32; i++) { if (raceNamesRow[`race_${i}`]) lastRace = i; else break; }
    if (!lastRace) { tableEl.innerHTML = '<tr><td colspan="3">No race scores available yet.</td></tr>'; return; }

    let headerHTML = '<thead><tr><th>Rank</th><th>Team</th><th>Total</th>';
    if (detailed) {
        for (let i = 1; i <= lastRace; i++) headerHTML += `<th>${raceNamesRow[`race_${i}`]}</th>`;
    }
    headerHTML += '</tr></thead>';

    const teamRows = seasonTeamData.filter(r => r.team_id !== 0);
    const standings = teamRows.map(row => {
        let total = 0, prevTotal = 0; const raceScores = [];
        for (let i = 1; i <= lastRace; i++) {
            const raw = row[`race_${i}`];
            if (raw !== null && raw !== '') {
                const num = parseFloat(raw.replace(/\(.*?\)/g, '').trim());
                raceScores.push(raw);
                if (!isNaN(num)) { total += num; if (i < lastRace) prevTotal += num; }
            } else { raceScores.push(''); }
        }
        return { team_id: row.team_id, team_name: row.team_name, total, prevTotal, raceScores };
    }).sort((a, b) => b.total - a.total);

    let rank = 1, prevScore = null;
    const rankMap = {}, prevRankMap = {};
    standings.forEach((t, i) => {
        if (prevScore === null || t.total !== prevScore) rank = i + 1;
        rankMap[t.team_id] = rank; prevScore = t.total;
    });
    if (lastRace > 1) {
        const ps = [...standings].sort((a, b) => b.prevTotal - a.prevTotal);
        let r = 1, pp = null;
        ps.forEach((t, i) => { if (pp === null || t.prevTotal !== pp) r = i + 1; prevRankMap[t.team_id] = r; pp = t.prevTotal; });
    }

    const { data: players } = await supabase.from('players').select('id, name, participant_team_id');

    function processTeamRaceScore(raw) {
        if (!raw) return '';
        const numStr = raw.replace(/\(.*?\)/g, '').trim();
        let output = '';
        const cardTags = []; const regex = /\(([^)]+)\)/g; let match;
        while ((match = regex.exec(raw)) !== null) {
            const tag = match[1].toLowerCase();
            if (['aero','double','safetycar','halo','report','swap','casino'].includes(tag)) cardTags.push(tag);
        }
        if (cardTags.includes('casino')) {
            output += `<div style="word-wrap:break-word;">${numStr}</div>`;
            output += `<div style="margin-top:2px;"><img src="/media/casino/casino.png" style="width:50px;height:auto;"></div>`;
        } else {
            output += `<div style="word-wrap:break-word;">${numStr}</div>`;
            if (cardTags.length) {
                output += `<div style="margin-top:2px;">`;
                cardTags.forEach(tag => {
                    output += `<img src="/media/cards/card_${tag}.png" style="width:22px;height:30px;margin-right:1px;">`;
                });
                output += `</div>`;
            }
        }
        return output;
    }

    let bodyHTML = '<tbody>';
    standings.forEach(team => {
        const cr = rankMap[team.team_id];
        const diff = prevRankMap[team.team_id] !== undefined ? prevRankMap[team.team_id] - cr : null;
        const movement = diff === null ? '' : diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '(=)';
        const tp = (players || []).filter(p => p.participant_team_id === team.team_id).map(p => p.name).join(', ');
        bodyHTML += `<tr data-team-id="${team.team_id}">
            <td>${cr} ${movement}</td>
            <td><b>${team.team_name}</b>${tp ? '<br>' + tp : ''}</td>
            <td>${team.total}</td>`;
        if (detailed) {
            team.raceScores.forEach(score => { bodyHTML += `<td>${processTeamRaceScore(score)}</td>`; });
        }
        bodyHTML += '</tr>';
    });
    bodyHTML += '</tbody>';

    tableEl.innerHTML = headerHTML + bodyHTML;
    tableEl.querySelectorAll('thead th').forEach(c => { c.style.textAlign = 'center'; });

    if (detailed) {
        // Grey out LS and colour top 3 per column
        tableEl.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            for (let j = 3; j < cells.length; j++) {
                if (cells[j].textContent.includes('(LS)')) {
                    cells[j].textContent = cells[j].textContent.replace(/\(LS\)/, '').trim();
                    cells[j].style.color = 'grey';
                }
            }
        });
        const numCols = tableEl.querySelector('thead tr').children.length;
        for (let col = 3; col < numCols; col++) {
            const colCells = Array.from(tableEl.querySelectorAll(`tbody tr td:nth-child(${col + 1})`));
            const values   = colCells.map(c => parseFloat(c.textContent.trim())).filter(v => !isNaN(v));
            // const sorted   = [...new Set(values)].sort((a, b) => b - a);
            const colors   = ['gold', 'silver', '#cd7f32'];
            colCells.forEach(cell => {
                const v = parseFloat(cell.textContent.trim());
                if (!isNaN(v)) {
                    const rank = values.filter(s => s > v).length;
                    if (rank < 3) { cell.style.backgroundColor = colors[rank]; if (cell.style.color !== 'grey') cell.style.color = 'black'; }
                }
            });
        }
    }

    // Highlight logged-in user's team
    const user = await getCurrentUser();
    if (user?.participant_team_id) {
        const bg = getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings));
        const fg = getContrastTextColor(bg);
        tableEl.querySelectorAll('tbody tr').forEach(row => {
            if (Number(row.dataset.teamId) === Number(user.participant_team_id)) {
                const teamCell = row.children[1];
                if (teamCell) { teamCell.style.backgroundColor = bg; teamCell.style.color = fg; }
            }
        });
    }
}

// =============================================================================
// SECTION 8 — CHARTS
// =============================================================================

const FULL_COLORS = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#46f0f0','#f032e6','#bcf60c','#fabebe','#008080','#e6beff','#9a6324','#fffac8','#800000','#aaffc3','#808000','#ffd8b1','#000075','#808080'];
const GREY_SHADES = ['#bbbbbb','#aaaaaa','#999999','#888888','#777777','#666666','#b0b0b0','#c0c0c0','#a0a0a0','#909090','#d0d0d0','#707070','#808080','#606060','#505050','#404040','#c8c8c8','#d8d8d8','#787878','#686868'];

// Each page keeps its own chartInstances map and passes the canvas/toggle refs in.

function _lineColor(highlightMode, isSelf, selfColor, gi, fi) {
    return !highlightMode ? FULL_COLORS[fi % FULL_COLORS.length]
        : isSelf ? selfColor
        : GREY_SHADES[gi % GREY_SHADES.length];
}

/**
 * Render (or re-render) the player standings line chart.
 *
 * @param {object} config
 * @param {number|string}       config.year
 * @param {HTMLCanvasElement}   config.canvasEl
 * @param {HTMLElement|null}    config.toggleEl           - highlight-my-line checkbox
 * @param {HTMLElement|null}    config.toggleContainerEl  - wrapper div to show/hide
 * @param {object}              config.chartInstances     - caller-owned map; keyed by canvasEl.id
 */
export async function renderSeasonPlayerChart(config) {
    const { year, canvasEl, toggleEl = null, toggleContainerEl = null, chartInstances } = config;
    if (!canvasEl) return;

    try {
        const seasonData = await getTable(`season_player_${year}`);
        if (!seasonData?.length) return;

        const rnRow = seasonData.find(r => r.player_id === 0);
        let lastRace = 0; const raceLabels = [];
        for (let i = 1; i <= 32; i++) {
            const v = rnRow?.[`race_${i}`];
            if (v) { raceLabels.push(v.replace(/\(LS\)/g, '').trim()); lastRace = i; } else break;
        }
        if (!lastRace) return;

        const playerRows = seasonData.filter(r => r.player_id !== 0);
        const cumScores = {};
        playerRows.forEach(p => {
            let sum = 0; const cum = [];
            for (let i = 1; i <= lastRace; i++) {
                const s = parseFloat((p[`race_${i}`] || '').replace(/\(LS\)/g, '').trim());
                if (!isNaN(s)) sum += s; cum.push(sum);
            }
            cumScores[p.player_id] = { player_name: p.player_name, cumulative: cum };
        });

        const rankings = {}; playerRows.forEach(p => { rankings[p.player_id] = []; });
        for (let ri = 0; ri < lastRace; ri++) {
            const sorted = playerRows.map(p => ({ player_id: p.player_id, score: cumScores[p.player_id].cumulative[ri] }))
                .sort((a, b) => b.score - a.score);
            let r = 1, prev = null;
            sorted.forEach((item, i) => { if (prev === null || item.score !== prev) r = i + 1; rankings[item.player_id].push(r); prev = item.score; });
        }

        const user      = await getCurrentUser();
        const uid       = user?.id ?? null;
        const selfColor = uid ? getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings)) : null;
        const highlight = uid && toggleEl?.checked;
        if (toggleContainerEl) toggleContainerEl.style.display = uid ? 'block' : 'none';

        const sorted = [...playerRows].sort((a, b) => a.player_name.localeCompare(b.player_name));
        let gi = 0, fi = 0;
        const datasets = sorted.map(p => {
            const isSelf = p.player_id === uid;
            const color  = _lineColor(highlight, isSelf, selfColor, gi, fi);
            if (!isSelf) gi++; fi++;
            return { label: p.player_name, data: rankings[p.player_id], fill: false, borderColor: color, backgroundColor: color, borderWidth: isSelf && highlight ? 4 : 2, tension: 0, pointStyle: 'circle', pointRadius: isSelf && highlight ? 5 : 3, pointHoverRadius: 5, order: isSelf ? 0 : 1 };
        });

        const key = canvasEl.id;
        if (chartInstances[key]) chartInstances[key].destroy();
        chartInstances[key] = new Chart(canvasEl.getContext('2d'), {
            type: 'line',
            data: { labels: raceLabels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: 10 },
                plugins: {
                    title: { display: true, text: `Player Standings ${year}`, color: window.chartTheme.chartTextColor, font: { family: 'Helvetica', size: 20 } },
                    legend: { position: 'bottom', labels: { font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor } }
                },
                scales: {
                    y: { reverse: true, min: 1, max: playerRows.length, offset: true, ticks: { stepSize: 1, padding: 10, font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, title: { display: true, text: 'Rank', font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, grid: { color: window.chartTheme.chartGridColor } },
                    x: { ticks: { font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, grid: { color: window.chartTheme.chartGridColor } }
                }
            }
        });
    } catch (e) { console.error('Player chart error:', e); }
}

/**
 * Render (or re-render) the team standings line chart.
 *
 * @param {object} config
 * @param {number|string}       config.year
 * @param {HTMLCanvasElement}   config.canvasEl
 * @param {HTMLElement|null}    config.toggleEl
 * @param {HTMLElement|null}    config.toggleContainerEl
 * @param {object}              config.chartInstances
 */
export async function renderSeasonTeamChart(config) {
    const { year, canvasEl, toggleEl = null, toggleContainerEl = null, chartInstances } = config;
    if (!canvasEl) return;

    try {
        const seasonTeamData = await getTable(`season_team_${year}`);
        if (!seasonTeamData?.length) return;

        const rnRow = seasonTeamData.find(r => r.team_id === 0);
        let lastRace = 0; const raceLabels = [];
        for (let i = 1; i <= 32; i++) {
            const v = rnRow?.[`race_${i}`];
            if (v) { raceLabels.push(v.replace(/\(.*?\)/g, '').trim()); lastRace = i; } else break;
        }
        if (!lastRace) return;

        const teamRows = seasonTeamData.filter(r => r.team_id !== 0);
        const cumScores = {};
        teamRows.forEach(t => {
            let sum = 0; const cum = [];
            for (let i = 1; i <= lastRace; i++) {
                const s = parseFloat((t[`race_${i}`] || '').replace(/\(.*?\)/g, '').trim());
                if (!isNaN(s)) sum += s; cum.push(sum);
            }
            cumScores[t.team_id] = { team_name: t.team_name, cumulative: cum };
        });

        const rankings = {}; teamRows.forEach(t => { rankings[t.team_id] = []; });
        for (let ri = 0; ri < lastRace; ri++) {
            const sorted = teamRows.map(t => ({ team_id: t.team_id, score: cumScores[t.team_id].cumulative[ri] }))
                .sort((a, b) => b.score - a.score);
            let r = 1, prev = null;
            sorted.forEach((item, i) => { if (prev === null || item.score !== prev) r = i + 1; rankings[item.team_id].push(r); prev = item.score; });
        }

        const user      = await getCurrentUser();
        const utid      = user?.participant_team_id ?? null;
        const selfColor = utid ? getUserBackgroundColor(user.name, normalizeAvatarSettings(user.avatar_settings)) : null;
        const highlight = utid && toggleEl?.checked;
        if (toggleContainerEl) toggleContainerEl.style.display = utid ? 'block' : 'none';

        const sorted = [...teamRows].sort((a, b) => a.team_name.localeCompare(b.team_name));
        let gi = 0, fi = 0;
        const datasets = sorted.map(t => {
            const isSelf = t.team_id === utid;
            const color  = _lineColor(highlight, isSelf, selfColor, gi, fi);
            if (!isSelf) gi++; fi++;
            return { label: t.team_name, data: rankings[t.team_id], fill: false, borderColor: color, backgroundColor: color, borderWidth: isSelf && highlight ? 4 : 2, tension: 0, pointStyle: 'circle', pointRadius: isSelf && highlight ? 5 : 3, pointHoverRadius: 5, order: isSelf ? 0 : 1 };
        });

        const key = canvasEl.id;
        if (chartInstances[key]) chartInstances[key].destroy();
        chartInstances[key] = new Chart(canvasEl.getContext('2d'), {
            type: 'line',
            data: { labels: raceLabels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false, layout: { padding: 10 },
                plugins: {
                    title: { display: true, text: `Team Standings ${year}`, color: window.chartTheme.chartTextColor, font: { family: 'Helvetica', size: 20 } },
                    legend: { position: 'bottom', labels: { font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor } }
                },
                scales: {
                    y: { reverse: true, min: 1, max: teamRows.length, offset: true, ticks: { stepSize: 1, padding: 10, font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, title: { display: true, text: 'Rank', font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, grid: { color: window.chartTheme.chartGridColor } },
                    x: { ticks: { font: { family: 'Helvetica' }, color: window.chartTheme.chartTextColor }, grid: { color: window.chartTheme.chartGridColor } }
                }
            }
        });
    } catch (e) { console.error('Team chart error:', e); }
}

// =============================================================================
// SECTION 9 — FORM INPUTS
// =============================================================================

function createDropdown(parent, options = [], inputId, defaultText = 'Select an option') {
    const select = document.createElement('select');
    select.id = inputId; select.name = inputId;
    select.className = 'form-select custom-dropdown';

    const defaultOption = document.createElement('option');
    defaultOption.value = ''; defaultOption.textContent = defaultText;
    defaultOption.disabled = true; defaultOption.selected = true;
    select.appendChild(defaultOption);

    if (!Array.isArray(options)) { console.error('Invalid options passed to createDropdown:', options); return; }

    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.id; opt.textContent = option.name;
        if (option.bgColor) opt.dataset.bgcolor = option.bgColor;
        if (option.textColor) opt.dataset.textcolor = option.textColor;
        select.appendChild(opt);
    });

    select.addEventListener('change', function () {
        const selectedOption = select.options[select.selectedIndex];
        const bgColor = selectedOption.dataset.bgcolor;
        const textColor = selectedOption.dataset.textcolor;
        if (bgColor && textColor) {
            select.style.setProperty('background-color', bgColor, 'important');
            select.style.setProperty('color', textColor, 'important');
        } else {
            select.style.removeProperty('background-color');
            select.style.removeProperty('color');
        }
    });

    parent.appendChild(select);
    if (select.selectedIndex > 0) select.dispatchEvent(new Event('change'));
    return select;
}

export async function createDriverDropdownWithDNF(container, id) {
    const drivers = await fetchData('drivers', 'id, name');
    const options = [
        ...drivers.map(driver => ({ id: driver.id, name: driver.name })),
        { id: 'no-dnf', name: 'No DNFs' },
    ];
    createDropdown(container, options, id);
}

export function createNumberInput(container, id, isDecimal) {
    const input = document.createElement('input');
    input.type = 'number'; input.id = id; input.name = id;
    input.step = isDecimal ? '0.01' : '1';
    input.min = '0'; input.max = isDecimal ? '1000' : '22';
    input.placeholder = isDecimal ? 'Enter a number (up to 2 decimal places)' : 'Enter a number (0-22)';
    input.setAttribute('maxlength', '7');
    input.addEventListener('input', function() {
        const value = input.value;
        if (value.includes('.')) {
            const parts = value.split('.');
            if (isDecimal) { if (parts[1].length > 2) input.value = parts[0] + '.' + parts[1].substring(0, 2); }
            else { input.value = parts[0]; }
        }
    });
    container.appendChild(input);
}

export function createNumberInput2(container, id, isDecimal) {
    const input = document.createElement('input');
    input.type = 'number'; input.id = id; input.name = id;
    input.step = '1'; input.min = '0'; input.max = '1000';
    input.placeholder = 'Enter a number';
    input.setAttribute('maxlength', '7');
    input.addEventListener('input', function() {
        const value = input.value;
        if (value.includes('.')) { const parts = value.split('.'); input.value = parts[0]; }
    });
    container.appendChild(input);
}

export function createYesNoInput(container, id) {
    ['Yes', 'No'].forEach(value => {
        const div = document.createElement('div'); div.className = 'form-check';
        const input = document.createElement('input');
        input.type = 'radio'; input.id = `${id}-${value.toLowerCase()}`; input.name = id;
        input.value = value.toLowerCase(); input.className = 'form-check-input';
        const label = document.createElement('label');
        label.htmlFor = `${id}-${value.toLowerCase()}`; label.textContent = value; label.className = 'form-check-label';
        div.appendChild(input); div.appendChild(label); container.appendChild(div);
    });
}

export function createHeadsTailsInput(container, id) {
    ['Heads', 'Tails'].forEach(value => {
        const div = document.createElement('div'); div.className = 'form-check';
        const input = document.createElement('input');
        input.type = 'radio'; input.id = `${id}-${value.toLowerCase()}`; input.name = id;
        input.value = value.toLowerCase(); input.className = 'form-check-input';
        const label = document.createElement('label');
        label.htmlFor = `${id}-${value.toLowerCase()}`; label.textContent = value; label.className = 'form-check-label';
        div.appendChild(input); div.appendChild(label); container.appendChild(div);
    });
}

export async function generateFormBlocks() {
    const formContainer1 = document.getElementById('form-section-1');
    const formContainer2 = document.getElementById('form-section-2');
    const formContainer3 = document.getElementById('form-section-3');
    const formContainer4 = document.getElementById('form-section-4');

    try {
        formContainer1.innerHTML = ''; formContainer2.innerHTML = '';
        formContainer3.innerHTML = ''; formContainer4.innerHTML = '';

        const [formConfig, drivers, constructors, players] = await Promise.all([
            fetchFormConfiguration(),
            fetchData('drivers', 'id, name, constructor_id'),
            fetchData('constructors', 'id, name, background_colour, text_colour'),
            fetchData('players', 'id, name'),
        ]);

        const constructorMap = Object.fromEntries(constructors.map(c => [c.id, c]));
        const sortedConstructors = [...constructors].sort((a, b) => a.id - b.id);

        for (const config of formConfig) {
            const block = document.createElement('div'); block.className = 'mb-3';
            const label = document.createElement('label'); label.textContent = config.text; label.className = 'form-label';

            if (config.scoring_type === 'Plus Minus One (2)') {
                const s = document.createElement('small'); s.textContent = ' (2 points for correct, 1 point for +/- 1)'; s.style.fontSize = 'smaller'; label.appendChild(s);
            } else if (config.scoring_type === 'Driver + Team (2)') {
                const s = document.createElement('small'); s.textContent = ' (2 points for correct driver, 1 point for correct team)'; s.style.fontSize = 'smaller'; label.appendChild(s);
            }
            block.appendChild(label);

            switch (config.response_type) {
                case 'Select - Driver List': {
                    const sortedDrivers = [...drivers].sort((a, b) => a.id - b.id).map(d => ({ id: d.id, name: `${d.name} (${constructorMap[d.constructor_id]?.name || 'Unknown'})`, bgColor: constructorMap[d.constructor_id]?.background_colour || '', textColor: constructorMap[d.constructor_id]?.text_colour || '' }));
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver'); break;
                }
                case 'Select - Driver List + DNF': {
                    const sortedDrivers = [...drivers].sort((a, b) => a.id - b.id).map(d => ({ id: d.id, name: `${d.name} (${constructorMap[d.constructor_id]?.name || 'Unknown'})`, bgColor: constructorMap[d.constructor_id]?.background_colour || '', textColor: constructorMap[d.constructor_id]?.text_colour || '' }));
                    sortedDrivers.push({ id: 'no-dnf', name: 'No DNFs', bgColor: '', textColor: '' });
                    createDropdown(block, sortedDrivers, `input-${config.id}`, 'Select a driver or no DNFs'); break;
                }
                case 'Select - Team List': {
                    const teamOptions = sortedConstructors.map(c => ({ id: c.id, name: c.name, bgColor: c.background_colour, textColor: c.text_colour }));
                    createDropdown(block, teamOptions, `input-${config.id}`, 'Select a team'); break;
                }
                case 'Select - Name List': {
                    const loggedInPlayerId = getCookie("playerId");
                    let displayText = "Please log in", hiddenValue = "";
                    if (loggedInPlayerId) {
                        const matchingPlayer = players.find(p => String(p.id) === String(loggedInPlayerId));
                        if (matchingPlayer) { displayText = matchingPlayer.name; hiddenValue = loggedInPlayerId; }
                    }
                    const visibleInput = document.createElement('input');
                    visibleInput.type = 'text'; visibleInput.value = displayText;
                    visibleInput.id = `input-${config.id}-visible`; visibleInput.className = 'form-control autofilled-player-name';
                    visibleInput.readOnly = true; visibleInput.disabled = true;
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden'; hiddenInput.name = `input-${config.id}`;
                    hiddenInput.id = `input-${config.id}`; hiddenInput.value = hiddenValue;
                    block.appendChild(visibleInput); block.appendChild(hiddenInput); break;
                }
                case 'Number - Integer (0 - 22)': createNumberInput(block, `input-${config.id}`, false); break;
                case 'Number - Integer (0 - 1000)': createNumberInput2(block, `input-${config.id}`, false); break;
                case 'Number - Decimal': createNumberInput(block, `input-${config.id}`, true); break;
                case 'Radio - Yes/No': createYesNoInput(block, `input-${config.id}`); break;
                case 'Radio - Heads/Tails': createHeadsTailsInput(block, `input-${config.id}`); break;
                default: console.error('Unknown response type:', config.response_type);
            }

            block.querySelectorAll('input, select').forEach(input => { if (input.type !== 'radio') input.classList.add('form-control'); });

            if (config.id === 1) formContainer1.appendChild(block);
            else if (config.id >= 2 && config.id <= 7) formContainer2.appendChild(block);
            else if (config.id >= 8 && config.id <= 27) formContainer3.appendChild(block);
            else if (config.id === 28) formContainer4.appendChild(block);
        }
    } catch (error) {
        console.error('Error generating form blocks:', error);
    } finally {
        const loadingIndicator = document.getElementById('formLoading');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// =============================================================================
// SECTION 10 — COOKIE HELPERS
// =============================================================================

export function getCookie(name) {
    const cookieArr = document.cookie.split(";");
    for (let cookie of cookieArr) {
        let [key, value] = cookie.split("=");
        if (key.trim() === name) return value;
    }
    return null;
}

export function setCookie(name, value, maxAgeInSeconds) {
    let cookieString = `${name}=${value}; path=/;`;
    if (maxAgeInSeconds) cookieString += ` max-age=${maxAgeInSeconds};`;
    document.cookie = cookieString;
}

export function clearCookie(name) {
    document.cookie = `${name}=; path=/; max-age=0;`;
}

// =============================================================================
// SECTION 11 — LOGIN SYSTEM
// =============================================================================

export async function populateLoginPlayerDropdown() {
    const { data: players, error } = await supabase.from('players').select('id, name, password').order('name');
    if (error) { console.error('Error fetching players:', error); return; }
    const dataList = document.getElementById('players-list');
    if (dataList) {
        dataList.innerHTML = players.map(player => `<option data-id="${player.id}" value="${player.name}"></option>`).join('');
    }
}

export function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.classList.add('alert', `alert-${type}`); alert.innerHTML = message;
    alertContainer.appendChild(alert);
    setTimeout(() => { if (alert.parentNode) alert.parentNode.removeChild(alert); }, 3000);
}

// =============================================================================
// SECTION 12 — COLOUR HELPERS
// =============================================================================

export function getColorForLetter(letter) {
    const colors = ['#fb9605','#fc3d11','#A7FC00','#20e1d1','#9c1ae7','#0B6623','#f5ed16','#178bd5','#fb5cab','#52c1fa'];
    let index;
    if (letter >= 'A' && letter <= 'Z') index = (letter.charCodeAt(0) - 65) % colors.length;
    else index = colors.length - 1;
    return colors[index];
}

export function darkenColor(hex, percent) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// =============================================================================
// SECTION 13 — AVATAR RENDERING
// =============================================================================

export function renderAvatar(element, settings, letter = 'A') {
    const isSmall = element.classList.contains('user-avatar');
    const padVal = "0.2rem";
    let shadow, innerContent = "";

    if (settings.type === 'letter') {
        const displayLetter = settings.letter ? settings.letter.toUpperCase() : letter;
        const bgColor = settings.backgroundColor || getColorForLetter(displayLetter);
        const shadowColor = darkenColor(settings.iconColor, 50);
        element.textContent = displayLetter;
        element.style.backgroundColor = bgColor; element.style.color = settings.iconColor;
        element.style.textShadow = `1px 1px 0 ${shadowColor}, 2px 2px 0 ${shadowColor}`;
        element.style.fontFamily = "'Montserrat', Helvetica, sans-serif"; element.style.fontWeight = "bold";
        element.style.textAlign = "center"; element.style.lineHeight = element.style.height;
        return;
    } else if (settings.type === 'monochrome') {
        const newIcon = `icon_invert_${settings.icon}`;
        shadow = darkenColor(settings.iconColor, 60);
        const offset = 0;
        innerContent = `<div style="padding:${padVal};width:100%;height:100%;box-sizing:border-box;">
            <div style="position:relative;width:100%;height:100%;">
                <div style="position:absolute;top:${offset}px;left:${offset}px;width:100%;height:100%;background-color:${shadow};-webkit-mask-image:url('/media/icons/${newIcon}');-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;mask-image:url('/media/icons/${newIcon}');mask-size:contain;mask-repeat:no-repeat;mask-position:center;"></div>
                <div style="position:absolute;top:0;left:0;width:100%;height:100%;background-color:${settings.iconColor};-webkit-mask-image:url('/media/icons/${newIcon}');-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;mask-image:url('/media/icons/${newIcon}');mask-size:contain;mask-repeat:no-repeat;mask-position:center;"></div>
            </div></div>`;
        element.style.textShadow = 'none';
    } else {
        shadow = '#000000';
        const iconSrc = settings.icon.includes('.png') ? settings.icon : settings.icon + '.png';
        innerContent = `<div style="padding:${padVal};width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">
            <img src="/media/icons/${iconSrc}" alt="Avatar Icon" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0px 0px 0px ${shadow});"></div>`;
        element.style.textShadow = 'none';
    }
    element.innerHTML = innerContent;
    element.style.backgroundColor = settings.backgroundColor;
}

export function updateUserAvatar(playerData) {
    const userAvatar = document.getElementById('user-avatar');
    if (!userAvatar) return;
    const letter = playerData.name.charAt(0).toUpperCase();
    if (playerData.avatar_settings) {
        renderAvatar(userAvatar, playerData.avatar_settings, letter);
    } else {
        const bgColor = getColorForLetter(letter);
        const shadowColor = darkenColor(bgColor, 50);
        userAvatar.textContent = letter;
        userAvatar.style.backgroundColor = bgColor; userAvatar.style.color = "#fff";
        userAvatar.style.textShadow = `1px 1px 0 ${shadowColor}, 2px 2px 0 ${shadowColor}`;
        userAvatar.style.fontFamily = "'Montserrat', Helvetica, sans-serif"; userAvatar.style.fontWeight = "bold";
        userAvatar.style.textAlign = "center"; userAvatar.style.lineHeight = userAvatar.style.height;
    }
    userAvatar.classList.remove('d-none');
    const pid = getCookie("playerId");
    userAvatar.style.borderColor = pid === "1" ? "gold" : pid === "12" ? "red" : pid === "45" ? "#9210B7" : "#c0c0c0";
}

export function hideUserAvatar() {
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
        userAvatar.classList.add('d-none'); userAvatar.textContent = '';
        userAvatar.style.backgroundColor = ''; userAvatar.style.textShadow = '';
    }
}

export function createSmallAvatarHTML(player) {
    const letter = player.name ? player.name.charAt(0).toUpperCase() : '?';
    const avatar = document.createElement('div');
    avatar.classList.add('small-avatar');
    avatar.style.display = "inline-block"; avatar.style.width = "1.8rem"; avatar.style.height = "1.8rem";
    avatar.style.fontSize = "1rem"; avatar.style.lineHeight = "1.8rem";
    avatar.style.textAlign = "center"; avatar.style.marginRight = "0.5rem"; avatar.style.borderRadius = "50%";
    avatar.style.border = player.name === 'James' ? "1px solid gold" : player.name === 'Josh Watling' ? "1px solid red" : player.name === 'Damien' ? "1px solid #9210B7" : "1px solid #c0c0c0";

    if (player.avatar_settings) {
        renderAvatar(avatar, player.avatar_settings, letter);
        avatar.style.display = "inline-block"; avatar.style.lineHeight = "1.8rem"; avatar.style.textAlign = "center";
    } else {
        avatar.textContent = letter;
        const bgColor = getColorForLetter(letter);
        avatar.style.backgroundColor = bgColor; avatar.style.color = "#fff";
        avatar.style.fontFamily = 'Montserrat'; avatar.style.fontWeight = 700;
        avatar.style.textShadow = `1px 1px 0 ${darkenColor(bgColor, 30)}`;
    }
    return avatar.outerHTML;
}

// =============================================================================
// SECTION 14 — LOGIN UI
// =============================================================================

export function updateLoginUI(playerData) {
    const playerName = playerData.name;
    const loginButton = document.getElementById('loginButton');
    if (loginButton) loginButton.classList.add('d-none');

    const avatarDropdownContainer = document.getElementById('avatarDropdownContainer');
    if (avatarDropdownContainer) avatarDropdownContainer.classList.remove('d-none');

    const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');
    if (loggedInUserDisplay) { loggedInUserDisplay.innerHTML = `Logged in as <strong>${playerName}</strong>`; loggedInUserDisplay.classList.remove('d-none'); }

    const logoutMenuItem = document.getElementById('logoutMenuItem');
    if (logoutMenuItem) logoutMenuItem.classList.remove('d-none');

    updateUserAvatar(playerData);

    if (playerData.id === 1 || getCookie("playerId") === "1") {
        const dropdownMenu = document.getElementById('userDropdown').nextElementSibling;
        let adminLinkItem = document.getElementById('adminLinkItem');
        if (!adminLinkItem && dropdownMenu) {
            adminLinkItem = document.createElement('li'); adminLinkItem.id = 'adminLinkItem';
            adminLinkItem.innerHTML = `<a class="dropdown-item body-text-xs" href="/admin">Admin</a>`;
            dropdownMenu.appendChild(adminLinkItem);
        }
    } else {
        document.getElementById('adminLinkItem')?.remove();
    }

    const loginModalEl = document.getElementById('loginModal');
    let modalInstance = bootstrap.Modal.getInstance(loginModalEl);
    if (!modalInstance) modalInstance = new bootstrap.Modal(loginModalEl);
    modalInstance.hide();
    setTimeout(() => { document.getElementById('userDropdown')?.focus(); }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener('click', async function(e) {
        let target = e.target;
        while (target && target !== document) {
            if (target.id === 'logoutBtn') {
                e.preventDefault();
                const confirmed = await showCustomConfirm('Are you sure you want to log out?');
                if (!confirmed) return;
                clearCookie("playerId");
                document.cookie = "playerId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                localStorage.removeItem("darkMode");
                setDarkMode(false);
                const loggedInUserDisplay = document.getElementById('loggedInUserDisplay');
                if (loggedInUserDisplay) loggedInUserDisplay.classList.add('d-none');
                const logoutMenuItem = document.getElementById('logoutMenuItem');
                if (logoutMenuItem) logoutMenuItem.classList.add('d-none');
                const loginButton = document.getElementById('loginButton');
                if (loginButton) loginButton.classList.remove('d-none');
                hideUserAvatar();
                updateFormPlayerDisplay(null);
                document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: false } }));
                showAlert('You have logged out!', 'success');
                resetLoginForm();
                setTimeout(() => location.reload(), 500);
                break;
            }
            target = target.parentElement;
        }
    });
});

function resetLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.reset();
    const playerNameInput = document.getElementById('login-player-name');
    const pinInput = document.getElementById('login-pin');
    const loginButton = loginForm.querySelector('button[type="submit"]');
    if (playerNameInput) playerNameInput.disabled = false;
    if (pinInput) pinInput.disabled = false;
    if (loginButton) loginButton.disabled = true;
}

document.addEventListener("DOMContentLoaded", async () => {
    await populateLoginPlayerDropdown();

    const playerIdCookie = getCookie("playerId");
    const userAvatar = document.getElementById('user-avatar');
    const avatarDropdownContainer = document.getElementById('avatarDropdownContainer');
    const loginButton = document.getElementById('loginButton');

    if (playerIdCookie) {
        if (userAvatar) { userAvatar.textContent = ""; userAvatar.style.backgroundColor = "#ccc"; }
    } else {
        if (avatarDropdownContainer) avatarDropdownContainer.classList.add('d-none');
        if (loginButton) loginButton.classList.remove('d-none');
    }

    if (playerIdCookie) {
        const { data: playerData, error } = await supabase.from('players').select('id, name, password, avatar_settings').eq('id', playerIdCookie).single();
        if (!error && playerData) updateLoginUI(playerData);
    }

    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const playerNameInput = document.getElementById('login-player-name');
    const pinInput = document.getElementById('login-pin');
    const loginSubmitButton = loginForm.querySelector('button[type="submit"]');

    function toggleLoginButton() {
        if (loginSubmitButton) loginSubmitButton.disabled = !(playerNameInput.value.trim() && pinInput.value.trim());
    }

    playerNameInput?.addEventListener('input', toggleLoginButton);
    pinInput?.addEventListener('input', toggleLoginButton);
    if (loginSubmitButton) loginSubmitButton.disabled = true;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginSubmitButton) loginSubmitButton.disabled = true;
        if (playerNameInput) playerNameInput.disabled = true;
        if (pinInput) pinInput.disabled = true;

        const playerName = playerNameInput.value;
        const pin = pinInput.value;
        const rememberMe = document.getElementById('rememberMe')?.checked;

        if (pin.length !== 4) {
            showAlert('Please enter a 4-digit PIN.', 'danger');
            if (loginSubmitButton) loginSubmitButton.disabled = false;
            if (playerNameInput) playerNameInput.disabled = false;
            if (pinInput) pinInput.disabled = false;
            return;
        }

        const { data: playerData, error } = await supabase.from('players').select('id, name, password, avatar_settings, dark_mode').eq('name', playerName).single();
        if (error || !playerData) {
            showAlert('Error logging in. Please try again.', 'danger');
            if (loginSubmitButton) loginSubmitButton.disabled = false;
            if (playerNameInput) playerNameInput.disabled = false;
            if (pinInput) pinInput.disabled = false;
            return;
        }

        const hashedPin = CryptoJS.MD5(pin).toString();
        if (hashedPin === playerData.password) {
            showAlert('Login successful!', 'success');
            if (rememberMe) setCookie("playerId", playerData.id, 30 * 24 * 60 * 60);
            else setCookie("playerId", playerData.id);
            setDarkMode(!!playerData.dark_mode);
            updateLoginUI(playerData);
            document.dispatchEvent(new CustomEvent("loginStateChanged", { detail: { loggedIn: true } }));
            updateFormPlayerDisplay(playerData.name);
        } else {
            showAlert('Incorrect PIN. Please try again.', 'danger');
            if (pinInput) pinInput.value = "";
            if (playerNameInput) playerNameInput.disabled = false;
            if (pinInput) pinInput.disabled = false;
            toggleLoginButton();
        }
    });
});

export function updateFormPlayerDisplay(newPlayerName) {
    document.querySelectorAll('.autofilled-player-name').forEach(elem => {
        const isInput = elem.tagName.toLowerCase() === 'input';
        const text = newPlayerName || "Please log in";
        if (isInput) elem.value = text; else elem.textContent = text;
    });
}

export function showCustomAlert(message) {
    const modalEl = document.getElementById('customAlertModal');
    modalEl.querySelector('.modal-body').textContent = message;
    new bootstrap.Modal(modalEl).show();
}

export function showCustomConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('customConfirmModal');
        document.getElementById('customConfirmModalLabel').textContent = title;
        modalEl.querySelector('.modal-body').textContent = message;

        let btnOk = document.getElementById('customConfirmOk');
        let btnCancel = document.getElementById('customConfirmCancel');
        btnOk.replaceWith(btnOk.cloneNode(true)); btnCancel.replaceWith(btnCancel.cloneNode(true));

        const newBtnOk = document.getElementById('customConfirmOk');
        const newBtnCancel = document.getElementById('customConfirmCancel');
        const confirmModal = new bootstrap.Modal(modalEl);

        newBtnOk.addEventListener('click', () => { resolve(true); confirmModal.hide(); });
        newBtnCancel.addEventListener('click', () => { resolve(false); confirmModal.hide(); });
        modalEl.addEventListener('hidden.bs.modal', function handler() {
            modalEl.removeEventListener('hidden.bs.modal', handler); resolve(false);
        });
        confirmModal.show();
    });
}

// =============================================================================
// SECTION 15 — DARK MODE
// =============================================================================

function setDarkMode(enable) {
    localStorage.setItem('darkMode', enable);
    const link = document.getElementById('themeStylesheet');
    if (link) link.href = enable ? '/dark.css' : '/light.css';
    window.dispatchEvent(new Event('themeChanged'));
}

async function loadUserPreferences() {
    const playerId = getCookie("playerId");
    if (!playerId) return;
    const { data, error } = await supabase.from('players').select('dark_mode').eq('id', playerId).single();
    if (error || !data) return;
    const darkModeEnabled = data.dark_mode === true;
    localStorage.setItem('darkMode', darkModeEnabled);
    const darkToggle = document.getElementById("darkModeToggle");
    if (darkToggle) darkToggle.checked = darkModeEnabled;
}

async function updateDarkModePreference(enable) {
    const playerId = getCookie("playerId");
    if (!playerId) return;
    const { error } = await supabase.from('players').update({ dark_mode: enable }).eq('id', playerId);
    if (error) console.error("Error updating dark mode preference", error);
}

document.addEventListener("DOMContentLoaded", () => {
    if (getCookie("playerId")) loadUserPreferences();
    const darkToggle = document.getElementById("darkModeToggle");
    if (darkToggle) {
        darkToggle.addEventListener("change", async function () {
            const enable = darkToggle.checked;
            await updateDarkModePreference(enable);
            setDarkMode(enable);
        });
    }
});