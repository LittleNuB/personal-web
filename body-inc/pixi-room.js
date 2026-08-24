import { Application, Assets, Container, Graphics, Rectangle, Sprite } from "./vendor/pixi-8.19.0.min.mjs";

const LOGICAL_WIDTH = 390;
const LOGICAL_HEIGHT = 456;
const stableIds = new Set(["legs_slumped", "oxygen_red", "ppt_bubble", "audit_lamp", "stim_shake", "file_pile"]);
const assetUrls = {
  background: "./assets/office-background.png",
  legsIdle: "./assets/sprites/legs-idle.png",
  legsSlumped: "./assets/sprites/legs-slumped.png",
  legsRecover: "./assets/sprites/legs-recover.png",
  oxygen_red: "./assets/sprites/oxygen-red.png",
  ppt_bubble: "./assets/sprites/ppt-bubble.png",
  audit_lamp: "./assets/sprites/audit-lamp.png",
  stim_shake: "./assets/sprites/stim-shake.png",
  file_pile: "./assets/sprites/file-pile.png"
};

const viewConfig = {
  legs_slumped: { x: 82, y: 244, width: 122, layer: "actors" },
  oxygen_red: { x: 322, y: 100, width: 82, layer: "wall" },
  ppt_bubble: { x: 196, y: 142, width: 112, layer: "wall" },
  audit_lamp: { x: 330, y: 210, width: 60, layer: "wall" },
  stim_shake: { x: 195, y: 275, width: 76, layer: "props" },
  file_pile: { x: 318, y: 286, width: 88, layer: "props" }
};

let application = null;
let initializing = null;
let generation = 0;
let currentHost = null;
let latestSnapshot = emptySnapshot();
let incidentTap = null;
let resizeObserver = null;
let scene = null;
let failed = false;
let instanceSequence = 0;
let loadedAssetUrls = [];
let pendingAssetRelease = Promise.resolve();
const processedEvents = new Set();
const eventAnimations = new Map();
const lastForwardedTap = new Map();
let canvasTouchFallback = null;

function isAvailable() {
  return !failed;
}

function mount({ host, snapshot, onIncidentTap }) {
  if (!(host instanceof HTMLElement) || typeof onIncidentTap !== "function") {
    throw new TypeError("invalid_office_renderer_mount");
  }

  setHost(host);
  incidentTap = onIncidentTap;
  update(snapshot);

  if (failed) {
    markFallback(host);
    return Promise.resolve(false);
  }

  if (application) {
    attachCanvas();
    return Promise.resolve(true);
  }

  if (!initializing) {
    const token = ++generation;
    const pendingInitialization = initialize(token)
      .catch(() => {
        if (token === generation) {
          failed = true;
          markFallback(currentHost);
          document.documentElement.dataset.pixiRenderer = "fallback";
        }
        return false;
      })
      .finally(() => {
        if (initializing === pendingInitialization) initializing = null;
      });
    initializing = pendingInitialization;
  }

  return initializing;
}

function update(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  if (normalized.roundId !== latestSnapshot.roundId) resetRoundFeedback();
  latestSnapshot = normalized;
  processVisualEvents(normalized.visualEvents);
  if (scene) applyStaticSnapshot();
}

function unmount({ destroy } = {}) {
  markFallback(currentHost);
  disconnectObserver();
  currentHost = null;
  incidentTap = null;

  if (!destroy) return;

  generation += 1;
  resetRoundFeedback();
  latestSnapshot = emptySnapshot();
  destroyApplication();
  document.documentElement.dataset.pixiRenderer = "destroyed";
}

async function initialize(token) {
  await pendingAssetRelease;
  if (token !== generation) return false;

  const nextApplication = new Application();
  try {
    await nextApplication.init({
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: false,
      background: "#153c38",
      preference: "webgl",
      powerPreference: "high-performance",
      roundPixels: true
    });

    if (token !== generation) {
      nextApplication.destroy(true, { children: true });
      return false;
    }

    const textures = await loadTextures();
    if (token !== generation) {
      nextApplication.destroy(true, { children: true });
      releaseAssets(Object.values(assetUrls));
      return false;
    }

    application = nextApplication;
    loadedAssetUrls = Object.values(assetUrls);
    scene = createScene(textures);
    application.stage.addChild(scene.root);
    application.ticker.add(tick);
    instanceSequence += 1;
    application.canvas.dataset.pixiOfficeCanvas = "true";
    application.canvas.dataset.pixiInstance = String(instanceSequence);
    application.canvas.setAttribute("aria-hidden", "true");
    installCanvasTouchFallback(application.canvas);
    applyStaticSnapshot();
    attachCanvas();
    document.documentElement.dataset.pixiRenderer = "ready";
    return true;
  } catch (error) {
    if (application === nextApplication) {
      removeCanvasTouchFallback();
      application = null;
    }
    try {
      nextApplication.destroy(true, { children: true });
    } catch {
      // The renderer can fail before Pixi finishes initialization.
    }
    scene = null;
    throw error;
  }
}

