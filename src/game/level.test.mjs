import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOORS,
  ENEMY_SPAWNS,
  EXIT,
  OBSTACLES,
  PICKUPS,
  SPAWN,
  canOccupy,
  doorBlocks,
  findPath,
  floorAt,
  lineClear,
  world,
} from "./level.ts";

test("spawn, mission card and extraction are connected through the level", () => {
  const card = PICKUPS.find((p) => p.kind === "card");
  assert.ok(findPath(SPAWN, card).length > 0);
  assert.ok(findPath(card, EXIT).length > 0);
  assert.ok(canOccupy(SPAWN.x, SPAWN.z, 0.32));
});
test("collision prevents clipping through walls and outside the map", () => {
  assert.equal(canOccupy(-1, -1, 0.32), false);
  const edge = world(2, 19);
  assert.equal(canOccupy(2 * 2.8 + 0.1, edge.z, 0.32), false);
  assert.equal(canOccupy(edge.x, edge.z, 0.32), true);
  assert.equal(floorAt(0, 0), false);
});
test("closed doors block movement and line of sight, opening restores both", () => {
  const door = DOORS[0];
  assert.equal(doorBlocks(door.x, door.z, door), true);
  assert.equal(canOccupy(door.x, door.z, 0.32, [door]), false);
  assert.equal(canOccupy(door.x, door.z, 0.32, []), true);
  assert.equal(
    lineClear({ x: door.x, z: door.z - 2 }, { x: door.x, z: door.z + 2 }, [
      door,
    ]),
    false
  );
  assert.equal(
    lineClear({ x: door.x, z: door.z - 2 }, { x: door.x, z: door.z + 2 }, []),
    true
  );
});
test("pathfinding cannot cross a sealed maintenance or transit door", () => {
  assert.deepEqual(findPath(SPAWN, world(5, 10), DOORS), []);
  assert.ok(findPath(SPAWN, world(5, 10), []).length > 0);
});

test("solid props block movement and visibility", () => {
  const reactor = OBSTACLES[0];
  assert.equal(canOccupy(reactor.x, reactor.z, 0.32), false);
  assert.equal(
    lineClear(
      { x: reactor.x - 3, z: reactor.z },
      { x: reactor.x + 3, z: reactor.z }
    ),
    false
  );
});
test("all enemies and mission pickups spawn in reachable, unblocked positions", () => {
  for (const point of [...ENEMY_SPAWNS, ...PICKUPS, EXIT]) {
    assert.ok(canOccupy(point.x, point.z, 0.32), JSON.stringify(point));
    assert.ok(findPath(SPAWN, point).length > 0, JSON.stringify(point));
  }
});
