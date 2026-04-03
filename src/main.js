import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const sceneRoot = document.getElementById("scene-root");
const shadowStage = document.getElementById("shadow-stage");
const shadowCanvas = document.getElementById("shadow-canvas");
const shadowContext = shadowCanvas.getContext("2d");
const webcam = document.getElementById("webcam");
const webcamOverlay = document.getElementById("webcam-overlay");
const startButton = document.getElementById("start-button");
const cameraCtaState = document.getElementById("camera-cta-state");
const cameraCtaLabel = document.querySelector(".camera-cta-label");
const audioToggleButton = document.getElementById("audio-toggle");
const audioCtaState = document.getElementById("audio-cta-state");
const recordButton = document.getElementById("record-button");
const recordCtaState = document.getElementById("record-cta-state");
const stopRecordButton = document.getElementById("stop-record-button");
const stopRecordCtaState = document.getElementById("stop-record-cta-state");
const downloadRecordButton = document.getElementById("download-record-button");
const downloadRecordCtaState = document.getElementById("download-record-cta-state");
const recordingPreviewCard = document.getElementById("recording-preview-card");
const recordingPreviewVideo = document.getElementById("recording-preview-video");
const shareRecordButton = document.getElementById("share-record-button");
const shareRecordCtaState = document.getElementById("share-record-cta-state");
const trackingStatus = document.getElementById("tracking-status");
const modelFileInput = document.getElementById("model-file");
const modelUrlForm = document.getElementById("model-url-form");
const modelUrlInput = document.getElementById("model-url");
const modelStatus = document.getElementById("model-status");
const presetModelSelect = document.getElementById("preset-model-select");
const loadPresetButton = document.getElementById("load-preset-button");
const landmarkToggle = document.getElementById("landmark-toggle");
const landmarksVideoButton = document.getElementById("landmarks-video");
const landmarksOnlyButton = document.getElementById("landmarks-only");
const prototypeShadowButton = document.getElementById("prototype-shadow");
const prototype3dButton = document.getElementById("prototype-3d");
const prototypeMaskButton = document.getElementById("prototype-mask");
const prototypeLayerButton = document.getElementById("prototype-layer");
const prototypeMatrixButton = document.getElementById("prototype-matrix");
const shareButton = document.getElementById("share-button");
const heroTitle = document.getElementById("hero-title");
const heroIntro = document.getElementById("hero-intro");
const layerMixCard = document.getElementById("layer-mix-card");
const layerMixRange = document.getElementById("layer-mix-range");
const layerMixValue = document.getElementById("layer-mix-value");
const matrixFaceCard = document.getElementById("matrix-face-card");
const matrixFaceRange = document.getElementById("matrix-face-range");
const matrixFaceValue = document.getElementById("matrix-face-value");
const stage = document.querySelector(".stage");

const overlayContext = webcamOverlay.getContext("2d");
const gltfLoader = new GLTFLoader();
const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
const spotAudio = new Audio(`${import.meta.env.BASE_URL}audio/tabuspot.mp3`);
spotAudio.preload = "auto";
let audioContext = null;
let spotAudioSource = null;
let recordingDestination = null;
let recordingDownloadUrl = null;
let recordingPreviewUrl = null;

const prototypeCopy = {
  shadow: {
    title: "Tabù simulator",
    intro:
      "Il prototipo trasforma webcam, volto e mani in una silhouette teatrale ispirata agli spot Tabù, mantenendo tracking live e logo sul palmo aperto.",
  },
  scene3d: {
    title: "3D Head Tracking",
    intro:
      "Il prototipo usa la webcam del device per stimare posizione e distanza del volto. Lo spostamento della testa orbita la camera attorno alla scena 3D; avvicinandoti o allontanandoti cambi lo zoom.",
  },
  mask3d: {
    title: "Palloncino",
    intro:
      "Una testa 3D morbida e minimale segue la testa in tempo reale con occhi e bocca reattivi, come un personaggio a palloncino.",
  },
  layer: {
    title: "Layers",
    intro:
      "Una vista full-screen mostra tutti i landmark disponibili del tracking, inclusi volto, mani e pose. Il blend ti permette di miscelare camera e layer dal 0% al 100%.",
  },
  matrix: {
    title: "Matrix",
    intro:
      "Una pioggia di simboli verdi scende sullo schermo. Quando attivi la webcam, volto, mani e posa vengono trasformati in un'apparizione fatta solo di landmark dentro il flusso.",
  },
};

const prototypeQueryMap = {
  shadow: "shadow",
  scene3d: "scene3d",
  mask3d: "mask3d",
  layer: "layer",
  matrix: "matrix",
};

const FACE_OVAL_INDEXES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67,
  109,
];
const MOUTH_OUTER_INDEXES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91,
  146,
];
const MOUTH_INNER_INDEXES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const HAND_FINGER_CHAINS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];
const POSE_PREVIEW_CHAINS = [
  [11, 13, 15],
  [12, 14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
];
const SHOULDER_LEFT_INDEX = 11;
const SHOULDER_RIGHT_INDEX = 12;
const ELBOW_LEFT_INDEX = 13;
const ELBOW_RIGHT_INDEX = 14;
const WRIST_LEFT_INDEX = 15;
const WRIST_RIGHT_INDEX = 16;
const HIP_LEFT_INDEX = 23;
const HIP_RIGHT_INDEX = 24;

const state = {
  prototype: "scene3d",
  previewMode: "video-landmarks",
  videoStream: null,
  animationFrameId: 0,
  lastVideoTime: -1,
  activeObjectUrl: null,
  loadedModelRoot: null,
  faceLandmarker: null,
  holistic: null,
  holisticBusy: false,
  latestHolisticResults: null,
  latestFaceLandmarks: null,
  segmentationCanvas: document.createElement("canvas"),
  palmLogoCandidate: null,
  layerMix: 100,
  mediaRecorder: null,
  recordingChunks: [],
  isRecordingShadow: false,
  recordingIntroStartedAt: 0,
  recordingMimeType: "",
  lastRecordingBlob: null,
  isRecordingCountdown: false,
  recordingCountdownStartedAt: 0,
  matrixSampleCanvas: document.createElement("canvas"),
  matrixColumns: [],
  lastMatrixFrameTime: 0,
  matrixSubjectStrength: 0,
  matrixFaceMix: 25,
  isDraggingView: false,
  activePointerId: null,
  lastPointerX: 0,
  lastPointerY: 0,
};

const manualView = { yaw: 0, pitch: 0 };
const smoothedHead = { yaw: 0, pitch: 0, roll: 0, z: 0.5, x: 0, y: 0 };
const targetHead = { yaw: 0, pitch: 0, roll: 0, z: 0.5, x: 0, y: 0 };

const scene = new THREE.Scene();
scene.background = new THREE.Color("#08111f");
scene.fog = new THREE.Fog("#08111f", 14, 30);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.cursor = "grab";
sceneRoot.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight("#9ad1ff", "#09111f", 1.35));
const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
keyLight.position.set(5, 8, 4);
scene.add(keyLight);
const fillLight = new THREE.PointLight("#4db5ff", 30, 30, 2);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const stageGroup = new THREE.Group();
scene.add(stageGroup);
const contentGroup = new THREE.Group();
stageGroup.add(contentGroup);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(7.5, 96),
  new THREE.MeshStandardMaterial({
    color: "#0f2037",
    metalness: 0.2,
    roughness: 0.85,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.8;
stageGroup.add(floor);

const grid = new THREE.GridHelper(16, 24, "#4db5ff", "#1b3555");
grid.position.y = -1.79;
stageGroup.add(grid);

const maskGroup = new THREE.Group();
maskGroup.visible = false;
scene.add(maskGroup);

const maskHead = new THREE.Mesh(
  new THREE.SphereGeometry(1.9, 48, 48),
  new THREE.MeshStandardMaterial({
    color: "#f5dcc8",
    metalness: 0.08,
    roughness: 0.82,
  }),
);
maskHead.scale.set(0.95, 1.12, 0.9);
maskGroup.add(maskHead);

const maskNose = new THREE.Mesh(
  new THREE.ConeGeometry(0.18, 0.55, 24),
  new THREE.MeshStandardMaterial({ color: "#e8bea4", roughness: 0.9 }),
);
maskNose.rotation.x = Math.PI / 2;
maskNose.position.set(0, -0.05, 1.28);
maskGroup.add(maskNose);

const maskEyeWhiteLeft = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 24, 24),
  new THREE.MeshStandardMaterial({ color: "#fffdf8", roughness: 0.6 }),
);
maskEyeWhiteLeft.scale.set(1.55, 0.7, 0.35);
maskEyeWhiteLeft.position.set(-0.58, 0.35, 1.34);
maskGroup.add(maskEyeWhiteLeft);

const maskEyeWhiteRight = maskEyeWhiteLeft.clone();
maskEyeWhiteRight.position.x = 0.58;
maskGroup.add(maskEyeWhiteRight);

const maskPupilLeft = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 18, 18),
  new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.35 }),
);
maskPupilLeft.position.set(-0.58, 0.35, 1.52);
maskGroup.add(maskPupilLeft);

const maskPupilRight = maskPupilLeft.clone();
maskPupilRight.position.x = 0.58;
maskGroup.add(maskPupilRight);

const maskMouthOuter = new THREE.Mesh(
  new THREE.TorusGeometry(0.46, 0.11, 18, 64),
  new THREE.MeshStandardMaterial({ color: "#fff8f1", roughness: 0.45 }),
);
maskMouthOuter.rotation.x = Math.PI * 0.12;
maskMouthOuter.position.set(0, -0.82, 1.3);
maskGroup.add(maskMouthOuter);

const maskMouthInner = new THREE.Mesh(
  new THREE.SphereGeometry(0.24, 24, 24),
  new THREE.MeshStandardMaterial({ color: "#40281d", roughness: 0.95 }),
);
maskMouthInner.scale.set(1.4, 0.62, 0.24);
maskMouthInner.position.set(0, -0.84, 1.22);
maskGroup.add(maskMouthInner);

const maskCollarLeft = new THREE.Mesh(
  new THREE.ConeGeometry(0.28, 0.85, 3),
  new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }),
);
maskCollarLeft.rotation.z = Math.PI * 0.74;
maskCollarLeft.rotation.x = Math.PI;
maskCollarLeft.position.set(-0.34, -2.08, 0.78);
maskGroup.add(maskCollarLeft);

const maskCollarRight = maskCollarLeft.clone();
maskCollarRight.rotation.z = -Math.PI * 0.74;
maskCollarRight.position.x = 0.34;
maskGroup.add(maskCollarRight);

const maskBowLeft = new THREE.Mesh(
  new THREE.ConeGeometry(0.34, 0.7, 3),
  new THREE.MeshStandardMaterial({ color: "#ff5531", roughness: 0.35, emissive: "#7a1508", emissiveIntensity: 0.28 }),
);
maskBowLeft.rotation.z = Math.PI * 0.6;
maskBowLeft.rotation.x = Math.PI;
maskBowLeft.position.set(-0.34, -1.82, 0.95);
maskGroup.add(maskBowLeft);

const maskBowRight = maskBowLeft.clone();
maskBowRight.rotation.z = -Math.PI * 0.6;
maskBowRight.position.x = 0.34;
maskGroup.add(maskBowRight);