async function loadTextures() {
  const urls = { ...assetUrls };
  if (window.__BODY_INC_PIXI_FORCE_ASSET_FAILURE__) {
    urls.background = "./assets/missing-office-background.png";
  }

  const textures = {};
  const loadedUrls = [];
  try {
    for (const [key, url] of Object.entries(urls)) {
      textures[key] = await Assets.load(url);
      loadedUrls.push(url);
      if (textures[key]?.source) textures[key].source.scaleMode = "nearest";
    }
    return textures;
  } catch (error) {
    releaseAssets(loadedUrls);
    throw error;
  }
}

function createScene(textures) {
  const root = new Container();
  const wallLayer = new Container();
  const actorLayer = new Container();
  const propLayer = new Container();
  const feedbackLayer = new Container();
  const hitLayer = new Container();

  const background = new Sprite(textures.background);
  background.width = LOGICAL_WIDTH;
  background.height = LOGICAL_HEIGHT;
  root.addChild(background, wallLayer, actorLayer, propLayer, feedbackLayer, hitLayer);

  const crisisFrame = new Graphics();
  feedbackLayer.addChild(crisisFrame);
  const views = new Map();
  const listeners = [];

  for (const id of stableIds) {
    const config = viewConfig[id];
    const displayLayer = config.layer === "wall" ? wallLayer : config.layer === "actors" ? actorLayer : propLayer;
    const display = new Container();
    const rings = new Graphics();
    const sprite = new Sprite(textureForIncident(id, textures, "idle"));
    sprite.anchor.set(0.5);
    display.addChild(rings, sprite);
    displayLayer.addChild(display);

    const hit = new Graphics();
    const hitWidth = Math.max(44, Math.round(config.width * 1.15));
    const hitHeight = Math.max(44, Math.round(config.width * 1.15));
    hit.rect(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight).fill({ color: 0xffffff, alpha: 0.001 });
    hit.position.set(config.x, config.y);
    hit.hitArea = new Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight);
    hit.eventMode = "none";
    const onPointerTap = (event) => {
      if (event.pointerType === "touch") return;
      forwardIncidentTap(id);
    };
    hit.on("pointertap", onPointerTap);
    hitLayer.addChild(hit);
    listeners.push({ hit, onPointerTap });

    views.set(id, {
      id,
      config,
      display,
      rings,
      sprite,
      hit,
      baseScale: 1,
      baseAlpha: 1,
      textureState: ""
    });
  }

  return { root, crisisFrame, textures, views, listeners };
}

function applyStaticSnapshot() {
  if (!scene) return;
  const incidentMap = new Map(latestSnapshot.incidents.map((incident) => [incident.id, incident]));

  for (const [id, view] of scene.views) {
    const incident = incidentMap.get(id);
    const severity = incident?.severity || 0;
    const ghost = Boolean(incident?.ghost);
    const active = severity > 0;
    const isLegs = id === "legs_slumped";
    const textureState = isLegs ? legsTextureState(active) : "incident";
    const texture = textureForIncident(id, scene.textures, textureState);
    if (view.textureState !== textureState) {
      view.textureState = textureState;
      view.sprite.texture = texture;
    }

    sizeSprite(view.sprite, view.config.width);
    view.baseScale = severityScale(severity);
    view.baseAlpha = ghost ? 0.82 : active || isLegs ? 1 : 0.38;
    view.display.visible = true;
    drawSeverityRings(view.rings, view.config.width, severity, latestSnapshot.selectedIncidentId === id, ghost);

    const interactive = active && !ghost && latestSnapshot.canAct && !latestSnapshot.stamped;
    view.hit.eventMode = interactive ? "static" : "none";
    view.hit.cursor = interactive ? "pointer" : "default";
  }

  drawCrisisFrame();
  tick();
}

