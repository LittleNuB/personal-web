const params = new URLSearchParams(window.location.search);
const bootstrapState = document.documentElement.dataset;

try {
  if (params.get("renderer") === "fail") throw new Error("forced_renderer_failure");
  if (params.get("asset") === "fail") window.__BODY_INC_PIXI_FORCE_ASSET_FAILURE__ = true;
  await import("./pixi-room.js");
  if (!window.BodyIncOfficeRenderer?.isAvailable?.()) throw new Error("renderer_unavailable");
  bootstrapState.pixiBootstrap = "ready";
} catch {
  delete window.BodyIncOfficeRenderer;
  bootstrapState.pixiBootstrap = "fallback";
}

await import("./app.js");
