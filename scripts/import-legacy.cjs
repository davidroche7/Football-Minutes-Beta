#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INPUT_PATH = path.resolve('data/FOOTBALL LINEUPS.xlsx');
const OUTPUT_PATH = path.resolve('data/imported-matches.json');

// Keep in sync with src/config/rules.ts
const RULES = {
  quarters: 4,
  quarterDuration: 10,
  waves: { first: 5, second: 5 },
  positions: { GK: 1, DEF: 2, ATT: 2 },
};

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function excelSerialToISO(serial) {
  if (!serial) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const date = new Date(parsed.y, parsed.m - 1, parsed.d);
  return date.toISOString().slice(0, 10);
}

function normaliseName(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function loadSheet(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found in workbook`);
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function buildResultsMap(rows) {
  if (rows.length === 0) return new Map();
  const [header, ...records] = rows;
  const findIndex = (label) => header.findIndex((cell) => String(cell).toLowerCase() === label.toLowerCase());

  const idxDate = findIndex('Date');
  const idxVenue = findIndex('Venue');
  const idxOpponent = findIndex('Opponent');
  const idxResult = findIndex('Result');
  const idxGoalsFor = findIndex('Goals for');
  const idxGoalsAgainst = findIndex('Goals against');
  const idxPotm = findIndex('POTM');
  const hmIndices = header
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => String(cell).toLowerCase() === 'hm')
    .map(({ index }) => index);
  const idxScorersStart = header.findIndex((cell) => String(cell).toLowerCase() === 'scorers');

  const resultsMap = new Map();

  records.forEach((row) => {
    const serial = row[idxDate];
    if (!serial) return;
    const key = Number(serial);
    const record = {
      venue: normaliseName(row[idxVenue]),
      opponent: normaliseName(row[idxOpponent]),
      result: row[idxResult] ? String(row[idxResult]).trim() : '',
      goalsFor: row[idxGoalsFor] !== '' ? Number(row[idxGoalsFor]) : null,
      goalsAgainst: row[idxGoalsAgainst] !== '' ? Number(row[idxGoalsAgainst]) : null,
      playerOfMatch: normaliseName(row[idxPotm]),
      honorableMentions: hmIndices.map((idx) => normaliseName(row[idx])).filter(Boolean),
      scorers: [],
    };

    if (idxScorersStart >= 0) {
      const scorerCells = row.slice(idxScorersStart);
      scorerCells.forEach((value) => {
        const name = normaliseName(value);
        if (name) {
          record.scorers.push(name);
        }
      });
    }

    resultsMap.set(key, record);
  });

  return resultsMap;
}

function parseLineups(rows, resultsMap) {
  const matches = [];
  const dateRowIndexes = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => row[0] === 'Date' && row[1]);

  dateRowIndexes.forEach(({ row: dateRow, idx }, blockIndex) => {
    const nextDateIdx = dateRowIndexes[blockIndex + 1]?.idx ?? rows.length;
    const blockRows = rows.slice(idx, nextDateIdx);

    const dateSerial = Number(dateRow[1]);
    const dateISO = excelSerialToISO(dateSerial);
    const positions = dateRow
      .slice(5)
      .map((value) => String(value).trim())
      .filter((value) => value);

    const opponentRow = blockRows.find((r) => r[0] === 'Opponent') || [];
    const venueRow = blockRows.find((r) => r[0] === 'Venue') || [];

    const quarterRows = blockRows
      .slice(1)
      .filter((row) => row.slice(5).some((value) => String(value).trim().length > 0))
      .slice(0, RULES.quarters);

    const quarters = quarterRows.map((row, quarterIdx) => {
      const players = row.slice(5);
      const slots = [];
      const substitutes = [];

      positions.forEach((pos, posIdx) => {
        const player = normaliseName(players[posIdx]);
        if (!player) return;
        switch (pos.toUpperCase()) {
          case 'GK':
            slots.push({ player, position: 'GK', minutes: RULES.quarterDuration });
            break;
          case 'D':
            slots.push({ player, position: 'DEF', minutes: RULES.quarterDuration });
            break;
          case 'F':
            slots.push({ player, position: 'ATT', minutes: RULES.quarterDuration });
            break;
          case 'S':
            substitutes.push(player);
            break;
          default:
            break;
        }
      });

      return {
        quarter: quarterIdx + 1,
        slots,
        substitutes,
      };
    });

    const summary = {};
    quarters.forEach((quarter) => {
      quarter.slots.forEach((slot) => {
        summary[slot.player] = (summary[slot.player] || 0) + slot.minutes;
      });
    });

    const availablePlayers = Array.from(
      new Set(
        quarters.flatMap((quarter) => [
          ...quarter.slots.map((slot) => slot.player),
          ...quarter.substitutes,
        ])
      )
    ).sort();

    matches.push({
      dateSerial,
      date: dateISO,
      opponent: normaliseName(opponentRow[1]),
      venue: normaliseName(venueRow[1]),
      availablePlayers,
      quarters,
      summary,
      result: resultsMap.get(dateSerial) || null,
    });
  });

  return matches;
}

function main() {
  ensureFileExists(INPUT_PATH);
  const workbook = XLSX.readFile(INPUT_PATH, { cellFormula: true });
  const lineupsRows = loadSheet(workbook, 'Lineups');
  const resultsRows = loadSheet(workbook, 'Results');

  const resultsMap = buildResultsMap(resultsRows);
  const matches = parseLineups(lineupsRows, resultsMap);

  const output = {
    generatedAt: new Date().toISOString(),
    source: path.basename(INPUT_PATH),
    rules: RULES,
    matchCount: matches.length,
    matches,
  };

  const serialised = JSON.stringify(output, null, 2);
  try {
    fs.writeFileSync(OUTPUT_PATH, serialised);
    console.log(`Imported ${matches.length} matches from ${path.basename(INPUT_PATH)}.`);
    console.log(`Output written to ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
  } catch (error) {
    console.warn(`Unable to write to ${OUTPUT_PATH}: ${error.message}`);
    console.log('--- Begin JSON Output ---');
    console.log(serialised);
    console.log('--- End JSON Output ---');
  }
}

main();
