import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
  }

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }

  async readAsDataURL(blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
    this.onloadend?.();
  }
}

globalThis.FileReader = NodeFileReader;

const outputDir = path.resolve("public/models");
const exporter = new GLTFExporter();

function createMaterial(color, emissive = "#000000", metalness = 0.3, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.35,
    metalness,
    roughness,
  });
}

function addFloatAnimation(root, target, axis, amplitude, durationSeconds) {
  const times = [0, durationSeconds * 0.5, durationSeconds];
  const values = [
    target.position[axis] - amplitude,
    target.position[axis] + amplitude,
    target.position[axis] - amplitude,
  ];
  const track = new THREE.NumberKeyframeTrack(`${target.name}.position[${axis}]`, times, values);
  const clip = new THREE.AnimationClip(`${target.name}-float`, durationSeconds, [track]);
  root.animations = [...(root.animations || []), clip];
}

function buildCrystalBloom() {
  const root = new THREE.Group();
  root.name = "CrystalBloom";

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 1),
    createMaterial("#7ce7ff", "#1d92ff", 0.45, 0.16),
  );
  core.name = "core";
  root.add(core);

  for (let index = 0; index < 9; index += 1) {
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.6, 6),
      createMaterial(index % 2 === 0 ? "#b9ffdb" : "#66b7ff", "#2f6fff", 0.25, 0.2),
    );
    const angle = (index / 9) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 1.05, 0.15, Math.sin(angle) * 1.05);
    shard.rotation.z = Math.PI * 0.22;
    shard.rotation.x = Math.sin(angle) * 0.35;
    shard.lookAt(0, 0.25, 0);
    root.add(shard);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.08, 24, 120),
    createMaterial("#ffd36a", "#ff8d3a", 0.5, 0.18),
  );
  ring.name = "ring";
  ring.rotation.x = Math.PI / 2.7;
  root.add(ring);

  addFloatAnimation(root, core, "y", 0.18, 3.2);
  return root;
}

function buildOrbGarden() {
  const root = new THREE.Group();
  root.name = "OrbGarden";

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.8, 0.5, 40),
    createMaterial("#233a5c", "#102030", 0.1, 0.85),
  );
  base.position.y = -0.9;
  root.add(base);

  const stalkMaterial = createMaterial("#ff8f5a", "#a43f1d", 0.15, 0.6);
  const orbMaterial = createMaterial("#ffef87", "#ffb347", 0.3, 0.18);

  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 12), stalkMaterial);
    stem.position.set(Math.cos(angle) * 0.85, 0.2, Math.sin(angle) * 0.85);
    stem.rotation.z = Math.cos(angle) * 0.18;
    stem.rotation.x = Math.sin(angle) * 0.14;
    root.add(stem);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 28, 28), orbMaterial);
    orb.name = `orb${index}`;
    orb.position.set(Math.cos(angle) * 1.2, 1.45 + (index % 2) * 0.18, Math.sin(angle) * 1.2);
    root.add(orb);
    addFloatAnimation(root, orb, "y", 0.14 + index * 0.02, 2.8 + index * 0.15);
  }

  const centerOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 32, 32),
    createMaterial("#7cf7c9", "#1dbb7e", 0.38, 0.16),
  );
  centerOrb.name = "centerOrb";
  centerOrb.position.y = 0.55;
  root.add(centerOrb);
  addFloatAnimation(root, centerOrb, "y", 0.12, 3.6);

  return root;
}

function buildPortalStack() {
  const root = new THREE.Group();
  root.name = "PortalStack";

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.45, 2.5),
    createMaterial("#1f2537", "#0f1627", 0.22, 0.82),
  );
  base.position.y = -1.1;
  root.add(base);

  for (let index = 0; index < 4; index += 1) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.8 + index * 0.32, 0.08, 20, 120),
      createMaterial(index % 2 === 0 ? "#76d7ff" : "#ff7fd1", index % 2 === 0 ? "#2669ff" : "#b13fff", 0.42, 0.22),
    );
    torus.name = `portal${index}`;
    torus.position.y = -0.4 + index * 0.52;
    torus.rotation.x = Math.PI / 2;
    torus.rotation.z = index * 0.28;
    root.add(torus);
  }

  const pillar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 2.2, 8, 18),
    createMaterial("#f1f5ff", "#7ba4ff", 0.55, 0.12),
  );
  pillar.position.y = 0.15;
  root.add(pillar);

  return root;
}