function textureForIncident(id, textures, state) {
  if (id !== "legs_slumped") return textures[id];
  if (state === "recover") return textures.legsRecover;
  if (state === "slumped") return textures.legsSlumped;
  return textures.legsIdle;
}

function legsTextureState(active) {
  const now = performance.now();
  const recover = eventAnimations.get("legs_slumped")?.recoverUntil || 0;
  if (recover > now) return "recover";
  return active ? "slumped" : "idle";
}

function sizeSprite(sprite, width) {
  const textureWidth = Math.max(1, sprite.texture.width || 1);
  const textureHeight = Math.max(1, sprite.texture.height || 1);
  sprite.width = Math.round(width);
  sprite.height = Math.round(width * (textureHeight / textureWidth));
}

function severityScale(severity) {
  if (severity >= 3) return 1.12;
  if (severity === 2) return 1;
  if (severity === 1) return 0.9;
  return 0.78;
}

function drawSeverityRings(graphics, width, severity, selected, ghost) {
  graphics.clear();
  if (!severity || ghost) return;
  const color = severity >= 3 ? 0xd94d3c : severity === 2 ? 0xf0bd3f : 0x4c82c9;
  const radius = Math.max(24, width * 0.46);
  for (let index = 0; index < severity; index += 1) {
    graphics.circle(0, 0, radius + index * 5).stroke({ color, width: severity >= 3 ? 4 : 3, alpha: 0.78 - index * 0.12 });
  }
  if (selected) graphics.circle(0, 0, radius + severity * 5 + 3).stroke({ color: 0xfff1a8, width: 3, alpha: 0.95 });
}

function drawCrisisFrame() {
  scene.crisisFrame.clear();
  if (!latestSnapshot.crisis && !latestSnapshot.overtime) return;
  scene.crisisFrame
    .rect(5, 5, LOGICAL_WIDTH - 10, LOGICAL_HEIGHT - 10)
    .stroke({ color: 0xd94d3c, width: latestSnapshot.crisis ? 7 : 4, alpha: latestSnapshot.crisis ? 0.7 : 0.45 });
}

function processVisualEvents(events) {
  const now = Date.now();
  const frameNow = performance.now();
  for (const event of events) {
    const key = `${event.id}|${event.type}|${event.expiresAt}`;
    if (processedEvents.has(key) || event.expiresAt <= now) continue;
    processedEvents.add(key);
    const duration = Math.min(680, Math.max(180, event.expiresAt - now));
    eventAnimations.set(event.id, {
      type: event.type,
      urgent: event.urgent,
      startsAt: frameNow,
      endsAt: frameNow + duration,
      recoverUntil: event.spriteCue === "legs-recover" ? frameNow + duration : 0
    });
  }
}

function tick() {
  if (!scene) return;
  const now = performance.now();
  const persistentIds = new Set(
    latestSnapshot.incidents
      .filter((incident) => !incident.ghost && incident.severity >= 3)
      .slice(0, 3)
      .map((incident) => incident.id)
  );

  for (const [id, view] of scene.views) {
    const animation = eventAnimations.get(id);
    let eventScale = 1;
    let eventAlpha = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (animation && animation.endsAt <= now) {
      eventAnimations.delete(id);
    } else if (animation) {
      const progress = (now - animation.startsAt) / Math.max(1, animation.endsAt - animation.startsAt);
      const wave = Math.sin(progress * Math.PI);
      if (animation.type === "up" || animation.type === "chain-up") {
        eventScale += wave * (animation.urgent ? 0.16 : 0.1);
        if (!latestSnapshot.reducedMotion) offsetX = Math.round(Math.sin(progress * Math.PI * 8) * 4 * wave);
      }
      if (animation.type === "down" || animation.type === "handled") {
        eventScale -= wave * 0.08;
        offsetY = Math.round(wave * 4);
      }
      if (animation.type === "resolve") {
        eventScale -= progress * 0.2;
        eventAlpha = Math.max(0.12, 1 - progress);
        offsetY = -Math.round(progress * 8);
      }
    }

    let persistentScale = 1;
    if (!latestSnapshot.reducedMotion && persistentIds.has(id)) {
      persistentScale += Math.sin(now / 145) * 0.025;
      if (id === "stim_shake" || id === "audit_lamp") offsetX += Math.round(Math.sin(now / 55) * 2);
    }

    const textureState = id === "legs_slumped" ? legsTextureState(hasActiveSnapshotIncident(id)) : "incident";
    if (id === "legs_slumped" && view.textureState !== textureState) {
      view.textureState = textureState;
      view.sprite.texture = textureForIncident(id, scene.textures, textureState);
      sizeSprite(view.sprite, view.config.width);
    }

    view.display.position.set(Math.round(view.config.x + offsetX), Math.round(view.config.y + offsetY));
    view.display.scale.set(view.baseScale * eventScale * persistentScale);
    view.display.alpha = view.baseAlpha * eventAlpha;
  }
}

