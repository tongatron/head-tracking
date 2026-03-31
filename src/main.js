import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const sceneRoot = document.getElementById("scene-root");
const webcam = document.getElementById("webcam");
const webcamOverlay = document.getElementById("webcam-overlay");
const startButton = document.getElementById("start-button");
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
const landmarksOnButton = document.getElementById("landmarks-on");
const landmarksOffButton = document.getElementById("landmarks-off");

const overlayContext = webcamOverlay.getContext("2d");
const gltfLoader = new GLTFLoader();

let faceLandmarker;
let videoStream;
let animationFrameId = 0;
let lastVideoTime = -1;
let loadedModelRoot = null;
let activeObjectUrl = null;
let showLandmarks = true;
let isDraggingView = false;
let activePointerId = null;
let lastPointerX = 0;
let lastPointerY = 0;

const manualView = {
  yaw: 0,
  pitch: 0,
};

const smoothedHead = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  z: 0.5,
  x: 0,
  y: 0,
};

const targetHead = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  z: 0.5,
  x: 0,
  y: 0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#08111f");
scene.fog = new THREE.Fog("#08111f", 14, 30);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 1.5, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.cursor = "grab";
sceneRoot.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight("#9ad1ff", "#09111f", 1.35);
scene.add(ambientLight);

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

function clearLoadedModel() {
  if (!loadedModelRoot) {
    return;
  }

  contentGroup.remove(loadedModelRoot);
  loadedModelRoot.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }

    if (Array.isArray(node.material)) {
      node.material.forEach((material) => material.dispose());
    } else if (node.material) {
      node.material.dispose();
    }
  });
  loadedModelRoot = null;
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
    const gltf = await gltfLoader.loadAsync(source);

    clearLoadedModel();
    setDemoObjectsVisible(false);

    loadedModelRoot = gltf.scene;
    loadedModelRoot.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    frameModel(loadedModelRoot);
    contentGroup.add(loadedModelRoot);

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

function drawOverlay(landmarks) {
  webcamOverlay.width = webcam.videoWidth;
  webcamOverlay.height = webcam.videoHeight;

  overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  overlayContext.strokeStyle = "rgba(105, 210, 231, 0.72)";
  overlayContext.lineWidth = 1.5;
  overlayContext.fillStyle = "rgba(105, 210, 231, 0.95)";

  if (!showLandmarks || !landmarks?.length) {
    return;
  }

  for (const landmark of landmarks) {
    const x = landmark.x * webcamOverlay.width;
    const y = landmark.y * webcamOverlay.height;
    overlayContext.beginPath();
    overlayContext.arc(x, y, 1.6, 0, Math.PI * 2);
    overlayContext.fill();
  }
}

function setLandmarkVisibility(nextValue) {
  showLandmarks = nextValue;
  landmarkToggle.dataset.state = nextValue ? "on" : "off";
  landmarksOnButton.classList.toggle("is-active", nextValue);
  landmarksOffButton.classList.toggle("is-active", !nextValue);

  if (!nextValue) {
    overlayContext.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
  }
}

function onPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  isDraggingView = true;
  activePointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.style.cursor = "grabbing";
}

function onPointerMove(event) {
  if (!isDraggingView || event.pointerId !== activePointerId) {
    return;
  }

  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  manualView.yaw += deltaX * 0.0055;
  manualView.pitch = THREE.MathUtils.clamp(
    manualView.pitch + deltaY * 0.0045,
    -0.75,
    0.75,
  );
}

function stopPointerDrag(event) {
  if (activePointerId !== event.pointerId) {
    return;
  }

  isDraggingView = false;
  activePointerId = null;
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

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
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

  const yaw = THREE.MathUtils.clamp((noseTip.x - eyeMidX) / (eyeDistance * 0.9), -1, 1);
  const pitchReferenceY = (eyeMidY + mouthCenter.y) * 0.5;
  const pitch = THREE.MathUtils.clamp((noseTip.y - pitchReferenceY) / (faceHeight * 0.55), -1, 1);
  const roll = THREE.MathUtils.clamp(Math.atan2(eyeDy, eyeDx), -0.7, 0.7);
  const horizontalOffset = THREE.MathUtils.clamp((faceCenter.x - 0.5) * 2, -1, 1);
  const verticalOffset = THREE.MathUtils.clamp((faceCenter.y - 0.5) * 2, -1, 1);

  targetHead.yaw = yaw;
  targetHead.pitch = pitch;
  targetHead.roll = roll;
  targetHead.x = horizontalOffset;
  targetHead.y = verticalOffset;
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
  camera.lookAt(
    smoothedHead.x * 0.9,
    -smoothedHead.y * 0.6,
    0,
  );
  camera.rotation.z = smoothedHead.roll * 0.35;

  stageGroup.rotation.y = Math.sin(time * 0.00022) * 0.22;
}

async function setupFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
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
}

async function startWebcam() {
  startButton.disabled = true;
  trackingStatus.textContent = "Richiesta permesso webcam...";

  try {
    if (!faceLandmarker) {
      trackingStatus.textContent = "Caricamento face tracking...";
      await setupFaceLandmarker();
    }

    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    webcam.srcObject = videoStream;

    await webcam.play();
    trackingStatus.textContent = "Tracking attivo";
    startButton.textContent = "Webcam attiva";
  } catch (error) {
    console.error(error);
    trackingStatus.textContent = "Errore webcam o modello";
    startButton.disabled = false;
    startButton.textContent = "Riprova";
  }
}

async function trackFace() {
  if (!faceLandmarker || webcam.readyState < 2) {
    return;
  }

  if (webcam.currentTime !== lastVideoTime) {
    lastVideoTime = webcam.currentTime;
    const result = faceLandmarker.detectForVideo(webcam, performance.now());
    const landmarks = result.faceLandmarks[0];

    drawOverlay(landmarks);
    updateHeadTarget(landmarks);
    trackingStatus.textContent = landmarks ? "Posa testa agganciata" : "Volto non trovato";
  }
}

function animate(time) {
  animationFrameId = requestAnimationFrame(animate);

  trackFace();
  smoothTracking();
  updateCamera(time);

  objects.forEach((mesh, index) => {
    mesh.rotation.x += 0.0035 + index * 0.00005;
    mesh.rotation.y += 0.005 + index * 0.00004;
  });

  if (loadedModelRoot) {
    loadedModelRoot.rotation.y += 0.0035;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

startButton.addEventListener("click", startWebcam);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", stopPointerDrag);
renderer.domElement.addEventListener("pointercancel", stopPointerDrag);

loadPresetButton.addEventListener("click", async () => {
  const selectedValue = presetModelSelect.value;
  if (selectedValue === "demo") {
    resetToDemoScene();
    return;
  }

  await loadModel(selectedValue, presetModelSelect.selectedOptions[0]?.textContent || selectedValue);
});

landmarksOnButton.addEventListener("click", () => {
  setLandmarkVisibility(true);
});

landmarksOffButton.addEventListener("click", () => {
  setLandmarkVisibility(false);
});

modelFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
  }

  presetModelSelect.value = "demo";
  activeObjectUrl = URL.createObjectURL(file);
  await loadModel(activeObjectUrl, file.name);
});

modelUrlForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = modelUrlInput.value.trim();
  if (!url) {
    return;
  }

  presetModelSelect.value = "demo";
  await loadModel(url, url);
});

window.addEventListener("resize", onWindowResize);

setLandmarkVisibility(true);
animate(0);

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrameId);
  videoStream?.getTracks().forEach((track) => track.stop());
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
  }
});
