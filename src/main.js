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
const trackingStatus = document.getElementById("tracking-status");
const metricX = document.getElementById("metric-x");
const metricY = document.getElementById("metric-y");
const metricZ = document.getElementById("metric-z");
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
const heroTitle = document.getElementById("hero-title");
const heroIntro = document.getElementById("hero-intro");
const stage = document.querySelector(".stage");

const overlayContext = webcamOverlay.getContext("2d");
const gltfLoader = new GLTFLoader();
const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);

const prototypeCopy = {
  shadow: {
    title: "Tabu simulator",
    intro:
      "Il prototipo trasforma webcam, volto e mani in una silhouette teatrale ispirata agli spot Tabu, mantenendo tracking live e logo sul palmo aperto.",
  },
  scene3d: {
    title: "3D Head Tracking",
    intro:
      "Il prototipo usa la webcam del device per stimare posizione e distanza del volto. Lo spostamento della testa orbita la camera attorno alla scena 3D; avvicinandoti o allontanandoti cambi lo zoom.",
  },
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
  segmentationCanvas: document.createElement("canvas"),
  palmLogoCandidate: null,
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

function updateMetrics() {
  metricX.textContent = smoothedHead.yaw.toFixed(2);
  metricY.textContent = smoothedHead.pitch.toFixed(2);
  metricZ.textContent = smoothedHead.z.toFixed(2);
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

function setCameraButtonState(stateLabel, isActive = false) {
  cameraCtaState.textContent = stateLabel;
  startButton.classList.toggle("is-active", isActive);
  cameraCtaLabel.textContent = isActive ? "Disattiva fotocamera" : "Attiva fotocamera";
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
  state.videoStream?.getTracks().forEach((track) => track.stop());
  state.videoStream = null;
  webcam.srcObject = null;
  state.lastVideoTime = -1;
  state.latestHolisticResults = null;
  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  clearShadowCanvas();
  resetTrackingTargets();
  trackingStatus.textContent = "Webcam disattivata";
  startButton.disabled = false;
  setCameraButtonState("Pronta al tracking", false);
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
  updateMetrics();
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

function drawHandOverlay(handLandmarks) {
  if (!handLandmarks?.length) return;
  overlayContext.strokeStyle = "rgba(255, 248, 210, 0.72)";
  overlayContext.lineWidth = 2;
  overlayContext.fillStyle = "rgba(255, 248, 210, 0.95)";

  for (const chain of HAND_FINGER_CHAINS) {
    overlayContext.beginPath();
    chain.forEach((index, chainIndex) => {
      const point = handLandmarks[index];
      const x = point.x * webcamOverlay.width;
      const y = point.y * webcamOverlay.height;
      if (chainIndex === 0) overlayContext.moveTo(x, y);
      else overlayContext.lineTo(x, y);
    });
    overlayContext.stroke();
  }

  for (const landmark of handLandmarks) {
    const x = landmark.x * webcamOverlay.width;
    const y = landmark.y * webcamOverlay.height;
    overlayContext.beginPath();
    overlayContext.arc(x, y, 3, 0, Math.PI * 2);
    overlayContext.fill();
  }
}

function drawPoseOverlay(poseLandmarks) {
  if (!poseLandmarks?.length) return;
  overlayContext.strokeStyle = "rgba(255, 104, 104, 0.48)";
  overlayContext.lineWidth = 2;
  overlayContext.fillStyle = "rgba(255, 104, 104, 0.8)";

  for (const chain of POSE_PREVIEW_CHAINS) {
    overlayContext.beginPath();
    chain.forEach((index, chainIndex) => {
      const point = poseLandmarks[index];
      const x = point.x * webcamOverlay.width;
      const y = point.y * webcamOverlay.height;
      if (chainIndex === 0) overlayContext.moveTo(x, y);
      else overlayContext.lineTo(x, y);
    });
    overlayContext.stroke();
  }

  for (const index of new Set(POSE_PREVIEW_CHAINS.flat())) {
    const landmark = poseLandmarks[index];
    const x = landmark.x * webcamOverlay.width;
    const y = landmark.y * webcamOverlay.height;
    overlayContext.beginPath();
    overlayContext.arc(x, y, 3, 0, Math.PI * 2);
    overlayContext.fill();
  }
}

function drawOverlay(landmarks, extras = {}) {
  webcamOverlay.width = webcam.videoWidth;
  webcamOverlay.height = webcam.videoHeight;
  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  const hasFace = Boolean(landmarks?.length);
  const hasHands = Boolean(extras.leftHandLandmarks?.length || extras.rightHandLandmarks?.length);
  const hasPose = Boolean(extras.poseLandmarks?.length);
  if (!hasFace && !hasHands && !hasPose) return;
  overlayContext.fillStyle = "rgba(105, 210, 231, 0.95)";
  if (hasFace) {
    for (const landmark of landmarks) {
      const x = landmark.x * webcamOverlay.width;
      const y = landmark.y * webcamOverlay.height;
      overlayContext.beginPath();
      overlayContext.arc(x, y, 1.6, 0, Math.PI * 2);
      overlayContext.fill();
    }
  }

  drawHandOverlay(extras.leftHandLandmarks);
  drawHandOverlay(extras.rightHandLandmarks);
  drawPoseOverlay(extras.poseLandmarks);
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
  if (state.prototype === "scene3d") {
    trackingStatus.textContent = "Caricamento face tracking...";
    await setupFaceLandmarker();
  } else {
    trackingStatus.textContent = "Caricamento shadow puppet...";
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
    trackingStatus.textContent = state.prototype === "scene3d" ? "Tracking attivo" : "Shadow puppet attivo";
    setCameraButtonState("Camera attiva", true);
  } catch (error) {
    console.error(error);
    trackingStatus.textContent = "Errore webcam o modello";
    startButton.disabled = false;
    setCameraButtonState("Errore, riprova", false);
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

function drawShadowPuppet(results) {
  if (!results.faceLandmarks) return;
  resizeShadowCanvas();
  shadowContext.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
  shadowContext.fillStyle = "#000";
  shadowContext.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
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
}

async function trackScene3d() {
  if (!state.faceLandmarker || webcam.readyState < 2) return;
  if (webcam.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = webcam.currentTime;
  const result = state.faceLandmarker.detectForVideo(webcam, performance.now());
  const landmarks = result.faceLandmarks[0];
  drawOverlay(landmarks);
  updateHeadTarget(landmarks);
  trackingStatus.textContent = landmarks ? "Posa testa agganciata" : "Volto non trovato";
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
  prototypeShadowButton.setAttribute("aria-selected", String(state.prototype === "shadow"));
  prototype3dButton.setAttribute("aria-selected", String(state.prototype === "scene3d"));
  const isShadow = state.prototype === "shadow";
  stage.classList.toggle("stage--shadow", isShadow);
  shadowStage.classList.toggle("is-hidden", !isShadow);
  sceneRoot.classList.toggle("is-hidden", isShadow);
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
      trackingStatus.textContent = nextPrototype === "scene3d" ? "Tracking attivo" : "Shadow puppet attivo";
    } catch (error) {
      console.error(error);
      trackingStatus.textContent = "Errore cambio prototipo";
    } finally {
      startButton.disabled = false;
    }
  } else {
    trackingStatus.textContent = nextPrototype === "scene3d" ? "In attesa della webcam..." : "Attiva la webcam per Tabu";
  }
}

function animate(time) {
  state.animationFrameId = requestAnimationFrame(animate);

  if (isWebcamActive()) {
    if (state.prototype === "scene3d") trackScene3d();
    else trackShadowPrototype();
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
  } else if (state.latestHolisticResults) {
    drawShadowPuppet(state.latestHolisticResults);
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

setPreviewMode("video-landmarks");
setCameraButtonState("Pronta al tracking", false);
updatePrototypeUi();
resetToDemoScene();
animate(0);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(state.animationFrameId);
  stopWebcam();
  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
});
