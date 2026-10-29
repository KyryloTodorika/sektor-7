import { world } from "./level";
import { createNavigation } from "./navigation";
export const HIPPO_SPAWN=world(7,13);
export const HIPPO_SPAWNS=[[4,10],[10,10],[7,8],[3,5],[11,5],[7,3]].map(([x,z])=>world(x,z));
export const hippoGrid=Array.from({length:16},(_,z)=>Array.from({length:16},(_,x)=>x>0&&x<15&&z>0&&z<15));
export const hippoNavigation=createNavigation(hippoGrid,[]);