const maskBowKnot = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.14, 0),
  new THREE.MeshStandardMaterial({ color: "#fff3ef", roughness: 0.45 }),
);
maskBowKnot.position.set(0, -1.83, 1.02);
maskGroup.add(maskBowKnot);

const cartoonGroup = new THREE.Group();
cartoonGroup.visible = false;
scene.add(cartoonGroup);

function addCutoutOutline(targetGroup, geometry, material, transform) {
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: "#121212", roughness: 1 }),
  );
  if (transform.position) outline.position.copy(transform.position);
  if (transform.rotation) outline.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  if (transform.scale) outline.scale.copy(transform.scale.clone().multiplyScalar(1.08));
  else outline.scale.setScalar(1.08);
  outline.position.z -= 0.08;
  targetGroup.add(outline);
  const mesh = new THREE.Mesh(geometry, material);
  if (transform.position) mesh.position.copy(transform.position);
  if (transform.rotation) mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  if (transform.scale) mesh.scale.copy(transform.scale);
  targetGroup.add(mesh);
  return mesh;
}

const cartoonTorso = addCutoutOutline(
  cartoonGroup,
  new THREE.CylinderGeometry(1.55, 1.85, 2.2, 32),
  new THREE.MeshStandardMaterial({ color: "#8d4d1f", roughness: 0.96 }),
  {
    position: new THREE.Vector3(0, -1.82, 0),
    scale: new THREE.Vector3(1, 1, 0.42),
  },
);

const cartoonCoatLeft = addCutoutOutline(
  cartoonGroup,
  new THREE.BoxGeometry(1.5, 1.8, 0.24),
  new THREE.MeshStandardMaterial({ color: "#5f2811", roughness: 0.92 }),
  {
    position: new THREE.Vector3(-0.78, -1.68, 0.14),
    rotation: new THREE.Euler(0, 0, -0.08),
  },
);

const cartoonCoatRight = addCutoutOutline(
  cartoonGroup,
  new THREE.BoxGeometry(1.5, 1.8, 0.24),
  new THREE.MeshStandardMaterial({ color: "#5f2811", roughness: 0.92 }),
  {
    position: new THREE.Vector3(0.78, -1.68, 0.14),
    rotation: new THREE.Euler(0, 0, 0.08),
  },
);

const cartoonHead = addCutoutOutline(
  cartoonGroup,
  new THREE.SphereGeometry(1.34, 40, 40),
  new THREE.MeshStandardMaterial({ color: "#f6c79d", roughness: 0.94 }),
  {
    position: new THREE.Vector3(0, 0.5, 0.3),
    scale: new THREE.Vector3(1.06, 1.02, 0.66),
  },
);

const cartoonHatTop = addCutoutOutline(
  cartoonGroup,
  new THREE.CylinderGeometry(1.18, 1.18, 0.46, 40),
  new THREE.MeshStandardMaterial({ color: "#3f9b59", roughness: 0.9 }),
  {
    position: new THREE.Vector3(0, 1.62, 0.35),
    scale: new THREE.Vector3(1, 1, 0.5),
  },
);

const cartoonHatBand = addCutoutOutline(
  cartoonGroup,
  new THREE.CylinderGeometry(1.28, 1.28, 0.18, 40),
  new THREE.MeshStandardMaterial({ color: "#f8d34f", roughness: 0.85 }),
  {
    position: new THREE.Vector3(0, 1.36, 0.38),
    scale: new THREE.Vector3(1, 1, 0.56),
  },
);

const cartoonPom = addCutoutOutline(
  cartoonGroup,
  new THREE.SphereGeometry(0.24, 18, 18),
  new THREE.MeshStandardMaterial({ color: "#d9463d", roughness: 0.86 }),
  {
    position: new THREE.Vector3(0, 1.96, 0.48),
  },
);

const cartoonEyeLeft = addCutoutOutline(
  cartoonGroup,
  new THREE.CircleGeometry(0.22, 28),
  new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
  {
    position: new THREE.Vector3(-0.42, 0.56, 1.06),
  },
);

const cartoonEyeRight = addCutoutOutline(
  cartoonGroup,
  new THREE.CircleGeometry(0.22, 28),
  new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
  {
    position: new THREE.Vector3(0.42, 0.56, 1.06),
  },
);

const cartoonPupilLeft = new THREE.Mesh(
  new THREE.CircleGeometry(0.06, 20),
  new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.5 }),
);
cartoonPupilLeft.position.set(-0.42, 0.56, 1.1);
cartoonGroup.add(cartoonPupilLeft);

const cartoonPupilRight = cartoonPupilLeft.clone();
cartoonPupilRight.position.x = 0.42;
cartoonGroup.add(cartoonPupilRight);

const cartoonMouth = addCutoutOutline(
  cartoonGroup,
  new THREE.TorusGeometry(0.22, 0.035, 12, 32, Math.PI),
  new THREE.MeshStandardMaterial({ color: "#47261d", roughness: 0.96 }),
  {
    position: new THREE.Vector3(0, -0.16, 1.02),
    rotation: new THREE.Euler(0, 0, Math.PI),
  },
);

const cartoonMouthInner = new THREE.Mesh(
  new THREE.CircleGeometry(0.18, 24),
  new THREE.MeshStandardMaterial({ color: "#6f2f24", roughness: 0.95 }),
);
cartoonMouthInner.scale.set(1, 0.3, 1);
cartoonMouthInner.position.set(0, -0.12, 0.98);
cartoonGroup.add(cartoonMouthInner);

const cartoonNeck = new THREE.Mesh(
  new THREE.CylinderGeometry(0.24, 0.22, 0.44, 20),
  new THREE.MeshStandardMaterial({ color: "#f2bf94", roughness: 0.92 }),
);
cartoonNeck.scale.z = 0.5;
cartoonNeck.position.set(0, -0.72, 0.2);
cartoonGroup.add(cartoonNeck);

const cartoonHandLeft = new THREE.Group();
cartoonGroup.add(cartoonHandLeft);
const cartoonHandRight = new THREE.Group();
cartoonGroup.add(cartoonHandRight);

function buildCartoonHand(targetGroup) {
  const palm = addCutoutOutline(
    targetGroup,
    new THREE.CircleGeometry(0.24, 24),
    new THREE.MeshStandardMaterial({ color: "#f4d65f", roughness: 0.9 }),
    { position: new THREE.Vector3(0, 0, 0.08), scale: new THREE.Vector3(1.1, 1.25, 1) },
  );
  const fingers = [];
  for (let index = 0; index < 4; index += 1) {
    const finger = addCutoutOutline(
      targetGroup,
      new THREE.CapsuleGeometry(0.065, 0.28, 4, 8),
      new THREE.MeshStandardMaterial({ color: "#f4d65f", roughness: 0.9 }),
      {
        position: new THREE.Vector3(-0.18 + index * 0.12, 0.26, 0.1),
        rotation: new THREE.Euler(0, 0, -0.06 + index * 0.04, "XYZ"),
        scale: new THREE.Vector3(1, 1.05 - index * 0.06, 0.55),
      },
    );
    fingers.push(finger);
  }
  const thumb = addCutoutOutline(
    targetGroup,
    new THREE.CapsuleGeometry(0.07, 0.22, 4, 8),
    new THREE.MeshStandardMaterial({ color: "#f4d65f", roughness: 0.9 }),
    {
      position: new THREE.Vector3(-0.22, -0.02, 0.08),
      rotation: new THREE.Euler(0, 0, 0.85),
      scale: new THREE.Vector3(1, 1, 0.55),
    },
  );
  return { palm, fingers, thumb };
}

const cartoonHandLeftParts = buildCartoonHand(cartoonHandLeft);
const cartoonHandRightParts = buildCartoonHand(cartoonHandRight);
cartoonHandLeft.scale.set(1.05, 1.05, 1);
cartoonHandRight.scale.set(1.05, 1.05, 1);

const objects = [];
const palette = ["#69d2e7", "#f38630", "#e0e4cc", "#c8ff00", "#ff4e50"];
for (let index = 0; index < 18; index += 1) {
  const geometry =
    index % 3 === 0
      ? new THREE.BoxGeometry(0.9, 0.9, 0.9)
      : index % 3 === 1
        ? new THREE.IcosahedronGeometry(0.55, 0)
        : new THREE.TorusKnotGeometry(0.32, 0.12, 96, 12);

  const material = new THREE.MeshStandardMaterial({
    color: palette[index % palette.length],
    metalness: 0.45,
    roughness: 0.28,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const angle = (index / 18) * Math.PI * 2;
  const radius = index % 2 === 0 ? 3.4 : 2.1;
  mesh.position.set(
    Math.cos(angle) * radius,
    -0.6 + ((index % 5) - 2) * 0.45,
    Math.sin(angle) * radius,
  );
  mesh.rotation.set(angle * 0.4, angle, 0);
  contentGroup.add(mesh);
  objects.push(mesh);
}

function setModelStatus(message) {
  modelStatus.textContent = message;
}

function resolveModelSource(source) {
  if (/^(https?:|blob:|data:)/i.test(source)) return source;
  return new URL(source, appBaseUrl).href;
}

function clearLoadedModel() {
  if (!state.loadedModelRoot) return;
  contentGroup.remove(state.loadedModelRoot);
  state.loadedModelRoot.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else if (node.material) node.material.dispose();
  });
  state.loadedModelRoot = null;
}

function setDemoObjectsVisible(visible) {
  objects.forEach((mesh) => {
    mesh.visible = visible;
  });
}

function resetToDemoScene() {
  clearLoadedModel();
  setDemoObjectsVisible(true);
  floor.scale.setScalar(1);
  setModelStatus("Scene demo attiva");
}

function updateSceneModeVisibility() {
  const isScene3d = state.prototype === "scene3d";
  const isMask3d = state.prototype === "mask3d";
  floor.visible = isScene3d;
  grid.visible = isScene3d;
  objects.forEach((mesh) => {
    mesh.visible = isScene3d && !state.loadedModelRoot;
  });
  if (state.loadedModelRoot) {
    state.loadedModelRoot.visible = isScene3d;
  }
  maskGroup.visible = isMask3d;
  if (isMask3d) {
    scene.background = new THREE.Color("#070b12");
    scene.fog = new THREE.Fog("#070b12", 10, 24);
  } else {
    scene.background = new THREE.Color("#08111f");
    scene.fog = new THREE.Fog("#08111f", 14, 30);
  }
}

function frameModel(root) {
  const boundingBox = new THREE.Box3().setFromObject(root);
  const size = boundingBox.getSize(new THREE.Vector3());
  const center = boundingBox.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 3.2 / maxDimension;

  root.position.sub(center);
  root.scale.setScalar(scale);

  const adjustedBox = new THREE.Box3().setFromObject(root);
  const adjustedCenter = adjustedBox.getCenter(new THREE.Vector3());
  const adjustedSize = adjustedBox.getSize(new THREE.Vector3());

  root.position.x -= adjustedCenter.x;
  root.position.z -= adjustedCenter.z;
  root.position.y += -1.1 - adjustedBox.min.y;
  floor.scale.setScalar(Math.max(1, adjustedSize.length() * 0.16));
}

