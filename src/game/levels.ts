import { Vector3 } from "./babylon";
import * as station from "./level";
import { createWorld } from "./world";
import type { World } from "./world";
import type { Scene } from "./babylon";
import type { Point, PickupDefinition } from "./level";
import type { Navigation } from "./navigation";
import { createOutdoorWorld } from "./outdoor-world";
import {
  OUTDOOR_SPAWN,
  OUTDOOR_EXIT,
  OUTDOOR_ENEMIES,
  OUTDOOR_PICKUPS,
  outdoorNavigation,
  outdoorLocation,
} from "./outdoor-level";
import { createLakeWorld } from "./lake-world";
import {
  LAKE_SPAWN,
  LAKE_EXIT,
  LAKE_PICKUPS,
  LAKE_ENEMIES,
  lakeNavigation,
  lakeGroundHeight,
  lakeCanStand,
  lakeEnemyTarget,
  lakeLocation,
} from "./lake-level";
import { createCakeWorld } from "./cake-world";
import { CAKE_SPAWN, CAKE_EXIT, CAKE_ENEMIES, CAKE_PICKUPS, cakeNavigation, cakeLocation } from "./cake-level";
import { createOfficeWorld } from "./office-world";
import { OFFICE_SPAWN, OFFICE_EXIT, OFFICE_ENEMIES, OFFICE_PICKUPS, officeNavigation, officeLocation, officeGroundHeight, officeCanStand, officeEnemyTarget } from "./office-level";
import { createHippoWorld } from "./hippo-world";
import { HIPPO_SPAWN, HIPPO_SPAWNS, hippoNavigation } from "./hippo-level";
export type LevelId = "station" | "outbreak" | "lakehouse" | "bakery" | "office" | "hippos";
export const LEVEL_ORDER: readonly LevelId[] = [
  "station",
  "outbreak",
  "lakehouse",
  "bakery",
  "hippos",
  "office",
];
export function nextLevel(id: LevelId): LevelId | null {
  return LEVEL_ORDER[LEVEL_ORDER.indexOf(id) + 1] ?? null;
}
export interface LevelDefinition {
  id: LevelId;
  name: string;
  enemyLabel: string;
  kind: "sentry" | "zombie" | "duck" | "cake" | "robot" | "hippo";
  spawn: Point;
  exit: Point;
  pickups: PickupDefinition[];
  enemySpawns: (Point & { elevation?: number })[];
  navigation: Navigation;
  createWorld: (scene: Scene) => World;
  locationName: (point: Point, feet?: number) => string;
  groundHeight?: (x: number, z: number, feet: number) => number;
  canStand?: (x: number, z: number, feet: number, radius: number) => boolean;
  enemyTarget?: (enemy: Vector3, player: Vector3) => Point;
  menuCamera: Vector3;
  menuYaw: number;
  spawnYaw: number;
  objectiveBefore: string;
  objectiveAfter: string;
  itemLabel: string;
  initialReserve: number;
}
export const LEVELS: Record<LevelId, LevelDefinition> = {
  hippos: {
    id:"hippos",name:"Hippo Nap",enemyLabel:"SCHLAFENDE HIPPOS",kind:"hippo",
    spawn:HIPPO_SPAWN,exit:HIPPO_SPAWN,pickups:[],enemySpawns:HIPPO_SPAWNS,
    navigation:hippoNavigation,createWorld:createHippoWorld,locationName:()=>"HIPPO-KINDERSTUBE",
    menuCamera:new Vector3(HIPPO_SPAWN.x,2.2,HIPPO_SPAWN.z),menuYaw:Math.PI,spawnYaw:Math.PI,
    objectiveBefore:"Jedes Baby-Hippo mit 3 Karotten füttern",objectiveAfter:"Alle Hippos schlafen satt und zufrieden",
    itemLabel:"Alle Hippos satt",initialReserve:0,
  },
  office: { id:"office", name:"Steel Horizon", enemyLabel:"KILLER ROBOTS", kind:"robot", spawn:OFFICE_SPAWN, exit:OFFICE_EXIT, pickups:OFFICE_PICKUPS, enemySpawns:OFFICE_ENEMIES, navigation:officeNavigation, createWorld:createOfficeWorld, locationName:officeLocation, groundHeight:officeGroundHeight, canStand:officeCanStand, enemyTarget:officeEnemyTarget, menuCamera:new Vector3(OFFICE_SPAWN.x,5.1,OFFICE_SPAWN.z), menuYaw:Math.PI, spawnYaw:Math.PI, objectiveBefore:"Access keycard on the executive floor", objectiveAfter:"Reach the lobby extraction elevator", itemLabel:"Access keycard", initialReserve:30 },
  bakery: {
    id: "bakery", name: "Sugar Rush", enemyLabel: "WÜTENDE KUCHEN", kind: "cake",
    spawn: CAKE_SPAWN, exit: CAKE_EXIT, pickups: CAKE_PICKUPS, enemySpawns: CAKE_ENEMIES,
    navigation: cakeNavigation, createWorld: createCakeWorld, locationName: cakeLocation,
    menuCamera: new Vector3(CAKE_SPAWN.x, 2.2, CAKE_SPAWN.z), menuYaw: Math.PI, spawnYaw: Math.PI,
    objectiveBefore: "Geheimrezept im Rezeptarchiv finden", objectiveAfter: "Lieferausgang erreichen",
    itemLabel: "Geheimrezept", initialReserve: 36,
  },
  station: {
    id: "station",
    name: "Lockdown",
    enemyLabel: "WACHDROHNEN",
    kind: "sentry",
    spawn: station.SPAWN,
    exit: station.EXIT,
    pickups: station.PICKUPS,
    enemySpawns: station.ENEMY_SPAWNS,
    navigation: {
      canOccupy: station.canOccupy,
      lineClear: station.lineClear,
      findPath: station.findPath,
    },
    createWorld,
    locationName: station.locationName,
    menuCamera: new Vector3(3.5 * station.CELL, 1.75, 11.5 * station.CELL),
    menuYaw: 2,
    spawnYaw: Math.PI,
    objectiveBefore: "Zugangskarte im Sicherheitslabor finden",
    objectiveAfter: "Ausgang in der Frachtschleuse erreichen",
    itemLabel: "Zugangskarte",
    initialReserve: 72,
  },
  outbreak: {
    id: "outbreak",
    name: "Dead Coast",
    enemyLabel: "ZOMBIES",
    kind: "zombie",
    spawn: OUTDOOR_SPAWN,
    exit: OUTDOOR_EXIT,
    pickups: OUTDOOR_PICKUPS,
    enemySpawns: OUTDOOR_ENEMIES,
    navigation: outdoorNavigation,
    createWorld: createOutdoorWorld,
    locationName: outdoorLocation,
    menuCamera: new Vector3(8 * station.CELL, 1.75, 30 * station.CELL),
    menuYaw: 2.4,
    spawnYaw: Math.PI,
    objectiveBefore: "Funkgerät am Kontrollpunkt Nord finden",
    objectiveAfter: "Safehouse im Hotel Miramar erreichen",
    itemLabel: "Funkgerät",
    initialReserve: 96,
  },
  lakehouse: {
    id: "lakehouse",
    name: "Lakehouse",
    enemyLabel: "GUMMIENTEN",
    kind: "duck",
    spawn: LAKE_SPAWN,
    exit: LAKE_EXIT,
    pickups: LAKE_PICKUPS,
    enemySpawns: LAKE_ENEMIES,
    navigation: lakeNavigation,
    createWorld: createLakeWorld,
    locationName: lakeLocation,
    groundHeight: lakeGroundHeight,
    canStand: lakeCanStand,
    enemyTarget: lakeEnemyTarget,
    menuCamera: new Vector3(33, 2.2, 27),
    menuYaw: 0.85,
    spawnYaw: 0,
    objectiveBefore: "Bootsschlüssel im Obergeschoss finden",
    objectiveAfter: "Zum Fluchtboot am Steg gelangen",
    itemLabel: "Bootsschlüssel",
    initialReserve: 96,
  },
};
