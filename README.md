# Head Tracking

Web app sperimentale basata su webcam per esplorare diversi prototipi di tracking in tempo reale:

- `Tabù simulator`
- `Ambienti 3D`
- `Palloncino`
- `Layers`
- `Matrix`

L'app combina tracking facciale, landmark di volto/mani/posa, rendering 2D e scene 3D in browser. Oltre alla navigazione di scene `three.js`, include filtri stilizzati, visualizzazioni tecniche dei landmark e registrazione video della scena `Tabù`.

## Tecnologie utilizzate

- `Vite` per sviluppo locale e build
- `three` per rendering 3D, camera motion e scena `Ambienti 3D` / `Palloncino`
- `@mediapipe/tasks-vision` per `FaceLandmarker` e stima della testa nei prototipi 3D
- `MediaPipe Holistic` via CDN per volto, mani e posa nei prototipi `Tabù`, `Layers` e `Matrix`
- `HTML5 Canvas 2D` per overlay landmark, shadow puppet, Matrix e registrazione della scena
- `MediaRecorder` per registrare la scena `Tabù` direttamente nel browser
- `Web Audio API` per gestire e mixare l'audio dello spot nella registrazione
- `GLTFLoader` di `three/examples` per caricare modelli `.glb`

## Prototipi inclusi

### Tabù simulator

- filtro teatrale ispirato agli spot Tabù
- tracking di volto e mani
- preview webcam + landmark
- riproduzione dello spot audio
- registrazione della scena finale con anteprima inline e download manuale

### Ambienti 3D

- controllo della camera 3D con yaw, pitch e distanza del volto
- drag manuale della vista con click e trascinamento
- caricamento di modelli `.glb` locali o da URL
- preset 3D inclusi nel progetto

### Palloncino

- avatar/testa 3D minimale che segue il volto
- occhi e bocca reattivi

### Layers

- visualizzazione full-screen di tutti i landmark disponibili
- supporto a volto, mani e pose
- blend regolabile tra camera e landmark
- console live con variabili di tracking in tempo reale

### Matrix

- pioggia di simboli verdi stile Matrix
- integrazione dei landmark nel flusso
- mix regolabile tra resa landmark e resa più realistica del volto

## Avvio locale

```bash
cd /Users/tonga/Documents/GitHub/head-tracking
npm install
npm run dev -- --host 127.0.0.1
```

Apri:

```text
http://127.0.0.1:4174/head-tracking/
```

Per esporre il server anche ad altri dispositivi sulla rete locale:

```bash
npm run dev -- --host 0.0.0.0
```

## Build

```bash
npm run build
```

La build finale viene generata in `dist/`.

## GitHub Pages

Il progetto è configurato per essere pubblicato su GitHub Pages tramite GitHub Actions.

File coinvolti:

- [vite.config.js](./vite.config.js)
- [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml)

Il `base` di Vite è impostato su:

```js
/head-tracking/
```

Questo serve per far funzionare correttamente asset e bundle quando il sito è pubblicato sotto il path del repository.

## Registrazione video

Nel prototipo `Tabù simulator` è disponibile una registrazione browser-side della scena:

- countdown iniziale
- intro webcam -> landmark -> Tabù
- audio dello spot incluso nel file
- anteprima del video generato direttamente nella pagina
- download manuale tramite pulsante `Scarica file`

## Modelli 3D inclusi

I preset locali sono in:

- [public/models/crystal-bloom.glb](./public/models/crystal-bloom.glb)
- [public/models/orb-garden.glb](./public/models/orb-garden.glb)
- [public/models/portal-stack.glb](./public/models/portal-stack.glb)

Lo script che genera i modelli di esempio è:

- [tools/generate-sample-models.mjs](./tools/generate-sample-models.mjs)

## Struttura progetto

```text
head-tracking/
├─ .github/workflows/
├─ public/audio/
├─ public/models/
├─ src/
│  ├─ main.js
│  └─ style.css
├─ tools/
├─ index.html
├─ package.json
└─ vite.config.js
```

## Note

- I preset `.glb` vengono risolti con `import.meta.env.BASE_URL`, quindi funzionano sia in locale sia su GitHub Pages.
- Il browser deve avere accesso alla webcam e l'utente deve concedere il permesso.
- I prototipi `Tabù`, `Layers` e `Matrix` dipendono da `MediaPipe Holistic` caricato via CDN.
- La registrazione usa `MediaRecorder`: il formato finale dipende dal supporto del browser (`mp4` o `webm`).
- Su mobile o altri device conviene usare HTTPS o un host locale accessibile in rete.
