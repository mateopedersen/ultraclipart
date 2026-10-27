import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(1600, 1280);
renderer.setPixelRatio(1);
renderer.setClearColor(0xffffff, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(32, 1.25, 0.1, 100);
camera.position.set(5.5, 5.1, 13.4);
camera.lookAt(0, 1.5, 0);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, 0.025).texture;
scene.environmentIntensity = 0.65;
scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb9de, 0.75));
const key = new THREE.DirectionalLight(0xfffcf6, 3.2);
key.position.set(-4, 8, 6);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -6;
key.shadow.camera.far = 25;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.025;
key.shadow.radius = 5;
key.shadow.blurSamples = 16;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbadfff, 2.1);
rim.position.set(4, 6, -5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xe3f2ff, 0.9);
fill.position.set(6, 3, 7);
scene.add(fill);

const physical = (color, props = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.25,
    metalness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    ...props,
  });
const white = physical(0xf9fcff, { roughness: 0.32, metalness: 0.03 });
const blue = physical(0x1264c8);
const deep = physical(0x1e5090, { roughness: 0.3 });
const ice = physical(0xa5d8ff, { roughness: 0.2, metalness: 0.15 });
function mesh(geometry, material, position, parent = scene) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function disk(radius, height, y, material) {
  const profile = [
    [0, 0],
    [radius - 0.08, 0],
    [radius - 0.025, 0.025],
    [radius, 0.07],
    [radius, height - 0.07],
    [radius - 0.025, height - 0.025],
    [radius - 0.08, height],
    [0, height],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return mesh(new THREE.LatheGeometry(profile, 144), material, [0, y, 0]);
}
disk(3.6, 0.23, 0.04, deep);
disk(3.63, 0.28, 0.23, white);
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 512;
const shadowContext = shadowCanvas.getContext('2d');
const contactShadow = shadowContext.createRadialGradient(256, 256, 60, 256, 256, 250);
contactShadow.addColorStop(0, 'rgba(32, 65, 105, .22)');
contactShadow.addColorStop(0.65, 'rgba(32, 65, 105, .10)');
contactShadow.addColorStop(1, 'rgba(32, 65, 105, 0)');
shadowContext.fillStyle = contactShadow;
shadowContext.fillRect(0, 0, 512, 512);
const floor = mesh(
  new THREE.PlaneGeometry(9.5, 8.5),
  new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  }),
  [0, 0, 0],
);
floor.rotation.x = -Math.PI / 2;
floor.castShadow = false;
floor.receiveShadow = false;

const font = await new FontLoader().loadAsync(
  '/vendor/examples/fonts/helvetiker_bold.typeface.json',
);
const textGroup = new THREE.Group();
scene.add(textGroup);
const widths = [];
const geometries = [];
for (const character of '404') {
  const geometry = new TextGeometry(character, {
    font,
    size: 2.45,
    depth: 0.48,
    curveSegments: 32,
    bevelEnabled: true,
    bevelThickness: 0.095,
    bevelSize: 0.065,
    bevelSegments: 8,
    steps: 1,
  });
  geometry.computeBoundingBox();
  geometry.translate(-geometry.boundingBox.min.x, -geometry.boundingBox.min.y, -0.24);
  geometry.computeBoundingBox();
  widths.push(geometry.boundingBox.max.x);
  geometries.push(geometry);
}
const total = widths.reduce((a, b) => a + b, 0) + 0.32;
let cursor = -total / 2;
for (let i = 0; i < 3; i++) {
  mesh(
    geometries[i],
    [i === 1 ? white : blue, i === 1 ? ice : deep],
    [cursor, 0.535, 0.35],
    textGroup,
  );
  cursor += widths[i] + 0.16;
}
textGroup.rotation.y = -0.08;

const loader = new THREE.TextureLoader();
async function artworkCard(url, x, y, z, rotation) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.set(-0.13, rotation * 0.65, rotation);
  scene.add(group);
  mesh(
    new RoundedBoxGeometry(1.65, 2.03, 0.16, 6, 0.12),
    physical(0xd4e7fc, { roughness: 0.4 }),
    [0.035, -0.035, -0.035],
    group,
  );
  mesh(new RoundedBoxGeometry(1.65, 2.03, 0.13, 6, 0.12), white, [0, 0, 0.03], group);
  const texture = await loader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const plane = mesh(
    new THREE.PlaneGeometry(1.38, 1.38),
    new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.8,
      depthWrite: false,
    }),
    [0, 0.13, 0.11],
    group,
  );
  plane.castShadow = false;
  mesh(
    new RoundedBoxGeometry(0.92, 0.035, 0.025, 3, 0.015),
    physical(0xb3cce5),
    [-0.16, -0.71, 0.12],
    group,
  );
  mesh(
    new RoundedBoxGeometry(0.6, 0.027, 0.025, 3, 0.012),
    physical(0xd4e3f3),
    [-0.32, -0.82, 0.12],
    group,
  );
}
await artworkCard('/art/heart', -2.38, 2.6, -0.9, 0.15);
await artworkCard('/art/strawberry', 2.45, 2.45, -1.1, -0.17);

// A real torus bezel and refractive glass, held in a physical slanted frame.
const loupe = new THREE.Group();
loupe.position.set(2.86, 1.8, 1.55);
loupe.rotation.set(0.12, -0.24, 0.65);
scene.add(loupe);
const silver = physical(0xa4bdd5, { metalness: 0.86, roughness: 0.16 });
mesh(new THREE.TorusGeometry(0.64, 0.105, 32, 128), deep, [0, 0, -0.045], loupe);
mesh(new THREE.TorusGeometry(0.63, 0.075, 32, 128), silver, [0, 0, 0.025], loupe);
mesh(new THREE.TorusGeometry(0.54, 0.018, 20, 100), ice, [0, 0, 0.065], loupe);
const glass = new THREE.MeshPhysicalMaterial({
  color: 0xd9f1ff,
  transmission: 0.88,
  transparent: true,
  opacity: 0.5,
  roughness: 0.04,
  thickness: 0.14,
  ior: 1.45,
  metalness: 0,
  clearcoat: 1,
  envMapIntensity: 1.5,
});
const lens = mesh(new THREE.SphereGeometry(0.535, 80, 48), glass, [0, 0, 0.025], loupe);
lens.scale.z = 0.15;
lens.castShadow = false;
mesh(new THREE.CapsuleGeometry(0.115, 0.9, 12, 32), deep, [0, -1.17, -0.01], loupe);
mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.16, 32), silver, [0, -0.7, -0.01], loupe);
const shine = new THREE.Mesh(
  new THREE.TorusGeometry(0.44, 0.012, 8, 40, 1.13),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
);
shine.position.set(0, 0, 0.112);
shine.rotation.z = 1.1;
loupe.add(shine);

await renderer.compileAsync(scene, camera);
renderer.render(scene, camera);
window.render404Ready = true;