function forwardIncidentTap(id) {
  if (!stableIds.has(id) || typeof incidentTap !== "function") return false;
  const incident = latestSnapshot.incidents.find((item) => item.id === id);
  if (!incident || incident.ghost || incident.severity <= 0 || !latestSnapshot.canAct || latestSnapshot.stamped) return false;
  const now = performance.now();
  if (now - (lastForwardedTap.get(id) || Number.NEGATIVE_INFINITY) < 250) return false;
  lastForwardedTap.set(id, now);
  incidentTap(id);
  return true;
}

function hasActiveSnapshotIncident(id) {
  return latestSnapshot.incidents.some((incident) => incident.id === id && !incident.ghost && incident.severity > 0);
}

function setHost(host) {
  if (currentHost === host) return;
  markFallback(currentHost);
  currentHost = host;
  currentHost.dataset.rendererState = application ? "ready" : "loading";
  currentHost.dataset.ready = "false";
  currentHost.setAttribute("aria-busy", application ? "false" : "true");
  observeHost();
  if (application) attachCanvas();
}

function attachCanvas() {
  if (!application || !currentHost?.isConnected) return;
  if (application.canvas.parentNode !== currentHost) currentHost.appendChild(application.canvas);
  currentHost.dataset.rendererState = "ready";
  currentHost.dataset.ready = "true";
  currentHost.setAttribute("aria-busy", "false");
  currentHost.closest(".scene")?.classList.add("renderer-ready");
  observeHost();
}

function observeHost() {
  disconnectObserver();
  if (!currentHost || typeof ResizeObserver !== "function") return;
  resizeObserver = new ResizeObserver(() => {
    if (!application?.canvas || !currentHost?.isConnected) return;
    const bounds = currentHost.getBoundingClientRect();
    const scale = Math.min(bounds.width / LOGICAL_WIDTH, bounds.height / LOGICAL_HEIGHT);
    application.canvas.style.width = `${Math.max(1, Math.round(LOGICAL_WIDTH * scale))}px`;
    application.canvas.style.height = `${Math.max(1, Math.round(LOGICAL_HEIGHT * scale))}px`;
  });
  resizeObserver.observe(currentHost);
}

function installCanvasTouchFallback(canvas) {
  removeCanvasTouchFallback();
  const pressedTargets = new Map();
  const pointerKey = (event) => event.pointerId ?? 0;
  const onPointerDown = (event) => {
    if (event.pointerType !== "touch") return;
    const id = incidentIdAtClientPoint(event.clientX, event.clientY);
    if (id) pressedTargets.set(pointerKey(event), id);
  };
  const onPointerUp = (event) => {
    if (event.pointerType !== "touch") return;
    const key = pointerKey(event);
    const pressedId = pressedTargets.get(key);
    pressedTargets.delete(key);
    const releasedId = incidentIdAtClientPoint(event.clientX, event.clientY);
    if (pressedId && pressedId === releasedId) {
      window.setTimeout(() => {
        if (canvasTouchFallback?.canvas === canvas) forwardIncidentTap(pressedId);
      }, 0);
    }
  };
  const onPointerCancel = (event) => pressedTargets.delete(pointerKey(event));
  const events = [
    ["pointerdown", onPointerDown],
    ["pointerup", onPointerUp],
    ["pointercancel", onPointerCancel],
    ["pointerleave", onPointerCancel]
  ];
  events.forEach(([type, listener]) => canvas.addEventListener(type, listener));
  canvasTouchFallback = { canvas, events };
}

