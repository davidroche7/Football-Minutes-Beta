#!/usr/bin/env node
/**
 * One-off importer that migrates a `football-minutes-beta` backup (from migrate-data.html)
 * into the new Prisma schema.
 *
 * Usage:
 *   npm run import:beta -- ./data/backup.json "Team Name" "Age Group"
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normaliseKey = (value) => (value?.trim().toLowerCase() ?? "");

const mapVenueToLocation = (value) => {
  if (!value) return "HOME";
  const normalized = value.trim().toUpperCase();
  if (normalized.includes("AWAY")) return "AWAY";
  if (normalized.includes("NEUTRAL")) return "NEUTRAL";
  return "HOME";
};

const parseFixtureDate = (date, time) => {
  if (!date) {
    return new Date();
  }
  const trimmedDate = date.trim();
  if (trimmedDate.includes("T")) {
    return new Date(trimmedDate);
  }
  const iso = time && time.trim().length > 0 ? `${trimmedDate}T${time}:00` : `${trimmedDate}T00:00:00`;
  return new Date(iso);
};

const resolvePlayerId = (reference, context, metadataLookup) => {
  if (!reference) return null;
  const trimmed = reference.trim();
  if (!trimmed) return null;

  if (context.legacyIdMap.has(trimmed)) {
    return context.legacyIdMap.get(trimmed);
  }

  const normalized = normaliseKey(trimmed);
  if (metadataLookup && metadataLookup[normalized] && context.legacyIdMap.has(metadataLookup[normalized])) {
    return context.legacyIdMap.get(metadataLookup[normalized]);
  }

  if (context.nameIdMap.has(normalized)) {
    return context.nameIdMap.get(normalized);
  }

  return null;
};

const convertAllocation = (match, context) => {
  const slots = [];
  const summaryByPlayer = {};
  const starters = new Set();
  const positions = new Map();
  const metadataLookup = match.metadata?.playerIdLookup
    ? Object.fromEntries(Object.entries(match.metadata.playerIdLookup).map(([key, value]) => [normaliseKey(key), value]))
    : undefined;

  match.allocation?.quarters?.forEach((quarter) => {
    quarter.slots.forEach((slot) => {
      const playerId = resolvePlayerId(slot.player, context, metadataLookup);
      if (!playerId) {
        console.warn(`⚠️  Unknown player "${slot.player}" in allocation – skipping slot`);
        return;
      }
      const entry = {
        quarter: quarter.quarter,
        position: slot.position,
        playerId,
        playerName: slot.player,
        minutes: slot.minutes ?? 0,
      };
      slots.push(entry);
      if (quarter.quarter === 1) {
        starters.add(playerId);
      }
      if (!positions.has(playerId)) {
        positions.set(playerId, entry.position);
      }
    });
  });

  Object.entries(match.allocation?.summary ?? {}).forEach(([name, minutes]) => {
    const playerId = resolvePlayerId(name, context, metadataLookup);
    if (playerId) {
      summaryByPlayer[playerId] = minutes;
    } else {
      console.warn(`⚠️  Unable to map minutes summary for "${name}"`);
    }
  });

  return {
    plan: {
      slots,
      summary: summaryByPlayer,
    },
    starters,
    positions,
  };
};

async function importRoster(teamId, players) {
  const legacyIdMap = new Map();
  const nameIdMap = new Map();

  for (const legacy of players) {
    const displayName = legacy.name ?? legacy.displayName ?? "Unnamed Player";
    const created = await prisma.player.create({
      data: {
        teamId,
        displayName,
        squadNumber: legacy.squadNumber ?? null,
        status: legacy.status ?? "ACTIVE",
        preferredPositions:
          legacy.preferredPositions && legacy.preferredPositions.length > 0
            ? JSON.stringify(legacy.preferredPositions)
            : null,
        notes: legacy.notes ?? null,
        removedAt: legacy.removedAt ? new Date(legacy.removedAt) : null,
      },
    });

    if (legacy.id) {
      legacyIdMap.set(legacy.id, created.id);
    }
    nameIdMap.set(normaliseKey(displayName), created.id);
  }

  return { legacyIdMap, nameIdMap };
}

async function importMatches(teamId, teamMeta, matches, context) {
  for (const match of matches) {
    const metadataLookup = match.metadata?.playerIdLookup
      ? Object.fromEntries(
          Object.entries(match.metadata.playerIdLookup).map(([key, value]) => [normaliseKey(key), value]),
        )
      : undefined;

    const { plan, starters, positions } = convertAllocation(match, context);
    const durationMinutes = teamMeta.quarterDuration * teamMeta.quarters;
    const location = mapVenueToLocation(match.result?.venue ?? match.metadata?.venueType);

    const allocationJson = plan.slots.length > 0 ? JSON.stringify(plan) : null;

    const matchRecord = await prisma.match.create({
      data: {
        teamId,
        opponent: match.opponent ?? "Opponent",
        fixtureDate: parseFixtureDate(match.date, match.time),
        location,
        durationMinutes,
        status: match.metadata?.status ?? (match.result?.result ? "FINAL" : "PLANNED"),
        notes: match.notes ?? match.result?.notes ?? null,
        goalsFor: match.result?.goalsFor ?? null,
        goalsAgainst: match.result?.goalsAgainst ?? null,
        result: match.result?.result ?? null,
        allocation: allocationJson,
        scorers: match.result?.scorers && match.result.scorers.length > 0 ? JSON.stringify(match.result.scorers) : null,
        assists: match.result?.assists && match.result.assists.length > 0 ? JSON.stringify(match.result.assists) : null,
        honorableMentions:
          match.result?.honorableMentions && match.result.honorableMentions.length > 0
            ? JSON.stringify(match.result.honorableMentions)
            : null,
      },
    });

    const referencedPlayers = new Set();
    match.players?.forEach((ref) => {
      const id = resolvePlayerId(ref, context, metadataLookup);
      if (id) {
        referencedPlayers.add(id);
      }
    });
    Object.keys(plan.summary).forEach((playerId) => {
      referencedPlayers.add(playerId);
    });

    if (referencedPlayers.size === 0) {
      console.warn(`⚠️  Match ${match.id ?? match.opponent ?? ""} has no mappable players. Skipping appearances.`);
      continue;
    }

    await prisma.appearance.createMany({
      data: Array.from(referencedPlayers).map((playerId) => ({
        matchId: matchRecord.id,
        playerId,
        minutesPlayed: plan.summary[playerId] ?? 0,
        started: starters.has(playerId),
        position: positions.get(playerId) ?? null,
      })),
    });
  }
}

async function main() {
  const [, , rawPath, teamName, ageGroup] = process.argv;
  if (!rawPath || !teamName) {
    console.error('Usage: npm run import:beta -- <backup.json> "Team Name" [Age Group]');
    process.exit(1);
  }

  const backupPath = resolve(process.cwd(), rawPath);
  const fileContents = readFileSync(backupPath, "utf8");
  const parsed = JSON.parse(fileContents);

  const matches = Array.isArray(parsed?.data?.matches) ? parsed.data.matches : [];
  const rosterPayload = parsed?.data?.roster;
  const players = Array.isArray(rosterPayload)
    ? rosterPayload
    : Array.isArray(rosterPayload?.players)
      ? rosterPayload.players
      : [];
  const rules = parsed?.data?.rules ?? null;

  const quarterDuration = typeof rules?.quarterDuration === "number" ? rules.quarterDuration : 10;
  const quarters = typeof rules?.quarters === "number" ? rules.quarters : 4;
  const waveFirst = typeof rules?.waves?.first === "number" ? rules.waves.first : Math.ceil(quarterDuration / 2);
  const waveSecond = typeof rules?.waves?.second === "number" ? rules.waves.second : Math.floor(quarterDuration / 2);
  const maxVariance = typeof rules?.fairness?.maxVariance === "number" ? rules.fairness.maxVariance : 5;
  const gkRequiresOutfield =
    typeof rules?.fairness?.gkRequiresOutfield === "boolean" ? rules.fairness.gkRequiresOutfield : true;

  console.log(`📦 Importing backup from ${backupPath}`);
  console.log(`👥 Players: ${players.length}`);
  console.log(`📅 Matches: ${matches.length}`);

  const team = await prisma.team.create({
    data: {
      name: teamName,
      ageGroup: ageGroup ?? null,
      quarterDuration,
      quarters,
      waveFirst,
      waveSecond,
      maxVariance,
      gkRequiresOutfield,
    },
  });

  const maps = await importRoster(team.id, players);
  await importMatches(team.id, { quarterDuration, quarters }, matches, {
    teamId: team.id,
    legacyIdMap: maps.legacyIdMap,
    nameIdMap: maps.nameIdMap,
  });

  console.log(`✅ Imported team "${team.name}" with ${players.length} players and ${matches.length} matches.`);
}

main()
  .catch((error) => {
    console.error("Import failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

