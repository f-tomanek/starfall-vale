import { describe, expect, it } from 'vitest';
import { BRIDGES, ISLANDS, bridgeGeometry, heightAt, regionAt } from '../src/world/heightfield.js';
import { groundAt } from '../src/world/layout.js';
import { loadContent } from './load-content.js';

const content = loadContent();
const zones = content.world.zones;
const wp = (id: string) => content.world.waypoints[id];

describe('the Mist', () => {
  const closed = (id: string) => !zones.find((z) => z.id === id)?.openWhen;
  const open = () => true;

  it('keeps the outer zones closed before Act 1 ends', () => {
    expect(regionAt(0, 60, zones, closed)).toBe('beacon');
    expect(regionAt(0, -20, zones, closed)).toBe('wreckhaven');
    expect(regionAt(-78, -14, zones, closed)).toBeNull();
    expect(regionAt(76, 2, zones, closed)).toBeNull();
    expect(regionAt(2, -96, zones, closed)).toBeNull();
    // The beacon footpath is always walkable
    expect(regionAt(-2.5, 35, zones, closed)).not.toBeNull();
    // Wilderness far from roads and zones is not
    expect(regionAt(60, 70, zones, open)).toBeNull();
  });

  it('opens every zone and the roads between them afterwards', () => {
    expect(regionAt(-78, -14, zones, open)).toBe('glimmerwood');
    expect(regionAt(76, 2, zones, open)).toBe('rustdune');
    expect(regionAt(2, -96, zones, open)).toBe('skyreach');
    // Midway along the west and east roads, outside any zone circle
    expect(regionAt(-46, 3, zones, open)).not.toBeNull();
    expect(regionAt(46, 6, zones, open)).not.toBeNull();
  });

  it('every content waypoint lies in a walkable region once everything is open', () => {
    for (const [id, [x, , z]] of Object.entries(content.world.waypoints)) {
      expect(regionAt(x, z, zones, open), id).not.toBeNull();
    }
  });
});

describe('world geometry', () => {
  it('light bridges are gentle enough to walk (< 25 degrees)', () => {
    for (const b of BRIDGES) {
      const g = bridgeGeometry(b.id)!;
      const slope = (Math.atan2(Math.abs(g.end[1] - g.start[1]), g.length) * 180) / Math.PI;
      expect(slope, b.id).toBeLessThan(25);
      expect(g.length, b.id).toBeGreaterThan(2);
    }
  });

  it('islands float well above the valley floor', () => {
    for (const i of ISLANDS) expect(i.y - heightAt(i.x, i.z), i.id).toBeGreaterThan(15);
  });

  it('the lift connects the valley floor to the first island', () => {
    const [bx, , bz] = wp('lift_bottom');
    const [tx, , tz] = wp('lift_top');
    expect(groundAt(bx, bz)).toBeLessThan(3);
    expect(groundAt(tx, tz)).toBe(ISLANDS[0].y);
  });

  it('the village floor is level and the shrine deck is raised', () => {
    expect(Math.abs(groundAt(0, -10))).toBeLessThan(0.05);
    expect(groundAt(0, -45)).toBe(2);
  });
});