function buildSignalTotem() {
  const root = new THREE.Group();
  root.name = "SignalTotem";

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.7, 0.45, 36),
    createMaterial("#1c2333", "#0c1018", 0.25, 0.82),
  );
  base.position.y = -1.05;
  root.add(base);

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 3.1, 0.4),
    createMaterial("#d8e7ff", "#5f86ff", 0.52, 0.14),
  );
  spine.position.y = 0.3;
  root.add(spine);

  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7 + index * 0.23, 0.05, 18, 100),
      createMaterial(index % 2 === 0 ? "#6fd3ff" : "#78ffcb", "#2f74ff", 0.45, 0.18),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.35 + index * 0.68;
    ring.rotation.z = index * 0.3;
    root.add(ring);
  }

  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    createMaterial("#fff29a", "#ffb347", 0.35, 0.16),
  );
  beacon.name = "beacon";
  beacon.position.y = 2.08;
  root.add(beacon);
  addFloatAnimation(root, beacon, "y", 0.15, 2.9);

  return root;
}

function buildDataBloom() {
  const root = new THREE.Group();
  root.name = "DataBloom";

  const core = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.62, 0),
    createMaterial("#f0f6fc", "#7aa2ff", 0.48, 0.16),
  );
  core.name = "core";
  root.add(core);

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const petal = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.15, 0.16),
      createMaterial(index % 2 === 0 ? "#79c0ff" : "#ffa657", "#6e40c9", 0.3, 0.24),
    );
    petal.position.set(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
    petal.lookAt(0, 0, 0);
    petal.rotateX(Math.PI / 2);
    root.add(petal);
  }

  const halo = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.15, 0.08, 120, 12),
    createMaterial("#8b5cf6", "#58a6ff", 0.38, 0.2),
  );
  halo.rotation.x = Math.PI / 5;
  halo.rotation.y = Math.PI / 8;
  root.add(halo);

  addFloatAnimation(root, core, "y", 0.12, 3.4);
  return root;
}

function buildMonoRover() {
  const root = new THREE.Group();
  root.name = "MonoRover";

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.6, 1.2),
    createMaterial("#e6edf3", "#6e7681", 0.4, 0.22),
  );
  body.position.y = -0.1;
  root.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.5, 0.9),
    createMaterial("#79c0ff", "#1f6feb", 0.42, 0.18),
  );
  cabin.position.set(0.15, 0.48, 0);
  root.add(cabin);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 10),
    createMaterial("#f0f6fc", "#ffa657", 0.2, 0.35),
  );
  antenna.position.set(0.35, 1.15, 0);
  root.add(antenna);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 16, 0, Math.PI),
    createMaterial("#ffa657", "#ff7b72", 0.25, 0.28),
  );
  dish.rotation.z = -Math.PI / 2;
  dish.position.set(0.35, 1.58, 0);
  root.add(dish);

  const wheelMaterial = createMaterial("#1f2328", "#0d1117", 0.15, 0.88);
  const wheelOffsets = [
    [-0.78, -0.58, 0.64],
    [0.78, -0.58, 0.64],
    [-0.78, -0.58, -0.64],
    [0.78, -0.58, -0.64],
  ];

  for (const [x, y, z] of wheelOffsets) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 24), wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    root.add(wheel);
  }

  return root;
}

function exportBinary(scene) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(Buffer.from(result)),
      (error) => reject(error),
      {
        binary: true,
        onlyVisible: true,
        animations: scene.animations || [],
      },
    );
  });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const models = [
    ["crystal-bloom.glb", buildCrystalBloom()],
    ["orb-garden.glb", buildOrbGarden()],
    ["portal-stack.glb", buildPortalStack()],
    ["signal-totem.glb", buildSignalTotem()],
    ["data-bloom.glb", buildDataBloom()],
    ["mono-rover.glb", buildMonoRover()],
  ];

  for (const [filename, scene] of models) {
    const binary = await exportBinary(scene);
    await fs.writeFile(path.join(outputDir, filename), binary);
  }

  console.log(`Generated ${models.length} sample GLB models in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
