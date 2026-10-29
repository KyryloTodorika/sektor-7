import {MeshBuilder,TransformNode} from "./babylon";
import type {Scene,Camera,StandardMaterial} from "./babylon";
export function createCarrot(scene:Scene,m:Record<string,StandardMaterial>){
 const q=MeshBuilder.CreateCylinder("carrot",{height:.65,diameterTop:.2,diameterBottom:.015,tessellation:10},scene);q.material=m.carrot;q.isPickable=false;
 for(const side of [-1,0,1]){const leaf=MeshBuilder.CreateBox("carrot-leaf",{width:.06,height:.32,depth:.04},scene);leaf.parent=q;leaf.position.set(side*.05,.43,0);leaf.rotation.z=side*.4;leaf.material=m.leaf;leaf.isPickable=false;}
 return q;
}
export class CarrotHand{
 root:TransformNode;private kick=0;
 constructor(scene:Scene,camera:Camera,m:Record<string,StandardMaterial>){this.root=new TransformNode("carrot-hand",scene);this.root.parent=camera;const carrot=createCarrot(scene,m);carrot.parent=this.root;carrot.rotation.x=.7;for(const mesh of [carrot,...carrot.getChildMeshes()])mesh.renderingGroupId=1;this.update(0,0,0,0);}
 fire(){this.kick=1;}
 update(dt:number,time:number,speed:number,_reload:number){this.kick=Math.max(0,this.kick-dt*4);this.root.position.set(.35,-.25+Math.sin(time*8)*speed*.01-this.kick*.15,.65);this.root.rotation.x=-this.kick*.6;}
 setVisible(v:boolean){this.root.setEnabled(v);}
}