async function loadModel(source, label) {
  try {
    setModelStatus("Caricamento modello...");
    const gltf = await gltfLoader.loadAsync(resolveModelSource(source));
    clearLoadedModel();
    setDemoObjectsVisible(false);
    state.loadedModelRoot = gltf.scene;
    state.loadedModelRoot.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    frameModel(state.loadedModelRoot);
    contentGroup.add(state.loadedModelRoot);
    setModelStatus(`Modello caricato: ${label}`);
  } catch (error) {
    console.error(error);
    setModelStatus("Errore caricamento modello");
  }
}

function updatePreviewModeUi() {
  const isVideo = state.previewMode === "video-landmarks";
  const isLandmarksOnly = state.previewMode === "landmarks-only";
  landmarkToggle.dataset.state = state.previewMode;
  landmarksVideoButton.classList.toggle("is-active", isVideo);
  landmarksOnlyButton.classList.toggle("is-active", isLandmarksOnly);
  webcam.style.opacity = isVideo ? "1" : "0";
}

function setPreviewMode(nextMode) {
  state.previewMode = nextMode;
  updatePreviewModeUi();
}

function updateLayerMixUi() {
  const value = Math.round(state.layerMix);
  layerMixRange.value = String(value);
  layerMixValue.textContent = `${value}%`;
}

function updateMatrixFaceUi() {
  const value = Math.round(state.matrixFaceMix);
  matrixFaceRange.value = String(value);
  matrixFaceValue.textContent = `${value}%`;
}

function updatePrototypeUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("prototype", prototypeQueryMap[state.prototype] || "scene3d");
  window.history.replaceState({}, "", url);
}

function getInitialPrototypeFromUrl() {
  const url = new URL(window.location.href);
  const prototype = url.searchParams.get("prototype");
  if (prototype === "shadow") return "shadow";
  if (prototype === "scene3d") return "scene3d";
  if (prototype === "mask3d") return "mask3d";
  if (prototype === "layer") return "layer";
  if (prototype === "matrix") return "matrix";
  return null;
}

function getPrototypeShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("prototype", prototypeQueryMap[state.prototype] || "scene3d");
  return url.toString();
}

function updateShareUi(label = "Condividi") {
  shareButton.querySelector(".share-cta-label").textContent = label;
}

async function shareCurrentPrototype() {
  const url = getPrototypeShareUrl();
  const title = `${prototypeCopy[state.prototype].title} · head-tracking`;

  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text: prototypeCopy[state.prototype].intro,
        url,
      });
      updateShareUi("Condiviso");
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      updateShareUi("Link copiato");
    } else {
      window.prompt("Copia questo link", url);
      updateShareUi("Link pronto");
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      updateShareUi("Errore");
    }
    return;
  }

  window.setTimeout(() => {
    updateShareUi("Condividi");
  }, 1800);
}

function setCameraButtonState(stateLabel, isActive = false) {
  cameraCtaState.textContent = stateLabel;
  startButton.classList.toggle("is-active", isActive);
  cameraCtaLabel.textContent = isActive ? "Disattiva fotocamera" : "Attiva fotocamera";
}

function updateAudioUi() {
  const isShadow = state.prototype === "shadow";
  const isPlaying = !spotAudio.paused;
  audioToggleButton.classList.toggle("is-hidden", !isShadow);
  audioToggleButton.classList.toggle("is-playing", isPlaying);
  audioCtaState.textContent = isPlaying ? "Pausa" : "Play";
}

function updateRecordingUi() {
  const isShadow = state.prototype === "shadow";
  const supported = typeof MediaRecorder !== "undefined" && typeof shadowCanvas.captureStream === "function";
  const canShow = isShadow && supported;
  const isAnyRecording = state.isRecordingShadow;
  const formatLabel = state.recordingMimeType.includes("mp4") ? "MP4" : "WEBM";
  const isTouchDevice =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const canShareFile =
    Boolean(state.lastRecordingBlob) &&
    isTouchDevice &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({
      files: [new File([state.lastRecordingBlob], getRecordingFilename(), { type: state.lastRecordingBlob.type || state.recordingMimeType || "video/webm" })],
  });
  recordButton.classList.toggle("is-hidden", !canShow);
  stopRecordButton.classList.toggle("is-hidden", !canShow || !isAnyRecording);
  downloadRecordButton.classList.toggle("is-hidden", !isShadow || !state.lastRecordingBlob);
  recordingPreviewCard.classList.toggle("is-hidden", !isShadow || !state.lastRecordingBlob || isAnyRecording);
  shareRecordButton.classList.toggle("is-hidden", !isShadow || !canShareFile || isAnyRecording);
  recordButton.classList.toggle("is-recording", state.isRecordingShadow || state.isRecordingCountdown);
  recordButton.disabled = !canShow || isAnyRecording || state.isRecordingCountdown;
  stopRecordButton.disabled = !isAnyRecording;
  downloadRecordButton.disabled = !state.lastRecordingBlob;
  shareRecordButton.disabled = !canShareFile || isAnyRecording;
  recordCtaState.textContent = state.isRecordingCountdown
    ? "Countdown 3, 2, 1"
    : state.isRecordingShadow
      ? `Registrazione ${formatLabel}`
      : `Video + spot · ${formatLabel}`;
  stopRecordCtaState.textContent = isAnyRecording ? "Scarica file" : "Pronto";
  downloadRecordCtaState.textContent = state.lastRecordingBlob ? "Ultima registrazione" : "Nessun file";
  shareRecordCtaState.textContent = state.lastRecordingBlob ? "File registrato" : "Non disponibile";
  document.querySelector(".preview-card")?.classList.toggle(
    "is-hidden",
    state.prototype === "layer" || state.isRecordingCountdown || state.isRecordingShadow,
  );
  document.querySelector(".preview-actions")?.classList.toggle(
    "is-recording-mode",
    state.isRecordingCountdown || state.isRecordingShadow,
  );
}

async function ensureSpotAudioRouting() {
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("AudioContext non supportato");
    audioContext = new AudioContextCtor();
  }
  if (!spotAudioSource) {
    spotAudio.crossOrigin = "anonymous";
    spotAudioSource = audioContext.createMediaElementSource(spotAudio);
    spotAudioSource.connect(audioContext.destination);
  }
  if (!recordingDestination) {
    recordingDestination = audioContext.createMediaStreamDestination();
    spotAudioSource.connect(recordingDestination);
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}


async function toggleSpotAudio() {
  try {
    await ensureSpotAudioRouting();
    if (spotAudio.paused) {
      await spotAudio.play();
    } else {
      spotAudio.pause();
    }
  } catch (error) {
    console.error(error);
  }
  updateAudioUi();
}

function getRecorderMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function getRecordingFilename() {
  const extension = state.recordingMimeType.includes("mp4") ? "mp4" : "webm";
  return `tabu-simulator-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothStep01(value) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

const SHADOW_RECORDING_INTRO_DURATION_MS = 6800;
const SHADOW_RECORDING_COUNTDOWN_MS = 3000;

function downloadRecording(blob) {
  if (recordingDownloadUrl) {
    URL.revokeObjectURL(recordingDownloadUrl);
  }
  recordingDownloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = recordingDownloadUrl;
  anchor.download = getRecordingFilename();
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function getRecordingFile() {
  if (!state.lastRecordingBlob) return null;
  return new File([state.lastRecordingBlob], getRecordingFilename(), {
    type: state.lastRecordingBlob.type || state.recordingMimeType || "video/webm",
  });
}

function updateRecordingPreview() {
  if (recordingPreviewUrl) {
    URL.revokeObjectURL(recordingPreviewUrl);
    recordingPreviewUrl = null;
  }
  if (!state.lastRecordingBlob) {
    recordingPreviewVideo.removeAttribute("src");
    recordingPreviewVideo.load();
    return;
  }
  recordingPreviewUrl = URL.createObjectURL(state.lastRecordingBlob);
  recordingPreviewVideo.src = recordingPreviewUrl;
  recordingPreviewVideo.load();
}

function handleDownloadLastRecording() {
  if (!state.lastRecordingBlob) return;
  downloadRecording(state.lastRecordingBlob);
}

async function handleShareLastRecording() {
  const file = getRecordingFile();
  if (!file || !navigator.share || !navigator.canShare?.({ files: [file] })) return;
  try {
    await navigator.share({
      title: "Tabù simulator",
      text: "Registrazione Tabù",
      files: [file],
    });
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
    }
  }
}

async function beginShadowRecording() {
  state.isRecordingCountdown = false;
  state.recordingCountdownStartedAt = 0;
  if (!isWebcamActive()) {
    trackingStatus.textContent = "Attiva la webcam prima di registrare";
    updateRecordingUi();
    return;
  }
  if (typeof MediaRecorder === "undefined" || typeof shadowCanvas.captureStream !== "function") {
    trackingStatus.textContent = "Registrazione non supportata in questo browser";
    updateRecordingUi();
    return;
  }

  try {
    await ensureSpotAudioRouting();
    resizeShadowCanvas();

    const canvasStream = shadowCanvas.captureStream(30);
    const mixedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach((track) => mixedStream.addTrack(track));
    recordingDestination.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track));

    state.recordingChunks = [];
    const mimeType = getRecorderMimeType();
    state.recordingMimeType = mimeType || "video/webm";
    state.mediaRecorder = mimeType
      ? new MediaRecorder(mixedStream, { mimeType })
      : new MediaRecorder(mixedStream);

    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        state.recordingChunks.push(event.data);
      }
    });

    state.mediaRecorder.addEventListener("stop", () => {
      const blob = new Blob(state.recordingChunks, {
        type: state.mediaRecorder?.mimeType || "video/webm",
      });
      if (blob.size > 0) {
        state.lastRecordingBlob = blob;
        updateRecordingPreview();
        trackingStatus.textContent = "File pronto per il download";
      } else {
        trackingStatus.textContent = "Registrazione vuota";
      }
      state.recordingChunks = [];
      state.mediaRecorder = null;
      state.isRecordingShadow = false;
      state.recordingIntroStartedAt = 0;
      state.recordingMimeType = getRecorderMimeType() || "video/webm";
      state.isRecordingCountdown = false;
      state.recordingCountdownStartedAt = 0;
      updateRecordingUi();
    });

    spotAudio.pause();
    spotAudio.currentTime = 0;
    await spotAudio.play();
    state.mediaRecorder.start(250);
    state.isRecordingShadow = true;
    state.isRecordingCountdown = false;
    state.recordingCountdownStartedAt = 0;
    state.recordingIntroStartedAt = performance.now();
    trackingStatus.textContent = "Registrazione Tabù in corso";
  } catch (error) {
    console.error(error);
    trackingStatus.textContent = "Errore registrazione Tabù";
    state.isRecordingShadow = false;
    state.isRecordingCountdown = false;
    state.recordingCountdownStartedAt = 0;
    state.recordingIntroStartedAt = 0;
    state.recordingMimeType = getRecorderMimeType() || "video/webm";
  }

  updateAudioUi();
  updateRecordingUi();
}

function drawRecordingCountdownOverlay(elapsedMs) {
  const remaining = Math.max(0, SHADOW_RECORDING_COUNTDOWN_MS - elapsedMs);
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const pulse = 1 + (1 - ((remaining % 1000) / 1000)) * 0.12;

  shadowContext.save();
  shadowContext.fillStyle = "rgba(0, 0, 0, 0.34)";
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);

  const cx = shadowCanvas.width * 0.5;
  const cy = shadowCanvas.height * 0.46;
  const radius = Math.min(shadowCanvas.width, shadowCanvas.height) * 0.11 * pulse;

  shadowContext.beginPath();
  shadowContext.arc(cx, cy, radius, 0, Math.PI * 2);
  shadowContext.fillStyle = "rgba(255, 255, 255, 0.12)";
  shadowContext.fill();
  shadowContext.lineWidth = 4;
  shadowContext.strokeStyle = "rgba(255, 255, 255, 0.24)";
  shadowContext.stroke();

  shadowContext.textAlign = "center";
  shadowContext.textBaseline = "middle";
  shadowContext.fillStyle = "#ffffff";
  shadowContext.font = `900 ${Math.max(48, radius * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
  shadowContext.fillText(String(seconds), cx, cy + 2);

  shadowContext.font = `700 ${Math.max(14, radius * 0.2)}px ui-monospace, monospace`;
  shadowContext.fillStyle = "rgba(255, 255, 255, 0.86)";
  shadowContext.fillText("REC IN PARTENZA", cx, cy + radius + 28);
  shadowContext.restore();
}

async function startShadowRecording() {
  if (state.prototype !== "shadow" || state.isRecordingShadow || state.isRecordingCountdown) return;
  if (!isWebcamActive()) {
    trackingStatus.textContent = "Attiva la webcam prima di registrare";
    updateRecordingUi();
    return;
  }
  state.isRecordingCountdown = true;
  state.recordingCountdownStartedAt = performance.now();
  trackingStatus.textContent = "Registrazione tra 3 secondi";
  updateRecordingUi();
}

function stopShadowRecording() {
  state.isRecordingCountdown = false;
  state.recordingCountdownStartedAt = 0;
  if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") return;
  trackingStatus.textContent = "Chiusura registrazione...";
  state.mediaRecorder.stop();
  state.recordingIntroStartedAt = 0;
  if (!spotAudio.paused) {
    spotAudio.pause();
    spotAudio.currentTime = 0;
  }
  updateAudioUi();
}

function isWebcamActive() {
  return Boolean(state.videoStream && state.videoStream.getTracks().some((track) => track.readyState === "live"));
}

function clearShadowCanvas() {
  shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
}

function resetTrackingTargets() {
  targetHead.yaw = 0;
  targetHead.pitch = 0;
  targetHead.roll = 0;
  targetHead.x = 0;
  targetHead.y = 0;
  targetHead.z = 0.5;
}

function stopWebcam() {
  if (state.isRecordingShadow) {
    stopShadowRecording();
  }
  state.isRecordingCountdown = false;
  state.recordingCountdownStartedAt = 0;
  state.videoStream?.getTracks().forEach((track) => track.stop());
  state.videoStream = null;
  webcam.srcObject = null;
  state.lastVideoTime = -1;
  state.latestHolisticResults = null;
  state.latestFaceLandmarks = null;
  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  clearShadowCanvas();
  resetTrackingTargets();
  trackingStatus.textContent = "Webcam disattivata";
  startButton.disabled = false;
  setCameraButtonState("Pronta al tracking", false);
  updateAudioUi();
  updateRecordingUi();
}

function onPointerDown(event) {
  if (state.prototype !== "scene3d" || event.button !== 0) return;
  state.isDraggingView = true;
  state.activePointerId = event.pointerId;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = "grabbing";
}

function onPointerMove(event) {
  if (state.prototype !== "scene3d" || !state.isDraggingView || event.pointerId !== state.activePointerId) return;
  const deltaX = event.clientX - state.lastPointerX;
  const deltaY = event.clientY - state.lastPointerY;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  manualView.yaw += deltaX * 0.0055;
  manualView.pitch = THREE.MathUtils.clamp(manualView.pitch + deltaY * 0.0045, -0.75, 0.75);
}

function stopPointerDrag(event) {
  if (state.activePointerId !== event.pointerId) return;
  state.isDraggingView = false;
  state.activePointerId = null;
  renderer.domElement.style.cursor = "grab";
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}

function averagePoints(points) {
  const total = points.reduce(
    (accumulator, point) => {
      accumulator.x += point.x;
      accumulator.y += point.y;
      accumulator.z += point.z ?? 0;
      return accumulator;
    },
    { x: 0, y: 0, z: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length, z: total.z / points.length };
}

function updateHeadTarget(landmarks) {
  if (!landmarks?.length) {
    targetHead.yaw *= 0.92;
    targetHead.pitch *= 0.92;
    targetHead.roll *= 0.92;
    targetHead.x *= 0.92;
    targetHead.y *= 0.92;
    return;
  }

  const leftEye = averagePoints([landmarks[33], landmarks[133], landmarks[159], landmarks[145]]);
  const rightEye = averagePoints([landmarks[362], landmarks[263], landmarks[386], landmarks[374]]);
  const noseTip = landmarks[1];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const mouthCenter = averagePoints([upperLip, lowerLip]);
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const faceCenter = averagePoints([leftEye, rightEye, noseTip, mouthCenter]);

  const eyeMidX = (leftEye.x + rightEye.x) * 0.5;
  const eyeMidY = (leftEye.y + rightEye.y) * 0.5;
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const eyeDistance = Math.max(Math.hypot(eyeDx, eyeDy), 0.0001);
  const faceHeight = Math.max(chin.y - forehead.y, 0.0001);

  targetHead.yaw = THREE.MathUtils.clamp((noseTip.x - eyeMidX) / (eyeDistance * 0.9), -1, 1);
  const pitchReferenceY = (eyeMidY + mouthCenter.y) * 0.5;
  targetHead.pitch = THREE.MathUtils.clamp((noseTip.y - pitchReferenceY) / (faceHeight * 0.55), -1, 1);
  targetHead.roll = THREE.MathUtils.clamp(Math.atan2(eyeDy, eyeDx), -0.7, 0.7);
  targetHead.x = THREE.MathUtils.clamp((faceCenter.x - 0.5) * 2, -1, 1);
  targetHead.y = THREE.MathUtils.clamp((faceCenter.y - 0.5) * 2, -1, 1);
  targetHead.z = THREE.MathUtils.clamp(faceHeight, 0.12, 0.52);
}

function smoothTracking() {
  smoothedHead.yaw = THREE.MathUtils.lerp(smoothedHead.yaw, targetHead.yaw, 0.13);
  smoothedHead.pitch = THREE.MathUtils.lerp(smoothedHead.pitch, targetHead.pitch, 0.13);
  smoothedHead.roll = THREE.MathUtils.lerp(smoothedHead.roll, targetHead.roll, 0.12);
  smoothedHead.x = THREE.MathUtils.lerp(smoothedHead.x, targetHead.x, 0.12);
  smoothedHead.y = THREE.MathUtils.lerp(smoothedHead.y, targetHead.y, 0.12);
  smoothedHead.z = THREE.MathUtils.lerp(smoothedHead.z, targetHead.z, 0.09);
}

function updateCamera(time) {
  const yaw = smoothedHead.yaw * 1.6 + smoothedHead.x * 0.42 + manualView.yaw;
  const pitch = THREE.MathUtils.clamp(
    smoothedHead.pitch * 1.2 + smoothedHead.y * 0.28 + manualView.pitch,
    -0.9,
    0.9,
  );
  const radius = THREE.MathUtils.mapLinear(smoothedHead.z, 0.12, 0.52, 11.8, 3.8);

  camera.position.x = Math.sin(yaw) * radius;
  camera.position.z = Math.cos(yaw) * radius;
  camera.position.y = 0.9 - pitch * 4.6;
  camera.lookAt(smoothedHead.x * 0.9, -smoothedHead.y * 0.6, 0);
  camera.rotation.z = smoothedHead.roll * 0.35;
  stageGroup.rotation.y = Math.sin(time * 0.00022) * 0.22;
}

function updateMaskScene() {
  const yaw = smoothedHead.yaw * 0.9;
  const pitch = smoothedHead.pitch * 0.8;
  const roll = smoothedHead.roll * 0.65;
  const distance = THREE.MathUtils.mapLinear(smoothedHead.z, 0.12, 0.52, 0.95, 1.48);

  camera.position.set(0, 0.05, 6.6);
  camera.lookAt(0, 0, 0);
  camera.rotation.z = 0;

  maskGroup.position.set(smoothedHead.x * 1.1, -smoothedHead.y * 0.9, 0);
  maskGroup.rotation.set(pitch, yaw, -roll);
  maskGroup.scale.setScalar(distance);

  const landmarks = state.latestFaceLandmarks;
  if (!landmarks?.length) return;

  const mouthOpen = Math.abs((landmarks[14]?.y ?? 0.5) - (landmarks[13]?.y ?? 0.5));
  const leftEyeOpen = Math.abs((landmarks[145]?.y ?? 0.4) - (landmarks[159]?.y ?? 0.4));
  const rightEyeOpen = Math.abs((landmarks[374]?.y ?? 0.4) - (landmarks[386]?.y ?? 0.4));
  const mouthStretch = THREE.MathUtils.clamp(1 + mouthOpen * 8.5, 1, 1.65);
  const mouthHeight = THREE.MathUtils.clamp(0.55 + mouthOpen * 14, 0.55, 1.28);
  const eyeLeftHeight = THREE.MathUtils.clamp(0.28 + leftEyeOpen * 10, 0.18, 0.72);
  const eyeRightHeight = THREE.MathUtils.clamp(0.28 + rightEyeOpen * 10, 0.18, 0.72);
  const pupilOffsetX = THREE.MathUtils.clamp((smoothedHead.yaw + smoothedHead.x * 0.35) * 0.08, -0.08, 0.08);
  const pupilOffsetY = THREE.MathUtils.clamp((-smoothedHead.pitch - smoothedHead.y * 0.2) * 0.06, -0.05, 0.05);

  maskMouthOuter.scale.set(mouthStretch, mouthHeight, 1);
  maskMouthInner.scale.set(mouthStretch * 1.2, THREE.MathUtils.clamp(0.4 + mouthOpen * 18, 0.4, 1.55), 0.24);
  maskEyeWhiteLeft.scale.y = eyeLeftHeight;
  maskEyeWhiteRight.scale.y = eyeRightHeight;
  maskPupilLeft.position.set(-0.58 + pupilOffsetX, 0.35 + pupilOffsetY, 1.52);
  maskPupilRight.position.set(0.58 + pupilOffsetX, 0.35 + pupilOffsetY, 1.52);
  maskBowLeft.rotation.y = Math.sin(performance.now() * 0.004) * 0.08;
  maskBowRight.rotation.y = -Math.sin(performance.now() * 0.004) * 0.08;
}

function drawHandOverlay(context, width, height, handLandmarks, alpha = 1) {
  if (!handLandmarks?.length) return;
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "rgba(255, 248, 210, 0.72)";
  context.lineWidth = 2;
  context.fillStyle = "rgba(255, 248, 210, 0.95)";

  for (const chain of HAND_FINGER_CHAINS) {
    context.beginPath();
    chain.forEach((index, chainIndex) => {
      const point = handLandmarks[index];
      const x = point.x * width;
      const y = point.y * height;
      if (chainIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  for (const landmark of handLandmarks) {
    const x = landmark.x * width;
    const y = landmark.y * height;
    context.beginPath();
    context.arc(x, y, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPoseOverlay(context, width, height, poseLandmarks, alpha = 1) {
  if (!poseLandmarks?.length) return;
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "rgba(255, 104, 104, 0.48)";
  context.lineWidth = 2;
  context.fillStyle = "rgba(255, 104, 104, 0.8)";

  for (const chain of POSE_PREVIEW_CHAINS) {
    context.beginPath();
    chain.forEach((index, chainIndex) => {
      const point = poseLandmarks[index];
      const x = point.x * width;
      const y = point.y * height;
      if (chainIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  for (const index of new Set(POSE_PREVIEW_CHAINS.flat())) {
    const landmark = poseLandmarks[index];
    const x = landmark.x * width;
    const y = landmark.y * height;
    context.beginPath();
    context.arc(x, y, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawLandmarksToContext(context, width, height, landmarks, extras = {}, alpha = 1) {
  const hasFace = Boolean(landmarks?.length);
  const hasHands = Boolean(extras.leftHandLandmarks?.length || extras.rightHandLandmarks?.length);
  const hasPose = Boolean(extras.poseLandmarks?.length);
  if (!hasFace && !hasHands && !hasPose) return;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "rgba(105, 210, 231, 0.95)";
  if (hasFace) {
    for (const landmark of landmarks) {
      const x = landmark.x * width;
      const y = landmark.y * height;
      context.beginPath();
      context.arc(x, y, 1.6, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();

  drawHandOverlay(context, width, height, extras.leftHandLandmarks, alpha);
  drawHandOverlay(context, width, height, extras.rightHandLandmarks, alpha);
  drawPoseOverlay(context, width, height, extras.poseLandmarks, alpha);
}

function drawOverlay(landmarks, extras = {}) {
  webcamOverlay.width = webcam.videoWidth;
  webcamOverlay.height = webcam.videoHeight;
  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  drawLandmarksToContext(overlayContext, webcamOverlay.width, webcamOverlay.height, landmarks, extras, 1);
}

async function setupFaceLandmarker() {
  if (state.faceLandmarker) return state.faceLandmarker;
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );
  state.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    numFaces: 1,
    minFaceDetectionConfidence: 0.6,
    minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    runningMode: "VIDEO",
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  return state.faceLandmarker;
}

async function setupHolistic() {
  if (state.holistic) return state.holistic;
  const Holistic = window.Holistic;
  if (!Holistic) throw new Error("MediaPipe Holistic non disponibile");
  const holistic = new Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  });
  holistic.setOptions({
    modelComplexity: 1,
    refineFaceLandmarks: true,
    selfieMode: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  holistic.onResults((results) => {
    state.latestHolisticResults = results;
    state.latestFaceLandmarks = results.faceLandmarks || null;
    drawOverlay(results.faceLandmarks, {
      leftHandLandmarks: results.leftHandLandmarks,
      rightHandLandmarks: results.rightHandLandmarks,
      poseLandmarks: results.poseLandmarks,
    });
    if (results.faceLandmarks?.length) {
      trackingStatus.textContent = results.leftHandLandmarks || results.rightHandLandmarks
        ? "Volto e mani rilevati"
        : "Volto rilevato";
    } else {
      trackingStatus.textContent = "Cerca un volto";
    }
  });
  state.holistic = holistic;
  return holistic;
}

async function ensureTrackerForActivePrototype() {
  if (state.prototype === "scene3d" || state.prototype === "mask3d") {
    trackingStatus.textContent = "Caricamento face tracking...";
    await setupFaceLandmarker();
  } else if (state.prototype === "matrix") {
    trackingStatus.textContent = "Caricamento Matrix...";
    await setupHolistic();
  } else {
    trackingStatus.textContent = state.prototype === "layer" ? "Caricamento layer tracking..." : "Caricamento shadow puppet...";
    await setupHolistic();
  }
}

async function startWebcam() {
  if (isWebcamActive()) {
    stopWebcam();
    return;
  }

  startButton.disabled = true;
  trackingStatus.textContent = "Richiesta permesso webcam...";
  setCameraButtonState("Richiesta permesso", false);

  try {
    await ensureTrackerForActivePrototype();
    state.videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    webcam.srcObject = state.videoStream;
    await webcam.play();
    trackingStatus.textContent =
      state.prototype === "shadow"
        ? "Shadow puppet attivo"
        : state.prototype === "matrix"
          ? "Matrix attivo"
        : state.prototype === "layer"
          ? "Layer tracking attivo"
        : state.prototype === "mask3d"
          ? "Palloncino attivo"
          : "Tracking attivo";
    startButton.disabled = false;
    setCameraButtonState("Camera attiva", true);
    updateRecordingUi();
  } catch (error) {
    console.error(error);
    trackingStatus.textContent = "Errore webcam o modello";
    startButton.disabled = false;
    setCameraButtonState("Errore, riprova", false);
    updateRecordingUi();
  }
}

function normalizedToCanvas(point) {
  return {
    x: shadowCanvas.width - point.x * shadowCanvas.width,
    y: point.y * shadowCanvas.height,
    z: point.z ?? 0,
  };
}

function drawPath(points, { fillStyle, strokeStyle, lineWidth = 1.5, close = true }) {
  if (!points.length) return;
  shadowContext.beginPath();
  shadowContext.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) shadowContext.lineTo(points[index].x, points[index].y);
  if (close) shadowContext.closePath();
  if (fillStyle) {
    shadowContext.fillStyle = fillStyle;
    shadowContext.fill();
  }
  if (strokeStyle) {
    shadowContext.strokeStyle = strokeStyle;
    shadowContext.lineWidth = lineWidth;
    shadowContext.stroke();
  }
}

function pickPoints(source, indexes) {
  return indexes.map((index) => normalizedToCanvas(source[index]));
}

function posePoint(poseLandmarks, index) {
  return normalizedToCanvas(poseLandmarks[index]);
}

function resizeShadowCanvas() {
  const width = shadowStage.clientWidth || window.innerWidth;
  const height = shadowStage.clientHeight || Math.max(420, window.innerHeight * 0.6);
  if (shadowCanvas.width !== width || shadowCanvas.height !== height) {
    shadowCanvas.width = width;
    shadowCanvas.height = height;
  }
}

function drawHandShape(handLandmarks) {
  const points = handLandmarks.map(normalizedToCanvas);
  const fingerTips = [4, 8, 12, 16, 20].map((index) => points[index]);
  const fingerBases = [2, 5, 9, 13, 17].map((index) => points[index]);
  const palmCenter = getPalmCenter(points);
  const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y);
  const palmHeight = Math.hypot(points[0].x - points[9].x, points[0].y - points[9].y);
  const palmRadiusX = Math.max(20, palmWidth * 0.38);
  const palmRadiusY = Math.max(26, palmHeight * 0.48);
  const gloveColor = "rgba(255, 252, 238, 0.99)";

  shadowContext.save();
  shadowContext.fillStyle = gloveColor;
  shadowContext.strokeStyle = gloveColor;
  shadowContext.lineCap = "round";
  shadowContext.lineJoin = "round";
  shadowContext.shadowBlur = 20;
  shadowContext.shadowColor = "rgba(255, 255, 220, 0.18)";

  shadowContext.beginPath();
  shadowContext.ellipse(
    palmCenter.x,
    palmCenter.y + palmRadiusY * 0.08,
    palmRadiusX,
    palmRadiusY,
    0,
    0,
    Math.PI * 2,
  );
  shadowContext.fill();

  shadowContext.beginPath();
  shadowContext.ellipse(
    (points[0].x + palmCenter.x) * 0.5,
    (points[0].y + palmCenter.y) * 0.5 + palmRadiusY * 0.14,
    palmRadiusX * 0.82,
    palmRadiusY * 0.82,
    0,
    0,
    Math.PI * 2,
  );
  shadowContext.fill();

  const fingerWidths = [18, 22, 21, 19, 17];
  fingerBases.forEach((base, index) => {
    const tip = fingerTips[index];
    const length = Math.hypot(tip.x - base.x, tip.y - base.y);
    const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
    const width = Math.max(12, Math.min(fingerWidths[index], length * 0.42));

    shadowContext.save();
    shadowContext.translate(base.x, base.y);
    shadowContext.rotate(angle);
    shadowContext.beginPath();
    shadowContext.roundRect(-width * 0.5, -width * 0.5, length + width * 0.25, width, width * 0.5);
    shadowContext.fill();
    shadowContext.restore();

    shadowContext.beginPath();
    shadowContext.arc(base.x, base.y, width * 0.52, 0, Math.PI * 2);
    shadowContext.fill();
    shadowContext.beginPath();
    shadowContext.arc(tip.x, tip.y, width * 0.5, 0, Math.PI * 2);
    shadowContext.fill();
  });

  const thumbBase = points[2];
  const thumbTip = points[4];
  const thumbLength = Math.hypot(thumbTip.x - thumbBase.x, thumbTip.y - thumbBase.y);
  const thumbAngle = Math.atan2(thumbTip.y - thumbBase.y, thumbTip.x - thumbBase.x);
  shadowContext.save();
  shadowContext.translate(thumbBase.x, thumbBase.y);
  shadowContext.rotate(thumbAngle);
  shadowContext.beginPath();
  shadowContext.roundRect(-10, -11, thumbLength + 12, 22, 11);
  shadowContext.fill();
  shadowContext.restore();

  shadowContext.beginPath();
  shadowContext.arc(points[0].x, points[0].y, Math.max(14, palmWidth * 0.16), 0, Math.PI * 2);
  shadowContext.fill();
  shadowContext.restore();

  return points;
}

function drawBodySilhouette(results) {
  const pose = results.poseLandmarks;
  if (!pose) return;
  const leftShoulder = posePoint(pose, SHOULDER_LEFT_INDEX);
  const rightShoulder = posePoint(pose, SHOULDER_RIGHT_INDEX);
  const leftHip = posePoint(pose, HIP_LEFT_INDEX);
  const rightHip = posePoint(pose, HIP_RIGHT_INDEX);
  const torsoBottomY = Math.min(shadowCanvas.height - 12, Math.max(leftHip.y, rightHip.y) + shadowCanvas.height * 0.42);
  const torsoCenterX = (leftShoulder.x + rightShoulder.x) * 0.5;
  const shirtHeight = Math.max(120, torsoBottomY - Math.max(leftShoulder.y, rightShoulder.y) - 16);

  drawPath(
    [
      { x: torsoCenterX - 8, y: Math.max(leftShoulder.y, rightShoulder.y) + 28 },
      { x: torsoCenterX + 8, y: Math.max(leftShoulder.y, rightShoulder.y) + 28 },
      { x: torsoCenterX + 34, y: Math.max(leftShoulder.y, rightShoulder.y) + shirtHeight * 0.46 },
      { x: torsoCenterX, y: Math.max(leftShoulder.y, rightShoulder.y) + shirtHeight },
      { x: torsoCenterX - 34, y: Math.max(leftShoulder.y, rightShoulder.y) + shirtHeight * 0.46 },
    ],
    { fillStyle: "#fff8e8", strokeStyle: "#fff8e8", lineWidth: 2 },
  );
}

function drawFaceDetails(face) {
  const mouthOuter = pickPoints(face, MOUTH_OUTER_INDEXES);
  const mouthInner = pickPoints(face, MOUTH_INNER_INDEXES);
  drawPath(mouthOuter, { fillStyle: "#fffdf6", strokeStyle: "#fffdf6", lineWidth: 12 });
  drawPath(mouthInner, { fillStyle: "#2d2219", strokeStyle: "#2d2219", lineWidth: 3 });

  const leftEyeOuter = normalizedToCanvas(face[33]);
  const leftEyeInner = normalizedToCanvas(face[133]);
  const leftEyeTop = normalizedToCanvas(face[159]);
  const rightEyeOuter = normalizedToCanvas(face[263]);
  const rightEyeInner = normalizedToCanvas(face[362]);
  const rightEyeTop = normalizedToCanvas(face[386]);

  function drawCartoonEye(outer, inner, top) {
    const centerX = (outer.x + inner.x) * 0.5;
    const width = Math.max(12, Math.abs(inner.x - outer.x));
    const height = Math.max(5, Math.abs(top.y - ((outer.y + inner.y) * 0.5)) * 1.8);
    shadowContext.fillStyle = "#fffdf6";
    shadowContext.beginPath();
    shadowContext.moveTo(centerX - width * 0.45, top.y + height * 0.2);
    shadowContext.quadraticCurveTo(centerX, top.y - height * 0.9, centerX + width * 0.45, top.y + height * 0.2);
    shadowContext.quadraticCurveTo(centerX + width * 0.18, top.y + height * 0.7, centerX - width * 0.12, top.y + height * 0.46);
    shadowContext.closePath();
    shadowContext.fill();
    shadowContext.fillStyle = "#111";
    shadowContext.beginPath();
    shadowContext.arc(centerX + width * 0.08, top.y + height * 0.04, Math.max(1.8, width * 0.08), 0, Math.PI * 2);
    shadowContext.fill();
  }

  drawCartoonEye(leftEyeOuter, leftEyeInner, leftEyeTop);
  drawCartoonEye(rightEyeOuter, rightEyeInner, rightEyeTop);

  const chin = normalizedToCanvas(face[152]);
  const leftJaw = normalizedToCanvas(face[172]);
  const rightJaw = normalizedToCanvas(face[397]);
  const knot = { x: chin.x, y: chin.y + 46 };

  drawPath(
    [
      { x: leftJaw.x + 12, y: chin.y + 20 },
      { x: knot.x - 12, y: knot.y - 4 },
      { x: knot.x, y: knot.y + 8 },
    ],
    { fillStyle: "#fffdf6", strokeStyle: "#fffdf6", lineWidth: 2 },
  );
  drawPath(
    [
      { x: rightJaw.x - 12, y: chin.y + 20 },
      { x: knot.x + 12, y: knot.y - 4 },
      { x: knot.x, y: knot.y + 8 },
    ],
    { fillStyle: "#fffdf6", strokeStyle: "#fffdf6", lineWidth: 2 },
  );

  shadowContext.shadowBlur = 26;
  shadowContext.shadowColor = "rgba(255, 68, 32, 0.9)";
  drawPath(
    [
      { x: knot.x - 58, y: knot.y - 10 },
      { x: knot.x - 12, y: knot.y - 2 },
      { x: knot.x - 54, y: knot.y + 24 },
    ],
    { fillStyle: "#f34122", strokeStyle: "#f34122", lineWidth: 2 },
  );
  drawPath(
    [
      { x: knot.x + 58, y: knot.y - 10 },
      { x: knot.x + 12, y: knot.y - 2 },
      { x: knot.x + 54, y: knot.y + 24 },
    ],
    { fillStyle: "#f34122", strokeStyle: "#f34122", lineWidth: 2 },
  );
  shadowContext.shadowBlur = 0;
}

function isOpenPalm(handPoints) {
  const wrist = handPoints[0];
  const fingertips = [8, 12, 16, 20].map((index) => handPoints[index]);
  const averageTipDistance =
    fingertips.reduce((total, point) => total + Math.hypot(point.x - wrist.x, point.y - wrist.y), 0) /
    fingertips.length;
  const palmWidth = Math.hypot(handPoints[5].x - handPoints[17].x, handPoints[5].y - handPoints[17].y);
  return averageTipDistance > palmWidth * 1.22;
}

function getPalmCenter(handPoints) {
  return {
    x: (handPoints[0].x + handPoints[5].x + handPoints[9].x + handPoints[13].x + handPoints[17].x) / 5,
    y: (handPoints[0].y + handPoints[5].y + handPoints[9].y + handPoints[13].y + handPoints[17].y) / 5,
  };
}

function isPalmStable(previousCenter, nextCenter) {
  if (!previousCenter || !nextCenter) return false;
  return Math.hypot(previousCenter.x - nextCenter.x, previousCenter.y - nextCenter.y) < 22;
}

function drawPalmLogo(handPoints) {
  const palmCenter = getPalmCenter(handPoints);
  const palmRadius =
    Math.max(
      Math.hypot(handPoints[5].x - handPoints[17].x, handPoints[5].y - handPoints[17].y),
      Math.hypot(handPoints[0].x - handPoints[9].x, handPoints[0].y - handPoints[9].y),
    ) * 0.38;
  const rx = palmRadius * 0.92;
  const ry = palmRadius * 1.14;

  shadowContext.save();
  shadowContext.shadowBlur = 18;
  shadowContext.shadowColor = "rgba(120, 255, 120, 0.24)";
  shadowContext.fillStyle = "#e9e9e9";
  shadowContext.beginPath();
  shadowContext.ellipse(palmCenter.x, palmCenter.y, rx, ry, 0, 0, Math.PI * 2);
  shadowContext.fill();

  shadowContext.fillStyle = "#4aa04d";
  shadowContext.beginPath();
  shadowContext.ellipse(palmCenter.x, palmCenter.y, rx * 0.9, ry * 0.88, 0, Math.PI, Math.PI * 2);
  shadowContext.fill();
  shadowContext.beginPath();
  shadowContext.ellipse(palmCenter.x, palmCenter.y, rx * 0.9, ry * 0.88, 0, 0, Math.PI);
  shadowContext.fill();

  shadowContext.fillStyle = "#fbf9ef";
  shadowContext.beginPath();
  shadowContext.rect(palmCenter.x - rx * 0.88, palmCenter.y - ry * 0.36, rx * 1.76, ry * 0.74);
  shadowContext.fill();

  shadowContext.strokeStyle = "#202020";
  shadowContext.lineWidth = 1.4;
  shadowContext.beginPath();
  shadowContext.moveTo(palmCenter.x - rx * 0.82, palmCenter.y - ry * 0.35);
  shadowContext.lineTo(palmCenter.x + rx * 0.82, palmCenter.y - ry * 0.35);
  shadowContext.moveTo(palmCenter.x - rx * 0.82, palmCenter.y + ry * 0.34);
  shadowContext.lineTo(palmCenter.x + rx * 0.82, palmCenter.y + ry * 0.34);
  shadowContext.stroke();

  const textY = palmCenter.y - ry * 0.07;
  const depth = Math.max(2, palmRadius * 0.08);
  shadowContext.textAlign = "center";
  shadowContext.textBaseline = "middle";
  shadowContext.fillStyle = "#8d8d8d";
  shadowContext.font = `900 ${Math.max(10, palmRadius * 0.46)}px ui-sans-serif, system-ui, sans-serif`;
  shadowContext.fillText("TABU", palmCenter.x + depth, textY - depth * 0.4);
  shadowContext.fillStyle = "#1d1d1f";
  shadowContext.fillText("TABU", palmCenter.x, textY);

  const candyY = palmCenter.y + ry * 0.12;
  for (const offset of [-0.34, -0.14, 0.08, 0.28]) {
    shadowContext.beginPath();
    shadowContext.ellipse(
      palmCenter.x + rx * offset,
      candyY + Math.abs(offset) * 8,
      rx * 0.12,
      ry * 0.08,
      offset,
      0,
      Math.PI * 2,
    );
    shadowContext.fill();
  }

  for (const offset of [-0.58, 0.56]) {
    shadowContext.save();
    shadowContext.translate(palmCenter.x + rx * offset, candyY + 3);
    shadowContext.rotate(Math.PI / 4);
    shadowContext.fillRect(-rx * 0.06, -rx * 0.06, rx * 0.12, rx * 0.12);
    shadowContext.restore();
  }

  shadowContext.font = `${Math.max(6, palmRadius * 0.18)}px ui-sans-serif, system-ui, sans-serif`;
  shadowContext.fillText("e... vivrai di piu !", palmCenter.x, palmCenter.y + ry * 0.5);
  shadowContext.font = `${Math.max(5, palmRadius * 0.15)}px ui-sans-serif, system-ui, sans-serif`;
  shadowContext.fillText("Tronchetti di", palmCenter.x, palmCenter.y + ry * 0.68);
  shadowContext.fillText("liquirizio purissimo", palmCenter.x, palmCenter.y + ry * 0.82);

  shadowContext.strokeStyle = "#1d1d1f";
  shadowContext.lineWidth = 1.2;
  shadowContext.beginPath();
  shadowContext.arc(palmCenter.x, palmCenter.y - ry * 0.78, rx * 0.12, Math.PI, Math.PI * 2);
  shadowContext.moveTo(palmCenter.x - rx * 0.12, palmCenter.y - ry * 0.78);
  shadowContext.lineTo(palmCenter.x - rx * 0.34, palmCenter.y - ry * 0.58);
  shadowContext.moveTo(palmCenter.x + rx * 0.12, palmCenter.y - ry * 0.78);
  shadowContext.lineTo(palmCenter.x + rx * 0.34, palmCenter.y - ry * 0.58);
  shadowContext.stroke();

  shadowContext.strokeStyle = "#d7d7d7";
  shadowContext.lineWidth = 2;
  shadowContext.beginPath();
  shadowContext.ellipse(palmCenter.x, palmCenter.y, rx, ry, 0, 0, Math.PI * 2);
  shadowContext.stroke();
  shadowContext.restore();
}

function drawSegmentationSilhouette(results) {
  if (!results.segmentationMask) return;
  const offscreen = state.segmentationCanvas;
  if (offscreen.width !== shadowCanvas.width || offscreen.height !== shadowCanvas.height) {
    offscreen.width = shadowCanvas.width;
    offscreen.height = shadowCanvas.height;
  }
  const offCtx = offscreen.getContext("2d");
  offCtx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  offCtx.globalCompositeOperation = "source-over";
  offCtx.drawImage(results.segmentationMask, 0, 0, shadowCanvas.width, shadowCanvas.height);
  offCtx.globalCompositeOperation = "source-in";
  offCtx.fillStyle = "#050505";
  offCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  offCtx.globalCompositeOperation = "source-over";
  shadowContext.save();
  shadowContext.filter = "blur(3px)";
  shadowContext.globalAlpha = 0.95;
  shadowContext.drawImage(offscreen, 0, 0);
  shadowContext.restore();
}

function drawShadowPuppet(results, options = {}) {
  if (!results.faceLandmarks) return;
  const { clearBackground = true, alpha = 1 } = options;
  resizeShadowCanvas();
  if (clearBackground) {
    shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowContext.fillStyle = "#000";
    shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  }
  shadowContext.save();
  shadowContext.globalAlpha = alpha;
  drawSegmentationSilhouette(results);
  drawBodySilhouette(results);
  drawFaceDetails(results.faceLandmarks);

  let rightScreenPalm = null;
  const now = performance.now();
  for (const hand of [results.leftHandLandmarks, results.rightHandLandmarks]) {
    if (!hand) continue;
    const handPoints = drawHandShape(hand);
    if (isOpenPalm(handPoints)) {
      const palmCenter = getPalmCenter(handPoints);
      const centerX = palmCenter.x;
      if (!rightScreenPalm || centerX > rightScreenPalm.centerX) {
        rightScreenPalm = { handPoints, centerX, palmCenter };
      }
    }
  }

  if (rightScreenPalm && rightScreenPalm.centerX > shadowCanvas.width * 0.52) {
    const samePalm =
      state.palmLogoCandidate &&
      isPalmStable(state.palmLogoCandidate.center, rightScreenPalm.palmCenter);

    if (samePalm) {
      state.palmLogoCandidate = {
        center: rightScreenPalm.palmCenter,
        handPoints: rightScreenPalm.handPoints,
        openedAt: state.palmLogoCandidate.openedAt,
      };
    } else {
      state.palmLogoCandidate = {
        center: rightScreenPalm.palmCenter,
        handPoints: rightScreenPalm.handPoints,
        openedAt: now,
      };
    }
  } else {
    state.palmLogoCandidate = null;
  }

  if (
    state.palmLogoCandidate &&
    now - state.palmLogoCandidate.openedAt > 320
  ) {
    drawPalmLogo(state.palmLogoCandidate.handPoints);
  }
  shadowContext.restore();
}

function drawMirroredVideoToShadowCanvas(alpha) {
  if (webcam.readyState < 2 || alpha <= 0) return;
  shadowContext.save();
  shadowContext.globalAlpha = alpha;
  shadowContext.translate(shadowCanvas.width, 0);
  shadowContext.scale(-1, 1);
  shadowContext.drawImage(webcam, 0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.restore();
}

function drawLayerView(results) {
  resizeShadowCanvas();
  shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.fillStyle = "#000";
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);

  const landmarkAlpha = THREE.MathUtils.clamp(state.layerMix / 100, 0, 1);
  const cameraAlpha = THREE.MathUtils.clamp(1 - landmarkAlpha, 0, 1);
  drawMirroredVideoToShadowCanvas(cameraAlpha);

  drawLandmarksToContext(
    shadowContext,
    shadowCanvas.width,
    shadowCanvas.height,
    results?.faceLandmarks || null,
    {
      leftHandLandmarks: results?.leftHandLandmarks,
      rightHandLandmarks: results?.rightHandLandmarks,
      poseLandmarks: results?.poseLandmarks,
    },
    landmarkAlpha,
  );
}

const MATRIX_CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$#%&*+-/<>{}[]".split("");

function resizeMatrixState() {
  resizeShadowCanvas();
  const fontSize = Math.max(14, Math.round(shadowCanvas.width / 64));
  const columns = Math.max(18, Math.floor(shadowCanvas.width / fontSize));
  const rows = Math.max(16, Math.floor(shadowCanvas.height / (fontSize * 0.95)));
  if (state.matrixColumns.length !== columns) {
    state.matrixColumns = Array.from({ length: columns }, (_, index) => ({
      head: Math.random() * rows,
      speed: 10 + (index % 5) * 1.2 + Math.random() * 4,
      trail: 6 + Math.floor(Math.random() * 10),
    }));
  }
  const sample = state.matrixSampleCanvas;
  if (sample.width !== columns || sample.height !== rows) {
    sample.width = columns;
    sample.height = rows;
  }
  return { fontSize, columns, rows };
}

function getNormalizedHandCenter(handLandmarks) {
  if (!handLandmarks?.length) return null;
  const center = averagePoints([handLandmarks[0], handLandmarks[5], handLandmarks[9], handLandmarks[13], handLandmarks[17]]);
  return { x: 1 - center.x, y: center.y };
}

function getMatrixInfluencers(results) {
  const influencers = [];
  if (results?.faceLandmarks?.length) {
    const faceKeyIndexes = [10, 338, 297, 284, 251, 389, 454, 361, 397, 152, 172, 132, 93, 234, 127, 33, 263, 1, 61, 291, 13, 14];
    faceKeyIndexes.forEach((index) => {
      const point = results.faceLandmarks[index];
      if (!point) return;
      influencers.push({ x: 1 - point.x, y: point.y, radius: 0.08, force: 0.95, type: "face" });
    });
  }

  for (const hand of [results?.leftHandLandmarks, results?.rightHandLandmarks]) {
    if (!hand?.length) continue;
    hand.forEach((point, index) => {
      influencers.push({
        x: 1 - point.x,
        y: point.y,
        radius: index === 0 ? 0.12 : 0.075,
        force: index === 0 ? 1.4 : 1.05,
        type: "hand",
      });
    });
  }

  if (results?.poseLandmarks?.length) {
    [11, 12, 13, 14, 15, 16, 23, 24].forEach((index) => {
      const point = results.poseLandmarks[index];
      if (!point) return;
      influencers.push({ x: 1 - point.x, y: point.y, radius: 0.09, force: 0.82, type: "pose" });
    });
  }
  return influencers;
}

function drawMatrixView(time) {
  const { fontSize, columns, rows } = resizeMatrixState();
  const dt = state.lastMatrixFrameTime ? Math.min(0.05, (time - state.lastMatrixFrameTime) / 1000) : 0.016;
  state.lastMatrixFrameTime = time;
  const influencers = getMatrixInfluencers(state.latestHolisticResults);
  const realismMix = clamp01(state.matrixFaceMix / 100);

  shadowContext.fillStyle = "rgba(0, 10, 4, 0.22)";
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.font = `700 ${fontSize}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  shadowContext.textAlign = "center";
  shadowContext.textBaseline = "middle";
  let brightCells = 0;
  let sampleData = null;

  if (isWebcamActive() && webcam.readyState >= 2 && realismMix > 0) {
    const sample = state.matrixSampleCanvas;
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    sampleCtx.clearRect(0, 0, sample.width, sample.height);
    sampleCtx.save();
    sampleCtx.translate(sample.width, 0);
    sampleCtx.scale(-1, 1);
    sampleCtx.drawImage(webcam, 0, 0, sample.width, sample.height);
    sampleCtx.restore();
    sampleData = sampleCtx.getImageData(0, 0, sample.width, sample.height).data;
  }

  shadowContext.save();
  shadowContext.shadowBlur = fontSize * 0.7;
  shadowContext.shadowColor = "rgba(58, 255, 138, 0.42)";

  state.matrixColumns.forEach((column, columnIndex) => {
    const columnNormX = columns <= 1 ? 0.5 : columnIndex / (columns - 1);
    let columnForce = 0;
    influencers.forEach((influencer) => {
      const dx = Math.abs(columnNormX - influencer.x);
      const effect = clamp01(1 - dx / influencer.radius) * influencer.force;
      columnForce = Math.max(columnForce, effect);
    });

    column.head += (column.speed + columnForce * 6.5) * dt;
    if (column.head - column.trail > rows + 2) {
      column.head = -Math.random() * rows * 0.5;
      column.speed = 10 + Math.random() * 6;
      column.trail = 6 + Math.floor(Math.random() * 10) + Math.round(columnForce * 3);
    }
    const x = columnIndex * fontSize + fontSize * 0.5;

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const y = rowIndex * fontSize * 0.95 + fontSize * 0.55;
      const rowNormY = rows <= 1 ? 0.5 : rowIndex / (rows - 1);
      const distanceToHead = column.head - rowIndex;
      const trailStrength =
        distanceToHead >= 0 && distanceToHead <= column.trail
          ? 1 - distanceToHead / column.trail
          : 0;

      let landmarkFlow = 0;
      influencers.forEach((influencer) => {
        const dx = columnNormX - influencer.x;
        const dy = rowNormY - influencer.y;
        const distance = Math.hypot(dx, dy);
        const effect = clamp01(1 - distance / influencer.radius) * influencer.force;
        landmarkFlow = Math.max(landmarkFlow, effect);
      });

      let sampleBrightness = 0;
      if (sampleData) {
        const sampleIndex = (rowIndex * columns + (columns - 1 - columnIndex)) * 4;
        const red = sampleData[sampleIndex];
        const greenSample = sampleData[sampleIndex + 1];
        const blue = sampleData[sampleIndex + 2];
        sampleBrightness = (red * 0.25 + greenSample * 0.6 + blue * 0.15) / 255;
      }

      const brightness = THREE.MathUtils.lerp(landmarkFlow, Math.max(landmarkFlow * 0.65, sampleBrightness), realismMix);
      if (brightness > 0.48) brightCells += 1;

      const silhouetteBoost = brightness > 0.56 ? (brightness - 0.56) * 1.9 : 0;
      const visible = Math.max(trailStrength * 0.94, brightness * 1.18 - 0.08, silhouetteBoost, landmarkFlow * 0.9);
      if (visible <= 0.08) continue;

      const glyphIndex = Math.floor(
        ((rowIndex * 7 + columnIndex * 11 + Math.floor(time * 0.02)) * (brightness > 0 ? 1 + brightness : 1)) %
          MATRIX_CHARACTERS.length,
      );
      const glyph = MATRIX_CHARACTERS[(glyphIndex + MATRIX_CHARACTERS.length) % MATRIX_CHARACTERS.length];
      const glow = clamp01(Math.max(brightness, trailStrength, landmarkFlow));
      const green = Math.round(110 + glow * 145);
      const alpha = clamp01(visible);

      shadowContext.fillStyle =
        trailStrength > 0.92 || brightness > 0.72 || landmarkFlow > 0.8
          ? `rgba(225, 255, 235, ${Math.max(0.78, alpha)})`
          : brightness > 0.52 || landmarkFlow > 0.45
            ? `rgba(125, ${green}, 140, ${Math.min(1, alpha + 0.1)})`
            : `rgba(70, ${green}, 96, ${alpha})`;
      shadowContext.fillText(glyph, x, y);
    }
  });
  shadowContext.restore();

  const subjectRatio = brightCells / Math.max(1, columns * rows);
  state.matrixSubjectStrength = THREE.MathUtils.lerp(state.matrixSubjectStrength, subjectRatio, 0.12);

  shadowContext.save();
  shadowContext.globalCompositeOperation = "screen";
  shadowContext.fillStyle = `rgba(42, 255, 120, ${Math.min(0.14, state.matrixSubjectStrength * 1.1)})`;
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.restore();

  shadowContext.save();
  shadowContext.strokeStyle = `rgba(110, 255, 170, ${Math.min(0.22, state.matrixSubjectStrength * 1.6)})`;
  shadowContext.lineWidth = 1;
  shadowContext.setLineDash([2, fontSize * 0.8]);
  for (let x = fontSize * 0.5; x < shadowCanvas.width; x += fontSize * 3.4) {
    shadowContext.beginPath();
    shadowContext.moveTo(x, 0);
    shadowContext.lineTo(x, shadowCanvas.height);
    shadowContext.stroke();
  }
  shadowContext.restore();
}

function drawRecordingIntroFrame(results, elapsedMs) {
  resizeShadowCanvas();
  shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.fillStyle = "#000";
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);

  const webcamHoldMs = 1200;
  const webcamToLandmarksMs = 800;
  const landmarksHoldMs = 700;
  const landmarksToTabuMs = SHADOW_RECORDING_INTRO_DURATION_MS - webcamHoldMs - webcamToLandmarksMs - landmarksHoldMs;

  const phase1End = webcamHoldMs;
  const phase2End = phase1End + webcamToLandmarksMs;
  const phase3End = phase2End + landmarksHoldMs;
  const phase4End = phase3End + landmarksToTabuMs;

  let cameraAlpha = 0;
  let landmarkAlpha = 0;
  let tabuAlpha = 0;

  if (elapsedMs <= phase1End) {
    cameraAlpha = 1;
  } else if (elapsedMs <= phase2End) {
    const mix = smoothStep01((elapsedMs - phase1End) / webcamToLandmarksMs);
    cameraAlpha = 1 - mix;
    landmarkAlpha = mix;
  } else if (elapsedMs <= phase3End) {
    landmarkAlpha = 1;
  } else if (elapsedMs <= phase4End) {
    const mix = smoothStep01((elapsedMs - phase3End) / landmarksToTabuMs);
    cameraAlpha = 0;
    landmarkAlpha = 1 - mix;
    tabuAlpha = mix;
  } else {
    tabuAlpha = 1;
  }

  drawMirroredVideoToShadowCanvas(cameraAlpha);
  drawLandmarksToContext(
    shadowContext,
    shadowCanvas.width,
    shadowCanvas.height,
    results?.faceLandmarks || null,
    {
      leftHandLandmarks: results?.leftHandLandmarks,
      rightHandLandmarks: results?.rightHandLandmarks,
      poseLandmarks: results?.poseLandmarks,
    },
    landmarkAlpha,
  );

  if (tabuAlpha > 0) {
    drawShadowPuppet(results, { clearBackground: false, alpha: tabuAlpha });
  }
}

async function trackScene3d() {
  if (!state.faceLandmarker || webcam.readyState < 2) return;
  if (webcam.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = webcam.currentTime;
  const result = state.faceLandmarker.detectForVideo(webcam, performance.now());
  const landmarks = result.faceLandmarks[0];
  state.latestFaceLandmarks = landmarks || null;
  drawOverlay(landmarks);
  updateHeadTarget(landmarks);
  trackingStatus.textContent = landmarks
    ? state.prototype === "mask3d"
      ? "Palloncino agganciato"
      : "Posa testa agganciata"
    : "Volto non trovato";
}

function trackShadowPrototype() {
  if (!state.holistic || webcam.readyState < 2 || state.holisticBusy) return;
  if (webcam.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = webcam.currentTime;
  state.holisticBusy = true;
  state.holistic
    .send({ image: webcam })
    .catch((error) => {
      console.error(error);
      trackingStatus.textContent = "Errore shadow puppet";
    })
    .finally(() => {
      state.holisticBusy = false;
    });
}

function updatePrototypeUi() {
  const copy = prototypeCopy[state.prototype];
  heroTitle.textContent = copy.title;
  heroIntro.textContent = copy.intro;
  prototypeShadowButton.classList.toggle("is-active", state.prototype === "shadow");
  prototype3dButton.classList.toggle("is-active", state.prototype === "scene3d");
  prototypeMaskButton.classList.toggle("is-active", state.prototype === "mask3d");
  prototypeLayerButton.classList.toggle("is-active", state.prototype === "layer");
  prototypeMatrixButton.classList.toggle("is-active", state.prototype === "matrix");
  prototypeShadowButton.setAttribute("aria-selected", String(state.prototype === "shadow"));
  prototype3dButton.setAttribute("aria-selected", String(state.prototype === "scene3d"));
  prototypeMaskButton.setAttribute("aria-selected", String(state.prototype === "mask3d"));
  prototypeLayerButton.setAttribute("aria-selected", String(state.prototype === "layer"));
  prototypeMatrixButton.setAttribute("aria-selected", String(state.prototype === "matrix"));
  const isShadow = state.prototype === "shadow";
  const isLayer = state.prototype === "layer";
  const isMask = state.prototype === "mask3d";
  const isMatrix = state.prototype === "matrix";
  const hidePreview = isLayer || state.isRecordingCountdown || state.isRecordingShadow;
  stage.classList.toggle("stage--shadow", isShadow);
  stage.classList.toggle("stage--layer", isLayer);
  stage.classList.toggle("stage--mask", isMask);
  stage.classList.toggle("stage--matrix", isMatrix);
  document.querySelector(".preview-card")?.classList.toggle("is-hidden", hidePreview);
  shadowStage.classList.toggle("is-hidden", !isShadow && !isLayer && !isMatrix);
  sceneRoot.classList.toggle("is-hidden", isShadow || isLayer || isMatrix);
  layerMixCard.classList.toggle("is-hidden", !isLayer);
  matrixFaceCard.classList.toggle("is-hidden", !isMatrix);
  document.querySelector(".status-card")?.classList.toggle("is-hidden", !isLayer);
  if (!isShadow && !spotAudio.paused) {
    spotAudio.pause();
    spotAudio.currentTime = 0;
  }
  if (!isShadow && state.isRecordingShadow) {
    stopShadowRecording();
  }
  updateAudioUi();
  updateRecordingUi();
  updateSceneModeVisibility();
  updatePrototypeUrl();
  clearShadowCanvas();
  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  state.lastVideoTime = -1;
}

async function setPrototype(nextPrototype) {
  if (state.prototype === nextPrototype) return;
  state.prototype = nextPrototype;
  updatePrototypeUi();
  if (isWebcamActive()) {
    startButton.disabled = true;
    try {
      await ensureTrackerForActivePrototype();
      trackingStatus.textContent =
        nextPrototype === "shadow"
          ? "Shadow puppet attivo"
          : nextPrototype === "matrix"
            ? "Matrix attivo"
          : nextPrototype === "layer"
            ? "Layer tracking attivo"
          : nextPrototype === "mask3d"
            ? "Palloncino attivo"
            : "Tracking attivo";
    } catch (error) {
      console.error(error);
      trackingStatus.textContent = "Errore cambio prototipo";
    } finally {
      startButton.disabled = false;
    }
  } else {
    trackingStatus.textContent =
      nextPrototype === "shadow"
        ? "Attiva la webcam per Tabù"
        : nextPrototype === "matrix"
          ? "Attiva la webcam per Matrix"
        : nextPrototype === "layer"
          ? "Attiva la webcam per Layers"
        : nextPrototype === "mask3d"
          ? "Attiva la webcam per Palloncino"
          : "In attesa della webcam...";
  }
}

function animate(time) {
  state.animationFrameId = requestAnimationFrame(animate);

  if (isWebcamActive()) {
    if (state.prototype === "scene3d" || state.prototype === "mask3d") trackScene3d();
    else if (state.prototype === "shadow" || state.prototype === "layer" || state.prototype === "matrix") trackShadowPrototype();
  }

  if (state.prototype === "scene3d") {
    smoothTracking();
    updateCamera(time);
    objects.forEach((mesh, index) => {
      mesh.rotation.x += 0.0035 + index * 0.00005;
      mesh.rotation.y += 0.005 + index * 0.00004;
    });
    if (state.loadedModelRoot) state.loadedModelRoot.rotation.y += 0.0035;
    renderer.render(scene, camera);
  } else if (state.prototype === "mask3d") {
    smoothTracking();
    updateMaskScene();
    renderer.render(scene, camera);
  } else if (state.prototype === "matrix") {
    drawMatrixView(time);
  } else if (state.prototype === "layer" && state.latestHolisticResults) {
    drawLayerView(state.latestHolisticResults);
  } else if (state.latestHolisticResults) {
    if (state.isRecordingCountdown && state.recordingCountdownStartedAt > 0) {
      const countdownElapsed = performance.now() - state.recordingCountdownStartedAt;
      drawShadowPuppet(state.latestHolisticResults);
      drawRecordingCountdownOverlay(countdownElapsed);
      if (countdownElapsed >= SHADOW_RECORDING_COUNTDOWN_MS) {
        beginShadowRecording();
      }
    } else if (state.isRecordingShadow && state.recordingIntroStartedAt > 0) {
      const elapsed = performance.now() - state.recordingIntroStartedAt;
      if (elapsed < SHADOW_RECORDING_INTRO_DURATION_MS) {
        drawRecordingIntroFrame(state.latestHolisticResults, elapsed);
      } else {
        state.recordingIntroStartedAt = 0;
        drawShadowPuppet(state.latestHolisticResults);
      }
    } else {
      drawShadowPuppet(state.latestHolisticResults);
    }
  } else {
    resizeShadowCanvas();
    clearShadowCanvas();
    shadowContext.fillStyle = "#000";
    shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  }

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeShadowCanvas();
}

startButton.addEventListener("click", startWebcam);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", stopPointerDrag);
renderer.domElement.addEventListener("pointercancel", stopPointerDrag);
prototypeShadowButton.addEventListener("click", () => {
  setPrototype("shadow");
});
prototype3dButton.addEventListener("click", () => {
  setPrototype("scene3d");
});
prototypeMaskButton.addEventListener("click", () => {
  setPrototype("mask3d");
});
prototypeLayerButton.addEventListener("click", () => {
  setPrototype("layer");
});
prototypeMatrixButton.addEventListener("click", () => {
  setPrototype("matrix");
});
audioToggleButton.addEventListener("click", toggleSpotAudio);
recordButton.addEventListener("click", startShadowRecording);
stopRecordButton.addEventListener("click", stopShadowRecording);
downloadRecordButton.addEventListener("click", handleDownloadLastRecording);
shareRecordButton.addEventListener("click", handleShareLastRecording);
shareButton.addEventListener("click", shareCurrentPrototype);

loadPresetButton.addEventListener("click", async () => {
  const selectedValue = presetModelSelect.value;
  if (selectedValue === "demo") {
    resetToDemoScene();
    return;
  }
  await loadModel(selectedValue, presetModelSelect.selectedOptions[0]?.textContent || selectedValue);
});

landmarksVideoButton.addEventListener("click", () => {
  setPreviewMode("video-landmarks");
});
landmarksOnlyButton.addEventListener("click", () => {
  setPreviewMode("landmarks-only");
});
layerMixRange.addEventListener("input", (event) => {
  state.layerMix = Number(event.target.value);
  updateLayerMixUi();
});
matrixFaceRange.addEventListener("input", (event) => {
  state.matrixFaceMix = Number(event.target.value);
  updateMatrixFaceUi();
});

modelFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
  presetModelSelect.value = "demo";
  state.activeObjectUrl = URL.createObjectURL(file);
  await loadModel(state.activeObjectUrl, file.name);
});

modelUrlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = modelUrlInput.value.trim();
  if (!url) return;
  presetModelSelect.value = "demo";
  await loadModel(url, url);
});

window.addEventListener("resize", onWindowResize);

const initialPrototype = getInitialPrototypeFromUrl();
if (initialPrototype) {
  state.prototype = initialPrototype;
}

setPreviewMode("video-landmarks");
setCameraButtonState("Pronta al tracking", false);
updateLayerMixUi();
updateMatrixFaceUi();
state.recordingMimeType = getRecorderMimeType() || "video/webm";
updatePrototypeUi();
updateRecordingUi();
resetToDemoScene();
updateSceneModeVisibility();
animate(0);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(state.animationFrameId);
  stopWebcam();
  spotAudio.pause();
  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
  if (recordingPreviewUrl) URL.revokeObjectURL(recordingPreviewUrl);
});
