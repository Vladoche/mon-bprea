import { readDrillState } from './drill-store.js';

/**
 * Read-only boundary for the dashboard. The Drill store supplies validated
 * snapshots and readable root responses without touching the original JSON.
 * A future synchronized source can replace this adapter without changing the
 * pure statistics module or the rendering code.
 */
export function readDashboardData() {
  return readDrillState();
}
