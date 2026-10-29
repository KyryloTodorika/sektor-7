import { Color3,Color4,HemisphericLight,MeshBuilder,StandardMaterial,TransformNode,Vector3,DynamicTexture } from "./babylon";
import type { Scene } from "./babylon";
import type { World } from "./world";
export function createHippoWorld(scene:Scene):World{
 scene.clearColor=new Color4(.61,.82,.87,1);
 const light=new HemisphericLight("hippo-sun",new Vector3(.3,1,.4),scene);light.intensity=1.15;
 const materials:Record<string,StandardMaterial>={};
 for(const[n,hex]of Object.entries({grass:"#83b76d",sand:"#e6cd9e",water:"#75c3d0",hippo:"#9694b9",muzzle:"#b4accb",pink:"#e6adbc",carrot:"#f99438",leaf:"#439e56",wood:"#a47c55",dark:"#3d4351",white:"#fff3dc",amber:"#ffd887",metal:"#aaaabb",trim:"#63816a",enemy:"#899578",enemyDark:"#6e765d",red:"#e8a79b"})){
 const mat=new StandardMaterial(`hippo-${n}`,scene);mat.diffuseColor=Color3.FromHexString(hex);materials[n]=mat;
 }
 const box=(n:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:string)=>{const q=MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene);q.position.set(x,y,z);q.material=materials[mat];return q;};
 box("hippo-meadow",22.4,-.15,22.4,39.2,.3,39.2,"grass");
 box("hippo-sandy-path",22.4,.005,22.4,5,.01,39,"sand");
 // The pool is shallow and walkable.
 const pool=MeshBuilder.CreateCylinder("hippo-wading-pool",{diameter:10,height:.05,tessellation:40},scene);pool.position.set(33,.03,17);pool.material=materials.water;pool.isPickable=false;
 for(const edge of [2.6,42.2])for(let t=3;t<43;t+=3){box("hippo-fence-post",t,.8,edge,.18,1.6,.18,"wood");box("hippo-fence-post",edge,.8,t,.18,1.6,.18,"wood");}
 for(const edge of [2.6,42.2])for(const y of [.45,1.15]){box("hippo-fence-rail",22.4,y,edge,39.6,.12,.12,"wood");box("hippo-fence-rail",edge,y,22.4,.12,.12,39.6,"wood");}
 for(const [x,z]of [[5,7],[39,35],[6,34]]){
 box("hippo-tree-trunk",x,1.4,z,.5,2.8,.5,"wood");const q=MeshBuilder.CreateSphere("hippo-tree",{diameter:4,segments:10},scene);q.position.set(x,3.6,z);q.material=materials.leaf;
 }
 const tex=new DynamicTexture("hippo-rules",{width:1024,height:256},scene,false);
 tex.drawText("3 KAROTTEN = GUTE NACHT",null,155,"bold 56px sans-serif","#fff3dc","#63816a",true);
 const signMat=new StandardMaterial("hippo-rules",scene);signMat.diffuseTexture=tex;signMat.emissiveColor=new Color3(.3,.3,.3);
 const sign=MeshBuilder.CreatePlane("hippo-feeding-sign",{width:10,height:2.5},scene);sign.position.set(22.4,3,3);sign.rotation.y=Math.PI;sign.material=signMat;
 const exit=new TransformNode("hippo-exit",scene);
 return{materials,doors:[],exit,animate(){}};
}
