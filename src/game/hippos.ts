import { MeshBuilder, TransformNode } from "./babylon";
import type { Scene, StandardMaterial, Vector3 } from "./babylon";
import type { Enemy } from "./enemies";
import type { Point } from "./level";
import { hippoNavigation } from "./hippo-level";
export function createHippos(scene:Scene,m:Record<string,StandardMaterial>,spawns:Point[]):Enemy[]{
  return spawns.map((p,i)=>{
    const root=new TransformNode(`baby-hippo-${i}`,scene);root.position.set(p.x,0,p.z);
    const sphere=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:string)=>{
      const q=MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene);q.parent=root;q.position.set(x,y,z);q.scaling.set(w,h,d);q.material=m[mat];q.metadata={enemy:i};return q;
    };
    sphere("hippo-body",0,.65,-.12,1.55,1.12,1.95,"hippo");
    sphere("hippo-head",0,.94,.7,1.24,.95,1.1,"hippo");
    sphere("hippo-muzzle",0,.73,1.2,1.3,.6,.85,"muzzle");
    const legs:TransformNode[]=[];
    for(const side of [-1,1]){
      sphere("hippo-ear",side*.5,1.43,.53,.32,.35,.23,"hippo");
      sphere("hippo-ear-inner",side*.5,1.44,.65,.17,.21,.05,"pink");
      sphere("hippo-eye",side*.39,1.2,1.1,.17,.19,.1,"dark");
      sphere("hippo-eye-glint",side*.4,1.24,1.15,.05,.05,.03,"white");
      sphere("hippo-nostril",side*.32,.95,1.53,.13,.09,.04,"dark");
      for(const z of [-.6,.5])legs.push(sphere("hippo-foot",side*.55,.22,z,.43,.45,.5,"hippo"));
      const arm=sphere("hippo-cuddle-arm",side*.76,.65,.64,.4,.38,.65,"hippo");
      arm.rotation.y=side*.5;
    }
    const visor=sphere("hippo-smile",0,.61,1.59,.6,.035,.025,"dark");
    for(let n=0;n<3;n++){
      const pip=sphere(`hippo-carrot-${n}`, (n-1)*.34,1.9,0,.18,.3,.18,"carrot");pip.isPickable=false;
    }
    return {root,health:3,active:false,cooldown:0,path:[],pathTimer:0,legs,walk:i,flash:0,visor,dying:0};
  });
}
export function updateHippo(e:Enemy,player:Vector3,dt:number,hug:(amount:number)=>void){
  if(e.health<=0){
    e.dying=Math.min(1,e.dying+dt);e.root.rotation.z=e.dying*.22;
    e.root.scaling.y=1-e.dying*.22;
    e.root.position.y=0;
    for(const leg of e.legs)leg.rotation.x=0;
    for(const mesh of e.root.getChildMeshes())if(mesh.name==="hippo-cuddle-arm")mesh.rotation.y=0;
    for(const mesh of e.root.getChildMeshes())if(mesh.name==="hippo-eye")mesh.scaling.y=.018;
    // Slow breathing makes the sleeping state visible.
    e.root.scaling.x=1+Math.sin(e.walk+=dt*1.5)*.012;
    return;
  }
  const p=e.root.position;
  const dx=player.x-p.x,dz=player.z-p.z,distance=Math.hypot(dx,dz);
  e.root.rotation.y=Math.atan2(dx,dz);
  e.cooldown=Math.max(0,e.cooldown-dt);
  e.flash=Math.max(0,e.flash-dt);
  if(distance>1.45){
    const step=Math.min(distance-1.45,1.65*dt);
    if(hippoNavigation.canOccupy(p.x+dx/distance*step,p.z,.55))p.x+=dx/distance*step;
    if(hippoNavigation.canOccupy(p.x,p.z+dz/distance*step,.55))p.z+=dz/distance*step;
    e.walk+=dt*7;
    e.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(e.walk+i*Math.PI)*.3);
  }else for(const leg of e.legs)leg.rotation.x=0;
  if(distance<1.75&&Math.abs(player.y-1.65)<1.1&&e.cooldown===0){
    e.cooldown=1.6;e.flash=.55;hug(8);
  }
  p.y=Math.abs(Math.sin(e.walk))*.035;
  e.root.rotation.x=e.flash>0?-.12:0;
  for(const mesh of e.root.getChildMeshes())if(mesh.name==="hippo-cuddle-arm"){
    mesh.rotation.y=Math.sign(mesh.position.x)*(e.flash>0?-.65:.5);
    mesh.position.z=e.flash>0?.95:.64;
  }
}
