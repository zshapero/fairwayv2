import { getDatabase } from "@/core/db/database";
import * as playersRepo from "@/core/db/repositories/players";
import type { Player } from "@/core/db/types";

const DEFAULT_NAME = "You";

/**
 * Fairway is a single-user app for now. This helper returns the first player
 * row, creating one named "You" on first use. All round entry / handicap
 * tracking flows through this player.
 */
export async function getOrCreateCurrentPlayer(): Promise<Player> {
  await getDatabase(); // ensure migrations have run
  const players = await playersRepo.listPlayers();
  if (players[0]) return players[0];
  const id = await playersRepo.createPlayer(DEFAULT_NAME);
  const created = await playersRepo.getPlayer(id);
  if (!created) {
    throw new Error("Failed to create default player");
  }
  return created;
}

export async function getCurrentPlayer(): Promise<Player | null> {
  await getDatabase();
  const players = await playersRepo.listPlayers();
  return players[0] ?? null;
}
