// The Current — authoritative world tick.
//
// This edge function is the single authority over the shared world. It runs
// on a schedule, computes how many world days are due at the world's fixed
// real-time pace, advances the deterministic simulation with fresh
// cryptographic entropy for each day, and stores the resulting snapshot.
//
// Every browser is a read-only spectator of the row this function maintains:
// nobody can speed up time, add days, or fork the world, and because each
// day's entropy is drawn here (and only here) at the moment the day runs,
// the future cannot be precomputed from the seed by anyone — including us.
//
// The entropy inputs are stored in `the_current_entropy` (service-role only)
// so the recorded past stays exactly replayable for audit.
//
// The engine is imported from the public repository pinned to an exact
// commit (esm.sh transpiles the TypeScript). To pick up engine changes,
// push them, then redeploy this function with the new commit hash.

import { createClient } from 'npm:@supabase/supabase-js@2.110.6';
import * as simulation from 'https://esm.sh/gh/JaronKBragg7337/the-current@d471ed804c4ad18f01df04837524826f2c4276c1/src/simulation/index.ts';

const WORLD_ID = 'main';
const SHARED_SEED = 'current-shared-001';
const DEFAULT_WORLD_DAY_MS = 86_400_000; // One world day per real day.
const MAX_DAYS_PER_TICK = 24;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: row, error: readError } = await supabase
    .from('the_current_world')
    .select('*')
    .eq('id', WORLD_ID)
    .maybeSingle();
  if (readError) return json({ error: readError.message }, 500);

  if (row === null) {
    const sim = simulation.createSimulation({ seed: SHARED_SEED });
    const snapshot = sim.snapshot();
    const { error: insertError } = await supabase.from('the_current_world').insert({
      id: WORLD_ID,
      seed: SHARED_SEED,
      day: snapshot.day,
      digest: snapshot.digest,
      snapshot,
      world_day_ms: DEFAULT_WORLD_DAY_MS,
    });
    if (insertError) return json({ error: insertError.message }, 500);
    return json({ created: true, day: snapshot.day, digest: snapshot.digest });
  }

  const worldDayMs = Number(row.world_day_ms) || DEFAULT_WORLD_DAY_MS;
  const targetDay = Math.floor((Date.now() - new Date(row.genesis_at).getTime()) / worldDayMs);
  const pending = Math.min(MAX_DAYS_PER_TICK, targetDay - row.day);
  if (pending <= 0) {
    return json({ day: row.day, advanced: 0, digest: row.digest });
  }

  const sim = simulation.restoreSimulation(row.snapshot);
  const entropyRows: { world_id: string; day: number; entropy: string }[] = [];
  for (let index = 0; index < pending; index += 1) {
    const entropy = crypto.randomUUID();
    const result = sim.advanceDay({ signals: [], interventions: [], entropy });
    entropyRows.push({ world_id: WORLD_ID, day: result.day, entropy });
  }
  const snapshot = sim.snapshot();

  // Optimistic lock: only publish if nobody else advanced the world first.
  const { data: updated, error: updateError } = await supabase
    .from('the_current_world')
    .update({
      day: snapshot.day,
      digest: snapshot.digest,
      snapshot,
      last_advanced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', WORLD_ID)
    .eq('day', row.day)
    .select('day');
  if (updateError) return json({ error: updateError.message }, 500);
  if (updated === null || updated.length === 0) {
    return json({ day: row.day, advanced: 0, skipped: 'concurrent tick already advanced the world' });
  }

  const { error: entropyError } = await supabase.from('the_current_entropy').insert(entropyRows);
  if (entropyError) return json({ error: entropyError.message, day: snapshot.day, advanced: pending }, 500);

  return json({ day: snapshot.day, advanced: pending, digest: snapshot.digest });
});