function removeCanvasTouchFallback() {
  if (!canvasTouchFallback) return;
  canvasTouchFallback.events.forEach(([type, listener]) => canvasTouchFallback.canvas.removeEventListener(type, listener));
  canvasTouchFallback = null;
}

function incidentIdAtClientPoint(clientX, clientY) {
  if (!application?.canvas || !scene) return "";
  const bounds = application.canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return "";
  const x = ((clientX - bounds.left) / bounds.width) * LOGICAL_WIDTH;
  const y = ((clientY - bounds.top) / bounds.height) * LOGICAL_HEIGHT;
  for (const [id, view] of scene.views) {
    const incident = latestSnapshot.incidents.find((item) => item.id === id);
    if (!incident || incident.ghost || incident.severity <= 0 || !latestSnapshot.canAct || latestSnapshot.stamped) continue;
    const hitWidth = Math.max(44, Math.round(view.config.width * 1.15));
    const hitHeight = Math.max(44, Math.round(view.config.width * 1.15));
    if (
      x >= view.config.x - hitWidth / 2 &&
      x <= view.config.x + hitWidth / 2 &&
      y >= view.config.y - hitHeight / 2 &&
      y <= view.config.y + hitHeight / 2
    ) {
      return id;
    }
  }
  return "";
}

function disconnectObserver() {
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function markFallback(host) {
  if (!host) return;
  host.closest(".scene")?.classList.remove("renderer-ready");
  host.dataset.ready = "false";
  host.dataset.rendererState = "fallback";
  host.setAttribute("aria-busy", "false");
}

function destroyApplication() {
  disconnectObserver();
  removeCanvasTouchFallback();
  if (!application) {
    scene = null;
    return;
  }

  application.ticker.remove(tick);
  application.ticker.stop();
  scene?.listeners.forEach(({ hit, onPointerTap }) => hit.off("pointertap", onPointerTap));
  application.canvas.remove();
  application.destroy(true, { children: true });
  application = null;
  scene = null;

  const urls = loadedAssetUrls;
  loadedAssetUrls = [];
  releaseAssets(urls);
}

function releaseAssets(urls) {
  if (!urls.length) return;
  pendingAssetRelease = Promise.allSettled(urls.map((url) => Assets.unload(url))).then(() => undefined);
}

function resetRoundFeedback() {
  processedEvents.clear();
  eventAnimations.clear();
  lastForwardedTap.clear();
}

function normalizeSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const incidents = Array.isArray(source.incidents)
    ? source.incidents
        .filter((incident) => stableIds.has(incident?.id))
        .map((incident) => ({
          id: incident.id,
          severity: Math.max(0, Math.min(3, Number(incident.severity) || 0)),
          ghost: Boolean(incident.ghost)
        }))
    : [];
  const visualEvents = Array.isArray(source.visualEvents)
    ? source.visualEvents
        .filter((event) => stableIds.has(event?.id) && Number.isFinite(Number(event.expiresAt)))
        .map((event) => ({
          id: event.id,
          type: String(event.type || "handled"),
          urgent: Boolean(event.urgent),
          spriteCue: String(event.spriteCue || ""),
          expiresAt: Number(event.expiresAt)
        }))
    : [];

  return {
    roundId: Number(source.roundId) || 0,
    duration: Number(source.duration) || 90,
    timeLeft: Number(source.timeLeft) || 0,
    overtime: Boolean(source.overtime),
    stamped: Boolean(source.stamped),
    crisis: Boolean(source.crisis),
    canAct: Boolean(source.canAct),
    selectedIncidentId: stableIds.has(source.selectedIncidentId) ? source.selectedIncidentId : "",
    incidents,
    visualEvents,
    kpis: source.kpis && typeof source.kpis === "object" ? { ...source.kpis } : {},
    activeKpis: Array.isArray(source.activeKpis) ? [...source.activeKpis] : [],
    reducedMotion: Boolean(source.reducedMotion)
  };
}

function emptySnapshot() {
  return {
    roundId: 0,
    duration: 90,
    timeLeft: 90,
    overtime: false,
    stamped: false,
    crisis: false,
    canAct: false,
    selectedIncidentId: "",
    incidents: [],
    visualEvents: [],
    kpis: {},
    activeKpis: [],
    reducedMotion: false
  };
}

window.BodyIncOfficeRenderer = Object.freeze({ isAvailable, mount, update, unmount });
