# Head Tracking

Web app sperimentale per controllare una scena 3D con il movimento del volto tramite webcam del device.

L'app usa face tracking in browser per stimare posizione e distanza della testa, poi traduce questi dati in movimento della camera in una scena `three.js`.

## Stack

- `Vite`
- `three`
- `@mediapipe/tasks-vision`

## Funzioni principali

- tracking del volto via webcam
- landmark facciali con overlay video
- controllo della camera 3D con yaw, pitch e distanza
- drag manuale della vista con click e trascinamento
- caricamento di modelli `.glb` locali
- caricamento di modelli da URL
- preset 3D inclusi nel progetto
- deploy su GitHub Pages

## Avvio locale

```bash
cd /Users/tonga/Documents/GitHub/head-tracking
npm install
npm run dev -- --host 127.0.0.1
```

Apri:

```text
http://127.0.0.1:5173/
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
- Su mobile o altri device conviene usare HTTPS o un host locale accessibile in rete.
