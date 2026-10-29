import { CELL, tileAt, world } from "./level";
import type { PickupDefinition } from "./level";
import { createNavigation } from "./navigation";
export const OFFICE_FLOOR_HEIGHT = 3.6;
export const officeGrid = Array.from({ length: 19 }, (_, z) => Array.from({ length: 19 }, (_, x) => x > 0 && x < 18 && z > 0 && z < 18));
export const OFFICE_SPAWN = world(9, 16), OFFICE_EXIT = world(9, 2);
export const OFFICE_ENEMIES = [[4,15],[14,15],[9,12],[4,10],[14,10],[9,7],[4,5],[14,5],[9,3]].map(([x,z], i)=>({...world(x,z),elevation:i<3?0:i<6?OFFICE_FLOOR_HEIGHT:2*OFFICE_FLOOR_HEIGHT}));
export const OFFICE_PICKUPS: PickupDefinition[] = [{...world(9,3),elevation:2*OFFICE_FLOOR_HEIGHT,kind:"card"}, ...[[3,14,0],[15,12,0],[9,9,OFFICE_FLOOR_HEIGHT],[3,6,OFFICE_FLOOR_HEIGHT],[15,4,2*OFFICE_FLOOR_HEIGHT]].map(([x,z,elevation])=>({...world(x,z),elevation,kind:"ammo" as const})), ...[[15,16,0],[3,8,OFFICE_FLOOR_HEIGHT],[9,5,2*OFFICE_FLOOR_HEIGHT]].map(([x,z,elevation])=>({...world(x,z),elevation,kind:"health" as const}))];
export const officeNavigation = createNavigation(officeGrid, []);
// Separate flights prevent floor selection from changing halfway up a ramp.
export const OFFICE_STAIRS = [
  { x1:6*CELL, x2:9*CELL, base:0 },
  { x1:10*CELL, x2:13*CELL, base:OFFICE_FLOOR_HEIGHT },
];
export const OFFICE_STAIR_BOTTOM=world(7,6), OFFICE_STAIR_TOP=world(7,12);
export function onOfficeStairs(p:{x:number;z:number}) {
  return OFFICE_STAIRS.some(s=>p.x>=s.x1&&p.x<s.x2&&p.z>=7*CELL&&p.z<13*CELL);
}
export function officeGroundHeight(x:number,z:number,feet:number) {
  for(const s of OFFICE_STAIRS) {
    if(x>=s.x1&&x<s.x2&&z>=7*CELL&&z<13*CELL && feet>=s.base-.42 && feet<s.base+OFFICE_FLOOR_HEIGHT+.5)
      return s.base+Math.max(0,Math.min(1,(z-7*CELL)/(5*CELL)))*OFFICE_FLOOR_HEIGHT;
  }
  return Math.max(0,Math.min(2,Math.floor((feet+.42)/OFFICE_FLOOR_HEIGHT)))*OFFICE_FLOOR_HEIGHT;
}
export function officeCanStand(x:number,z:number,feet:number,_radius:number) {
  return officeGroundHeight(x,z,feet)<=feet+.38;
}
export function officeEnemyTarget(enemy:{x:number;y:number;z:number},player:{x:number;y:number;z:number}) {
  const delta=player.y-1.65-enemy.y;
  if(Math.abs(delta)<.5)return player;
  const up=delta>0;
  const s=up?(enemy.y<OFFICE_FLOOR_HEIGHT-.2?OFFICE_STAIRS[0]:OFFICE_STAIRS[1]):(enemy.y>OFFICE_FLOOR_HEIGHT+.2?OFFICE_STAIRS[1]:OFFICE_STAIRS[0]);
  const x=(s.x1+s.x2)/2;
  const inFlight=enemy.x>=s.x1&&enemy.x<s.x2&&enemy.z>=7*CELL&&enemy.z<13*CELL;
  if(inFlight) {
    if(up&&enemy.y>=s.base+OFFICE_FLOOR_HEIGHT-.12)return {x:s.x2+1,z:12.5*CELL};
    if(!up&&enemy.y<=s.base+.12)return {x:s.x2+1,z:6.5*CELL};
    return {x,z:(up?12.5:6.5)*CELL};
  }
  return {x,z:(up?6.5:13.5)*CELL};
}
export function officeLocation(p:{x:number;z:number}, feet=0) { const floor=Math.max(0,Math.min(2,Math.round(feet/OFFICE_FLOOR_HEIGHT))); return `${["LOBBY","BÜROETAGE 02","EXECUTIVE FLOOR"][floor]} · ${tileAt(p).x < 7 ? "WEST FLÜGEL" : tileAt(p).x > 12 ? "OST FLÜGEL" : "ATRIUM"}`; }
