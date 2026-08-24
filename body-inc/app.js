import { hasForbiddenAiCopy } from "./ai-copy-policy.js";

const app = document.querySelector("#app");
let activeOfficeRenderer = null;
const saveKey = "body-inc-mobile-slice-v2";
const aiRequestBudgetMs = 22000;
const aiEndpoint = "./api/ai-secretary";
const aiEnabled = document.documentElement.dataset.aiSecretary === "enabled";
const strategyIds = ["comfort", "push", "vision", "deflect"];

const targetZone = { min: 40, max: 68 };
const durationOptions = {
  30: { label: "快速会", actionLimit: 2, kpis: ["cash", "morale"], handlings: ["comfort", "push"] },
  60: { label: "标准会", actionLimit: 4, kpis: ["cash", "morale", "growth"], handlings: ["comfort", "push", "vision"] },
  90: { label: "恢复会", actionLimit: 5, kpis: ["cash", "morale", "growth", "bubble"], handlings: ["comfort", "push", "vision", "deflect"] }
};

const kpiMeta = {
  cash: { name: "供氧周转", short: "供氧", low: "供氧赤字", high: "燃料过热" },
  morale: { name: "动员温度", short: "动员", low: "动员塌方", high: "情绪过热" },
  growth: { name: "刺激强度", short: "刺激", low: "刺激不足", high: "刺激过载" },
  bubble: { name: "泡沫指数", short: "泡沫", low: "叙事真空", high: "泡沫审计" }
};

const handlingTypes = {
  comfort: {
    id: "comfort",
    label: "安抚",
    icon: "糖",
    shortHint: "稳士气",
    className: "comfort",
    kpiDelta: { cash: -8, morale: 14, growth: -2, bubble: -2 },
    feedbackOpener: "已安抚",
    visualCue: "soften"
  },
  push: {
    id: "push",
    label: "推进",
    icon: "令",
    shortHint: "拉刺激",
    className: "push",
    kpiDelta: { cash: -8, morale: -4, growth: 14, bubble: 4 },
    feedbackOpener: "已推进",
    visualCue: "push"
  },
  vision: {
    id: "vision",
    label: "愿景",
    icon: "饼",
    shortHint: "抬叙事",
    className: "vision",
    kpiDelta: { cash: -2, morale: 4, growth: 8, bubble: 13 },
    feedbackOpener: "已包装",
    visualCue: "inflate"
  },
  deflect: {
    id: "deflect",
    label: "转移",
    icon: "档",
    shortHint: "降泡沫",
    className: "deflect",
    kpiDelta: { cash: 6, morale: -4, growth: -4, bubble: -12 },
    feedbackOpener: "已转移",
    visualCue: "archive",
    riskSticker: "历史遗留 +1",
    incidentAftermath: [
      { phase: "immediate", incidentId: "file_pile", amount: 1, when: "missing" },
      { phase: "afterKpi", incidentId: "file_pile", amount: 1, when: "fewActiveWithoutSelf", maxCount: 1 }
    ]
  }
};

const incidentOrder = ["legs_slumped", "oxygen_red", "ppt_bubble", "audit_lamp", "stim_shake", "file_pile"];
const incidentCatalog = {
  legs_slumped: {
    id: "legs_slumped",
    owner: "腿部事业群",
    title: "腿部趴桌",
    shortTitle: "腿趴",
    cardTitle: "腿部趴桌",
    icon: "腿",
    line: "楼梯业务申请破产，腿部暂时趴桌。",
    detail: "它还愿意练，只是不想立刻站起来。",
    risk: "下肢怠工",
    severity: { 30: 2, 60: 2, 90: 2 },
    impacts: { comfort: -1, push: -1, vision: 1, deflect: 1 },
    visualCue: { handledSprite: "legs-recover", downSprite: "legs-recover", resolveSprite: "legs-recover" },
    resolvedFlavor: "姿势回正"
  },
  oxygen_red: {
    id: "oxygen_red",
    owner: "心肺财务部",
    title: "供氧账本变红",
    shortTitle: "供氧",
    cardTitle: "供氧账本变红",
    icon: "账",
    line: "供氧账本变红，心肺财务部开始盯人。",
    detail: "预算够复工，但不能乱烧。",
    risk: "供氧透支",
    severity: { 30: 1, 60: 2, 90: 2 },
    impacts: { comfort: -1, push: 1, vision: 1, deflect: -1 },
    visualCue: {},
    resolvedFlavor: "账本压回黑字"
  },
  ppt_bubble: {
    id: "ppt_bubble",
    owner: "大脑战略部",
    title: "PPT 泡泡膨胀",
    shortTitle: "PPT",
    cardTitle: "PPT 泡泡膨胀",
    icon: "饼",
    line: "大脑把“再坐十秒”包装成战略沉淀。",
    detail: "PPT 已经挡住复工门。",
    risk: "战略泡沫",
    severity: { 30: 0, 60: 1, 90: 1 },
    impacts: { comfort: 0, push: -1, vision: 1, deflect: -2 },
    visualCue: { handledCard: "ppt-pop" },
    resolvedFlavor: "泡泡被戳破"
  },
  audit_lamp: {
    id: "audit_lamp",
    owner: "审计组",
    title: "审计红灯闪烁",
    shortTitle: "红灯",
    cardTitle: "审计红灯闪烁",
    icon: "灯",
    line: "审计组怀疑大家在重新定义“刚好”。",
    detail: "它不拦复工，只会贴风险。",
    risk: "审计保留意见",
    severity: { 30: 0, 60: 0, 90: 1 },
    impacts: { comfort: 0, push: 1, vision: 1, deflect: -1 },
    visualCue: { upCard: "audit-flash", downCard: "audit-dim", upSprite: "audit-up", downSprite: "audit-down" },
    resolvedFlavor: "红灯变暗"
  },
  stim_shake: {
    id: "stim_shake",
    owner: "刺激仪表",
    title: "刺激仪表抖动",
    shortTitle: "刺激",
    cardTitle: "刺激仪表抖动",
    icon: "针",
    line: "刺激仪表开始抖，热身和报修很难分。",
    detail: "推进派说这是好事。",
    risk: "刺激过载",
    severity: { 30: 0, 60: 0, 90: 0 },
    impacts: { comfort: -1, push: 1, vision: 1, deflect: 0 },
    visualCue: {},
    resolvedFlavor: "仪表暂稳"
  },
  file_pile: {
    id: "file_pile",
    owner: "档案柜",
    title: "历史文件堆高",
    shortTitle: "历史",
    cardTitle: "历史文件堆高",
    icon: "档",
    line: "档案柜长出新文件，标签写着“以后再说”。",
    detail: "转移会降温，也会留账。",
    risk: "历史遗留",
    severity: { 30: 0, 60: 0, 90: 0 },
    impacts: { comfort: -1, push: 1, vision: 1, deflect: 1 },
    visualCue: { upCard: "file-grow" },
    resolvedFlavor: "文件暂时归档"
  }
};

const visualCueClasses = {
  "ppt-pop": "fx-ppt-pop",
  "audit-flash": "fx-audit-flash",
  "audit-dim": "fx-audit-dim",
  "file-grow": "fx-file-grow"
};

const spriteCueClasses = {
  "legs-recover": "fx-legs-recover",
  "audit-up": "fx-audit-up",
  "audit-down": "fx-audit-down"
};

const kpiIncidentRules = [
  { kpi: "morale", direction: "low", threshold: 34, incidentId: "legs_slumped" },
  { kpi: "cash", direction: "low", threshold: 34, incidentId: "oxygen_red" },
  { kpi: "growth", direction: "high", threshold: 76, incidentId: "stim_shake" },
  { kpi: "bubble", direction: "high", threshold: 72, incidentId: "ppt_bubble" },
  { anyActiveDanger: true, incidentId: "audit_lamp" }
];

const initialArchive = loadArchive();
const state = {
  phase: "home",
  duration: 90,
  timeLeft: 90,
  elapsed: 0,
  actionIndex: 0,
  selectedIncidentId: "legs_slumped",
  modalIncidentId: "",
  nextIncidentAt: 18,
  kpis: initialKpis(90),
  incidents: seedIncidents(90),
  risks: [],
  history: [],
  lastEventTitle: "",
  lastReaction: "",
  visualEvents: [],
  feedbackTimer: null,
  pendingHandlingTimer: null,
  pendingHandlingToken: null,
  stamped: false,
  report: null,
  archive: initialArchive,
  roundContent: localRoundContent(90),
  agent: {
    status: hasPreparedPack(initialArchive, 90) ? "ready" : "idle",
    error: "",
    requestSequence: 0,
    activeRequestToken: null,
    requestDuration: 0,
    targetReportId: "",
    controller: null
  },
  timer: null,
  roundId: 0
};

render();
window.setTimeout(() => ensureRoundContentPrepared(), 0);

function render() {
  app.innerHTML = `<section class="phone"><div class="screen">${renderPhase()}</div></section>`;
  bindActions();
  syncOfficeRenderer();
}

function renderPhase() {
  if (state.phase === "home") return renderHome();
  if (state.phase === "game") return renderGame();
  if (state.phase === "report") return renderReport();
  return renderArchive();
}

function renderHome() {
  const archive = state.archive;
  const preparedPack = preparedPackForDuration(state.duration);
  const homeAgent = homeAgentView(preparedPack);
  return `
    <section class="hero">
      <div>
        <p class="micro">Body Inc.</p>
        <h1 class="hero-title">下一组<br />再议</h1>
        <p class="hint">手机竖屏体验切片。先让腿部事业群试营业，看看休息时间能不能变成办公室救火。</p>
      </div>

      <div class="home-card">
        <div class="duty-card">
          ${renderSprite("legs")}
          <div>
            <p class="micro">今日值班部门</p>
            <h2 class="dept-title">腿部事业群</h2>
            <p class="hint">建议 ${recommendedDurationText()}，理由是楼梯业务仍在诉讼。</p>
          </div>
        </div>
        <div class="agent-card ${homeAgent.className}">
          <div class="agent-card-head">
            <span class="agent-status">${homeAgent.label}</span>
            <span class="micro">部门记忆 Agent</span>
          </div>
          <strong>${escapeHtml(homeAgent.title)}</strong>
          <p>${escapeHtml(homeAgent.message)}</p>
          ${homeAgent.canRetry ? '<button class="agent-retry" data-action="retry-ai">重试 AI</button>' : ""}
        </div>
        <div>
          <p class="micro">本轮休息时间</p>
          <div class="duration-row">
            ${Object.entries(durationOptions)
              .map(([seconds, config]) => {
                const active = Number(seconds) === state.duration ? "active" : "";
                return `<button class="duration-btn ${active}" data-action="duration" data-duration="${seconds}">
                  ${seconds} 秒<span>${config.label}</span>
                </button>`;
              })
              .join("")}
          </div>
        </div>
        <button class="primary" data-action="start">开始 ${state.duration} 秒小会</button>
        <button class="secondary" data-action="archive">档案墙</button>
      </div>

      <div class="topline">
        <span class="small">累计营业 ${archive.operatingDays.length} 日</span>
        <span class="small">小会 ${archive.meetingCount} 次</span>
      </div>
    </section>
  `;
}

function renderGame() {
  const config = durationOptions[state.duration];
  const activeKpis = config.kpis;
  const active = activeIncidents();
  if (!state.stamped) ensureSelectedIncident(active);
  const primaryIncident = active.find((incident) => incident.id === state.selectedIncidentId) || active[0];
  const primaryMeta = primaryIncident ? incidentDisplayMeta(primaryIncident.id) : null;
  const modalIncident = state.modalIncidentId ? getIncident(state.modalIncidentId) : null;
  const canShowModal = modalIncident && modalIncident.severity > 0;
  const overtime = state.timeLeft < 0;
  const canAct = state.actionIndex < config.actionLimit;
  const actionText = `行动 ${state.actionIndex} / ${config.actionLimit}`;
  const pressureLeft = Math.max(0, state.nextIncidentAt - state.elapsed);
  const urgency = primaryIncident && primaryMeta ? `${primaryMeta.title}${"!".repeat(primaryIncident.severity)}` : "暂无事故";
  const pressureText = pressureLeft > 0 ? `${pressureLeft}s 后升级` : "即将升级";
  const hasHandlingFeedback = Boolean(state.lastEventTitle || state.lastReaction);
  const speechTitle = state.lastEventTitle || (state.roundContent.briefing ? "部门开场" : primaryMeta ? `最急：${primaryMeta.title}` : "办公室暂时安静");
  const speechHint = state.lastReaction || state.roundContent.briefing || primaryMeta?.line || "点事故牌，选一个处理方式。";

  return `
    <section class="game">
      <div class="hud">
        <div class="hud-title">
          <strong>腿部事业群</strong>
          <div class="hint">${overtime ? "会议加班中" : "90 秒恢复会主测"}</div>
        </div>
        <div class="timer ${overtime ? "overtime" : ""}">${formatTimer(state.timeLeft)}</div>
        <div class="status-pills">
          <span>${actionText}</span>
          <span class="${pressureLeft <= 6 && canAct ? "hot-pill" : ""}">${canAct ? pressureText : "行动用完"}</span>
          <span class="urgent-pill">最急 ${escapeHtml(urgency)}</span>
        </div>
      </div>

      <div class="scene ${overtime ? "overtime" : ""} ${state.stamped ? "stamped" : ""} ${hasCrisis() ? "crisis" : ""}">
        <div class="pixi-office-host" data-office-renderer-host data-ready="false" role="img" aria-label="腿部事业群办公室事故现场"></div>
        <div class="dom-office-visuals">
          <div class="wall-title">${overtime ? "会议加班" : "办公室正在出事"}</div>
          <div class="meeting-table"><div class="paper"><div class="stamp-mark">办</div></div></div>
          ${renderSprite("legs", [hasActiveIncident("legs_slumped") ? "slumped" : "", spriteFeedbackClass("legs")].filter(Boolean).join(" "))}
          ${renderSprite("heart", hasActiveIncident("oxygen_red") ? "red" : "")}
          ${state.duration >= 60 ? renderSprite("brain", hasActiveIncident("ppt_bubble") ? "bubble" : "") : ""}
          ${state.duration >= 90 || hasActiveIncident("audit_lamp") || state.risks.length ? renderSprite("audit", [hasActiveIncident("audit_lamp") ? "alarm" : "", spriteFeedbackClass("audit")].filter(Boolean).join(" ")) : ""}
        </div>
        ${renderIncidents(canAct && !state.stamped, state.selectedIncidentId)}
        <div class="speech">
          <span class="micro">${hasHandlingFeedback ? "处理反馈" : agentSourceLabel(state.roundContent.source)}</span>
          <strong>${escapeHtml(speechTitle)}</strong>
          <div class="hint">${escapeHtml(speechHint)}</div>
        </div>
        <div class="device-row">
          ${Object.entries(kpiMeta)
            .map(([key, meta]) => renderDevice(key, meta, activeKpis.includes(key)))
            .join("")}
        </div>
      </div>

      <div class="round-actions">
        <div class="settle-row">
          <button class="primary" data-action="settle">复工结算</button>
          <button class="secondary" data-action="home">先不开了</button>
        </div>
      </div>
      ${canShowModal ? renderIncidentModal(modalIncident, config.handlings, !canAct || state.stamped) : ""}
    </section>
  `;
}

function renderReport() {
  const report = state.report;
  const reportAgent = reportAgentView(report);
  const handledText = `${report.handledCount ?? 0} 件 / 清 ${report.resolvedCount ?? 0}`;
  const remainingText = buildRemainingText(report);
  const timingText = reportTimingText(report);
  const riskText = `${report.topRisk || "无新增贴纸"} · ${report.riskCount ?? report.risks.length} 枚`;
  const highlight = report.highlight || report.event || "秘书还没写本轮得意。";
  const regret = report.regret || "旧财报没有遗憾栏，档案柜拒绝补签。";
  const nextTip = report.nextTip || report.nextPreview || "下轮先盯最大牌，再决定要糖水、口号还是档案柜。";
  return `
    <section class="report">
      <div class="report-card result-card">
        <div class="report-head">
          <p class="micro">今日肉身财报</p>
          <span class="result-stamp">${report.rating}</span>
        </div>
        <h1>${report.title}</h1>
        <div class="result-grid">
          <div class="result-tile"><span>复工评级</span><strong>${report.rating}</strong></div>
          <div class="result-tile"><span>复工节奏</span><strong>${timingText}</strong></div>
          <div class="result-tile"><span>处理事故</span><strong>${handledText}</strong></div>
          <div class="result-tile"><span>遗留麻烦</span><strong>${remainingText}</strong></div>
          <div class="result-tile risk"><span>最大贴纸</span><strong>${riskText}</strong></div>
          <div class="result-tile culture"><span>公司文化</span><strong>${report.culture}</strong></div>
        </div>
        <div class="report-line compact">
          <strong>风险贴纸</strong>
          <div class="chip-row">${report.risks.length ? report.risks.map((risk) => `<span class="chip">${risk}</span>`).join("") : '<span class="hint">暂无新增贴纸，审计组今天收工很早。</span>'}</div>
        </div>
        <div class="report-line compact">
          <strong>本轮做得好</strong>
          <span>${highlight}</span>
        </div>
        <div class="report-line compact">
          <strong>本轮遗憾</strong>
          <span>${regret}</span>
        </div>
        <div class="report-line compact agent-review ${reportAgent.className}">
          <div class="agent-card-head">
            <strong>部门复盘</strong>
            <span class="agent-status">${reportAgent.label}</span>
          </div>
          <span>${escapeHtml(report.reportComment || buildLocalReportComment(report))}</span>
          ${reportAgent.canRetry ? '<button class="agent-retry" data-action="retry-ai">重试 AI</button>' : ""}
        </div>
        <div class="report-line compact next-preview">
          <strong>下轮打法</strong>
          <span>${nextTip}</span>
        </div>
      </div>
      <div class="report-actions">
        <button class="primary" data-action="start">再开一轮</button>
        <div class="secondary-row">
          <button class="secondary" data-action="home">收好财报</button>
          <button class="secondary" data-action="archive">去档案墙</button>
        </div>
      </div>
    </section>
  `;
}

function renderArchive() {
  const archive = state.archive;
  const latest = archive.reports[0];
  const recentReports = archive.reports.slice(0, 3);
  const latestMemory = archive.memoryFacts[0];
  const latestComment = latest?.reportComment || "部门还没有形成稳定态度，先让它经历一轮事故。";
  return `
    <section class="archive">
      <div class="archive-card">
        <div class="archive-head">
          <div>
            <p class="micro">肉身集团</p>
            <h1>档案墙</h1>
          </div>
          <span class="result-stamp muted">${archive.culture || "试营业"}</span>
        </div>
        <div class="archive-grid">
          <div class="archive-stat"><span class="micro">公司文化</span><strong>${archive.culture || "试营业中"}</strong></div>
          <div class="archive-stat"><span class="micro">累计营业日</span><strong>${archive.operatingDays.length}</strong></div>
          <div class="archive-stat"><span class="micro">小会数</span><strong>${archive.meetingCount}</strong></div>
          <div class="archive-stat"><span class="micro">会议时间</span><strong>${formatDuration(archive.totalMeetingSeconds)}</strong></div>
        </div>
        <div class="report-line">
          <strong>最近财报</strong>
          ${recentReports.length ? `<div class="archive-report-list">${recentReports.map(renderArchiveReport).join("")}</div>` : '<div class="empty">暂无财报。先让腿部事业群开一次会。</div>'}
        </div>
        <div class="report-line">
          <strong>称号收藏</strong>
          <div class="chip-row">${archive.titles.length ? archive.titles.map((title) => `<span class="chip">${title}</span>`).join("") : '<span class="hint">还没有称号。财报秘书正在磨章。</span>'}</div>
        </div>
        <div class="report-line">
          <strong>下轮白板</strong>
          <span>${latest?.nextPreview || "白板干净得很可疑，背部基建部在门口探头。"}</span>
        </div>
        <div class="report-line agent-memory">
          <div class="agent-card-head">
            <strong>Agent 记忆</strong>
            <span class="agent-status">${agentSourceLabel(latest?.agentSource)}</span>
          </div>
          <span>${escapeHtml(latestMemory?.label || "暂时没有可收录的策略习惯。")}</span>
          <em>${escapeHtml(latestComment)}</em>
        </div>
        <div class="report-line">
          <strong>轮值表</strong>
          <span>腿部事业群 -> 背部基建部 -> 胸部事业部。休息日记为集团停机维护。</span>
        </div>
      </div>
      <button class="primary" data-action="start">再开一轮</button>
      <button class="secondary" data-action="home">收好档案</button>
    </section>
  `;
}

function renderArchiveReport(report) {
  const timingText = reportTimingText(report);
  const remainingText = buildRemainingText(report);
  return `
    <div class="archive-report">
      <strong>${escapeHtml(report.title)}</strong>
      <span>${report.date || "本地记录"} · ${report.rating || "未评级"} · ${timingText}</span>
      <em>${report.culture || "试营业观察型"} · 遗留 ${remainingText}</em>
    </div>
  `;
}

function renderDevice(key, meta, active) {
  const value = state.kpis[key];
  const status = !active ? "hidden" : dangerType(value) ? "danger" : value < targetZone.min || value > targetZone.max ? "warn" : "";
  return `
    <div class="device ${status}">
      <div class="device-name">${meta.short}</div>
      <div class="gauge"><span class="needle" style="left:${value}%"></span></div>
    </div>
  `;
}

function renderIncidentModal(incident, handlings, disabled) {
  const meta = incidentDisplayMeta(incident.id);
  return `
    <div class="modal-scrim" data-action="close-modal">
      <section class="incident-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(meta.title)}" data-stop-propagation="true">
        <div class="modal-head">
          <span class="micro">${escapeHtml(meta.owner)}</span>
          <button class="modal-close" data-action="close-modal" aria-label="关闭">×</button>
          <h2><b>${meta.icon}</b>${escapeHtml(meta.title)}</h2>
          <em>${"!".repeat(incident.severity)}</em>
        </div>
        <p class="modal-line">${escapeHtml(meta.line)}</p>
        <p class="modal-detail">${escapeHtml(meta.detail)}</p>
        <div class="modal-actions ${handlings.length === 3 ? "three" : handlings.length === 4 ? "four" : ""}">
          ${handlings.map((handlingId) => renderModalAction(handlingId, incident.id, disabled)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderModalAction(handlingId, targetId, disabled) {
  const meta = handlingTypes[handlingId];
  return `
    <button class="modal-action ${meta.className}" data-action="modal-handling" data-handling="${handlingId}" ${disabled ? "disabled" : ""}>
      <b>${meta.icon}</b>
      <span>${meta.label}</span>
      <small>${previewImpact(handlingId, targetId)}</small>
    </button>
  `;
}

function renderIncidents(enabled, selectedId) {
  const active = incidentsForScene();
  if (!active.length) {
    return `<div class="incident-marker incident-clear"><b>稳</b><span>窗口已稳</span><em>OK</em></div>`;
  }
  return active
    .map((incident) => {
      const meta = incidentDisplayMeta(incident.id);
      const selected = !incident.ghost && incident.id === selectedId ? "hot" : "";
      const feedback = incidentFeedbackClass(incident.id);
      const ghost = incident.ghost ? "ghost" : "";
      return `
        <button class="incident-marker incident-${incident.id} severity-${incident.severity} ${selected} ${feedback} ${ghost}" data-action="incident" data-incident="${incident.id}" ${enabled && !incident.ghost ? "" : "disabled"} aria-pressed="${selected ? "true" : "false"}">
          <b>${meta.icon}</b>
          <span>${escapeHtml(meta.cardTitle || meta.title)}</span>
          <em>${"!".repeat(incident.severity)}</em>
        </button>
      `;
    })
    .join("");
}

function renderSprite(type, extraClass = "") {
  const bodyClass = `pixel-${type === "legs" ? "leg" : type}`;
  return `
    <div class="sprite ${type} ${extraClass}">
      <div class="${bodyClass}">
        <span class="eye left"></span>
        <span class="eye right"></span>
        <span class="mouth"></span>
        <span class="badge"></span>
      </div>
    </div>
  `;
}

function bindActions() {
  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.action;
      if (action === "duration") setDuration(Number(element.dataset.duration));
      if (action === "start") startGame();
      if (action === "incident") handleIncidentTap(element.dataset.incident);
      if (action === "modal-handling") useModalHandling(element.dataset.handling);
      if (action === "close-modal") closeModal();
      if (action === "settle") settleRound();
      if (action === "archive") setPhase("archive");
      if (action === "home") setPhase("home");
      if (action === "retry-ai") retryAgentRequest();
    });
  });
  document.querySelectorAll("[data-stop-propagation]").forEach((element) => {
    element.addEventListener("click", (event) => event.stopPropagation());
  });
}

function syncOfficeRenderer() {
  const renderer = window.BodyIncOfficeRenderer;
  let available = false;
  try {
    available = Boolean(renderer?.isAvailable?.());
  } catch {
    available = false;
  }

  if (state.phase !== "game" || !available) {
    teardownOfficeRenderer();
    return;
  }

  const host = document.querySelector("[data-office-renderer-host]");
  if (!host) {
    teardownOfficeRenderer();
    return;
  }

  if (activeOfficeRenderer && activeOfficeRenderer !== renderer) teardownOfficeRenderer();

  const snapshot = buildOfficeRendererSnapshot();
  try {
    activeOfficeRenderer = renderer;
    const mountResult = renderer.mount({
      host,
      snapshot,
      onIncidentTap: handleIncidentTap
    });
    renderer.update(snapshot);
    if (mountResult?.catch) mountResult.catch(() => {});
  } catch {
    teardownOfficeRenderer();
  }
}

function teardownOfficeRenderer() {
  if (!activeOfficeRenderer) return;
  try {
    activeOfficeRenderer.unmount({ destroy: true });
  } catch {
    // The DOM office is already present as the fallback.
  }
  activeOfficeRenderer = null;
}

function buildOfficeRendererSnapshot() {
  const config = durationOptions[state.duration];
  const incidents = incidentsForScene().map((incident) =>
    Object.freeze({
      id: incident.id,
      severity: incident.severity,
      ghost: Boolean(incident.ghost)
    })
  );
  const visualEvents = currentVisualEvents().map((event) =>
    Object.freeze({
      id: event.id,
      type: event.type,
      prev: event.prev,
      next: event.next,
      urgent: Boolean(event.urgent),
      visualCue: event.visualCue || "",
      spriteCue: event.spriteCue || "",
      expiresAt: event.expiresAt
    })
  );

  return Object.freeze({
    roundId: state.roundId,
    duration: state.duration,
    timeLeft: state.timeLeft,
    overtime: state.timeLeft < 0,
    stamped: state.stamped,
    crisis: hasCrisis(),
    canAct: !state.stamped && state.actionIndex < config.actionLimit,
    selectedIncidentId: state.selectedIncidentId,
    incidents: Object.freeze(incidents),
    visualEvents: Object.freeze(visualEvents),
    kpis: Object.freeze({ ...state.kpis }),
    activeKpis: Object.freeze([...config.kpis]),
    reducedMotion: Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  });
}

function setPhase(phase) {
  stopTimer();
  clearPendingHandling();
  state.phase = phase;
  render();
  if (phase === "home") ensureRoundContentPrepared();
}

function setDuration(duration) {
  state.duration = duration;
  render();
  ensureRoundContentPrepared();
}

function startGame() {
  clearFeedback();
  clearPendingHandling();
  stopTimer();
  state.roundContent = promotePreparedPack(state.duration) || localRoundContent(state.duration);
  state.roundId += 1;
  state.phase = "game";
  state.timeLeft = state.duration;
  state.elapsed = 0;
  state.actionIndex = 0;
  state.nextIncidentAt = nextEscalationInterval();
  state.kpis = initialKpis(state.duration);
  state.incidents = seedIncidents(state.duration);
  state.selectedIncidentId = pickUrgentIncidentId();
  state.modalIncidentId = "";
  state.risks = [];
  state.history = [];
  state.lastEventTitle = "";
  state.lastReaction = "";
  state.visualEvents = [];
  state.stamped = false;
  state.report = null;
  startTimer();
  render();
}

function startTimer() {
  state.timer = window.setInterval(() => {
    state.timeLeft -= 1;
    state.elapsed += 1;
    if (!state.stamped && state.elapsed >= state.nextIncidentAt) {
      escalatePressure();
      state.nextIncidentAt += nextEscalationInterval();
    }
    render();
  }, 1000);
}

function stopTimer() {
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
}

function handleIncidentTap(incidentId) {
  if (state.phase !== "game" || !Object.prototype.hasOwnProperty.call(incidentCatalog, incidentId)) return;
  const config = durationOptions[state.duration];
  const target = getIncident(incidentId);
  if (!target || target.severity <= 0 || state.stamped) return;
  if (state.actionIndex >= config.actionLimit) return;
  state.selectedIncidentId = incidentId;
  state.modalIncidentId = incidentId;
  state.lastEventTitle = "";
  state.lastReaction = "";
  render();
}

function closeModal() {
  state.modalIncidentId = "";
  render();
}

function useModalHandling(handlingId) {
  const incidentId = state.modalIncidentId;
  if (!incidentId) return;
  state.modalIncidentId = "";
  useHandling(handlingId, incidentId);
}

function useHandling(handlingId, incidentId) {
  const config = durationOptions[state.duration];
  if (state.stamped) return;
  if (state.actionIndex >= config.actionLimit) return;
  if (!config.handlings.includes(handlingId)) return;
  const target = getIncident(incidentId);
  if (!target || target.severity <= 0) return;

  const outcome = resolveHandlingOutcome(handlingId, incidentId);
  queueIncidentFeedback(outcome.changes, { source: "handling", handlingId, targetId: incidentId });
  state.risks.push(...outcome.risks);

  state.lastEventTitle = outcome.eventTitle;
  state.lastReaction = outcome.reaction;
  state.history.push({
    action: state.actionIndex + 1,
    handling: handlingId,
    target: incidentId,
    eventTitle: buildHandlingTitle(handlingId, incidentId, false),
    reaction: buildReaction(handlingId, incidentId, outcome.changes, outcome.risks, false),
    risks: outcome.risks,
    resolvedIncidentIds: resolvedIncidentIdsFromChanges(outcome.changes),
    incidents: activeIncidents().map((incident) => `${incidentCatalog[incident.id].title}${incident.severity}`)
  });

  state.stamped = true;
  state.nextIncidentAt = Math.max(state.nextIncidentAt, state.elapsed + Math.ceil(nextEscalationInterval() * 0.55));
  const handlingToken = {
    roundId: state.roundId,
    actionIndex: state.actionIndex,
    handlingId,
    incidentId
  };
  state.pendingHandlingToken = handlingToken;
  state.pendingHandlingTimer = window.setTimeout(() => {
    if (
      state.pendingHandlingToken !== handlingToken ||
      state.roundId !== handlingToken.roundId ||
      state.phase !== "game" ||
      state.actionIndex !== handlingToken.actionIndex ||
      !state.stamped
    ) {
      if (state.pendingHandlingToken === handlingToken) {
        state.pendingHandlingToken = null;
        state.pendingHandlingTimer = null;
      }
      return;
    }
    state.pendingHandlingToken = null;
    state.pendingHandlingTimer = null;
    state.stamped = false;
    state.actionIndex += 1;
    state.selectedIncidentId = pickUrgentIncidentId();
    state.modalIncidentId = "";
    if (state.phase === "game") render();
  }, 1050);
  render();
}

function resolveHandlingOutcome(handlingId, incidentId) {
  applyKpiDelta(handlingId);
  const changes = applyHandlingToIncidents(handlingId, incidentId);
  changes.push(...generateIncidentsFromKpis(handlingId));
  const risks = collectRisks(handlingId);
  return {
    changes,
    risks,
    eventTitle: buildHandlingTitle(handlingId, incidentId),
    reaction: buildReaction(handlingId, incidentId, changes, risks)
  };
}

function applyKpiDelta(handlingId) {
  Object.entries(handlingTypes[handlingId].kpiDelta).forEach(([key, delta]) => {
    state.kpis[key] = clamp(state.kpis[key] + delta, 0, 100);
  });
}

function settleRound() {
  stopTimer();
  clearPendingHandling();
  const config = durationOptions[state.duration];
  const overtime = Math.max(0, -state.timeLeft);
  const remainingIncidents = activeIncidents();
  const risks = [...new Set(state.risks)];
  const meetingSeconds = state.elapsed;
  const metrics = buildResultMetrics({ config, remainingIncidents, risks, overtime, meetingSeconds });
  const timingLabel = buildTimingLabel(overtime, state.timeLeft);
  const topRisk = buildTopRisk(risks, remainingIncidents);

  const rating = buildRating(metrics);
  const culture = buildCulture(metrics);
  const title = buildTitle(rating, culture, topRisk, metrics);
  const event = buildEvent();
  const highlight = buildRoundHighlight(metrics);
  const regret = buildRegret(metrics);
  const nextTip = buildNextTip(metrics);
  const nextPreview = buildNextPreview({ rating, culture, topRisk, metrics });
  const report = {
    reportId: createReportId(),
    date: todayKey(),
    title,
    rating,
    culture,
    duration: state.duration,
    overtime,
    earlyTime: metrics.earlyTime,
    timingLabel,
    meetingSeconds,
    handledCount: metrics.handledCount,
    resolvedCount: metrics.resolvedCount,
    remainingCount: metrics.remainingCount,
    remainingSeverity: metrics.remainingSeverity,
    unresolved: metrics.remainingSeverity,
    maxIncidentSeverity: metrics.maxIncidentSeverity,
    kpiReadyCount: metrics.kpiReadyCount,
    kpiTotal: metrics.kpiTotal,
    riskCount: metrics.riskCount,
    primaryFailure: metrics.primaryFailure.id,
    primaryFailureLabel: metrics.primaryFailure.label,
    topRisk,
    risks,
    event,
    highlight,
    regret,
    nextTip,
    nextPreview,
    history: state.history.map(({ handling, target, eventTitle }) => ({ handling, target, eventTitle })),
    reportComment: "",
    agentSource: "preparing"
  };
  report.reportComment = buildLocalReportComment(report);

  state.report = report;
  saveReport(report);
  state.phase = "report";
  render();
  prepareRoundContent({ report });
}

function seedIncidents(duration) {
  return incidentOrder
    .map((id) => ({ id, severity: initialIncidentSeverity(id, duration) }))
    .filter((incident) => incident.severity > 0);
}

function initialIncidentSeverity(id, duration) {
  const severity = incidentCatalog[id]?.severity || 0;
  if (typeof severity === "number") return severity;
  return severity[duration] ?? severity.default ?? 0;
}

function activeIncidents() {
  return state.incidents
    .filter((incident) => incident.severity > 0)
    .sort((a, b) => b.severity - a.severity || incidentOrder.indexOf(a.id) - incidentOrder.indexOf(b.id));
}

function incidentsForScene() {
  const active = activeIncidents();
  const seen = new Set(active.map((incident) => incident.id));
  const ghosts = currentVisualEvents()
    .filter((event) => event.type === "resolve" && !seen.has(event.id))
    .map((event) => ({ id: event.id, severity: event.prev || 1, ghost: true }));
  return [...active, ...ghosts].sort((a, b) => b.severity - a.severity || incidentOrder.indexOf(a.id) - incidentOrder.indexOf(b.id));
}

function queueIncidentFeedback(changes, context = {}) {
  const now = Date.now();
  const merged = mergeChanges(changes).filter((change) => change.prev !== change.next);
  const events = [];

  merged.forEach((change) => {
    const isTarget = change.id === context.targetId || change.target;
    let type = "handled";
    if (change.next > change.prev) type = context.source === "escalation" || isTarget ? "up" : "chain-up";
    if (change.next < change.prev) type = change.next === 0 ? "resolve" : "down";
    const cues = visualCuesForChange(change, type, isTarget, context);
    events.push({
      id: change.id,
      type,
      prev: change.prev,
      next: change.next,
      urgent: change.next >= 3 || (context.source === "escalation" && change.next > change.prev),
      ...cues,
      expiresAt: now + (change.next === 0 ? 680 : 620)
    });
  });

  if (context.source === "handling" && context.targetId && !events.some((event) => event.id === context.targetId)) {
    const target = getIncident(context.targetId);
    const cues = visualCuesForHandled(context.targetId);
    events.push({
      id: context.targetId,
      type: "handled",
      prev: target?.severity || 1,
      next: target?.severity || 1,
      urgent: false,
      ...cues,
      expiresAt: now + 520
    });
  }

  if (!events.length) return;
  state.visualEvents = [...currentVisualEvents(), ...events];
  if (state.feedbackTimer) window.clearTimeout(state.feedbackTimer);
  const delay = Math.max(...events.map((event) => event.expiresAt - now)) + 40;
  state.feedbackTimer = window.setTimeout(() => {
    state.visualEvents = currentVisualEvents();
    state.feedbackTimer = null;
    if (state.phase === "game") render();
  }, delay);
}

function incidentFeedbackClass(id) {
  const events = currentVisualEvents().filter((event) => event.id === id);
  const classes = new Set();
  events.forEach((event) => {
    if (event.type === "up") classes.add(event.urgent ? "fx-up-urgent" : "fx-up");
    if (event.type === "chain-up") classes.add("fx-chain-up");
    if (event.type === "down") classes.add("fx-down");
    if (event.type === "resolve") classes.add("fx-resolve");
    if (event.type === "handled") classes.add("fx-handled");
    if (event.visualCue && visualCueClasses[event.visualCue]) classes.add(visualCueClasses[event.visualCue]);
  });
  return [...classes].join(" ");
}

function spriteFeedbackClass(type) {
  return currentVisualEvents()
    .map((event) => spriteCueClasses[event.spriteCue])
    .filter(Boolean)
    .filter((className) => className.includes(type === "legs" ? "legs" : type))
    .join(" ");
}

function visualCuesForChange(change, type, isTarget, context) {
  const cues = incidentCatalog[change.id]?.visualCue || {};
  const result = {};
  if (change.next > change.prev) {
    result.visualCue = cues.upCard;
    result.spriteCue = cues.upSprite;
  }
  if (change.next < change.prev) {
    result.visualCue = change.next === 0 ? cues.resolveCard || cues.downCard : cues.downCard;
    result.spriteCue = change.next === 0 ? cues.resolveSprite || cues.downSprite : cues.downSprite;
  }
  if (context.source === "handling" && isTarget) {
    result.visualCue = cues.handledCard || result.visualCue;
    result.spriteCue = cues.handledSprite || result.spriteCue;
  }
  return result;
}

function visualCuesForHandled(incidentId) {
  const cues = incidentCatalog[incidentId]?.visualCue || {};
  return {
    visualCue: cues.handledCard,
    spriteCue: cues.handledSprite
  };
}

function currentVisualEvents() {
  const now = Date.now();
  state.visualEvents = state.visualEvents.filter((event) => event.expiresAt > now);
  return state.visualEvents;
}

function clearFeedback() {
  state.visualEvents = [];
  if (state.feedbackTimer) window.clearTimeout(state.feedbackTimer);
  state.feedbackTimer = null;
}

function clearPendingHandling() {
  if (state.pendingHandlingTimer) window.clearTimeout(state.pendingHandlingTimer);
  state.pendingHandlingTimer = null;
  state.pendingHandlingToken = null;
}

function ensureSelectedIncident(active = activeIncidents()) {
  if (active.some((incident) => incident.id === state.selectedIncidentId)) return;
  state.selectedIncidentId = active[0]?.id || "";
}

function pickUrgentIncidentId() {
  return activeIncidents()[0]?.id || "";
}

function nextEscalationInterval() {
  if (state.duration === 30) return 10;
  if (state.duration === 60) return 14;
  return 18;
}

function escalatePressure() {
  const active = activeIncidents();
  const target = active.find((incident) => incident.severity < 3) || active[0];
  const change = target ? growIncident(target.id, 1) : growIncident("legs_slumped", 1);
  if (!change) return;
  queueIncidentFeedback([change], { source: "escalation" });

  const ruleMeta = incidentCatalog[change.id];
  const displayMeta = incidentDisplayMeta(change.id);
  state.selectedIncidentId = change.id;
  if (state.modalIncidentId && !hasActiveIncident(state.modalIncidentId)) state.modalIncidentId = "";
  state.lastEventTitle = `事故升级：${displayMeta.title}`;
  state.lastReaction = change.next >= 3 ? `升到 ${change.next} 级，贴纸：${ruleMeta.risk} +1。` : `升到 ${change.next} 级，先处理它。`;
  if (change.next >= 3) state.risks.push(`${ruleMeta.risk} +1`);
}

function getIncident(id) {
  return state.incidents.find((incident) => incident.id === id);
}

function hasActiveIncident(id) {
  return Boolean(getIncident(id)?.severity);
}

function hasCrisis() {
  return activeIncidents().some((incident) => incident.severity >= 3) || state.risks.length >= 3;
}

function applyHandlingToIncidents(handlingId, targetId) {
  const changes = [];
  const target = getIncident(targetId);
  if (!target || target.severity <= 0) return changes;

  const targetDelta = incidentImpact(target.id, handlingId);
  const targetPrev = target.severity;
  target.severity = clamp(target.severity + targetDelta, 0, 3);
  if (target.severity !== targetPrev) changes.push({ id: target.id, prev: targetPrev, next: target.severity, target: true });

  activeIncidents().forEach((incident) => {
    if (incident.id === targetId) return;
    const delta = incidentImpact(incident.id, handlingId);
    if (delta <= 0) return;
    const prev = incident.severity;
    incident.severity = clamp(incident.severity + 1, 0, 3);
    if (incident.severity !== prev) changes.push({ id: incident.id, prev, next: incident.severity, target: false });
  });

  changes.push(...applyHandlingIncidentAftermath(handlingId, "immediate"));

  return changes.filter(Boolean);
}

function generateIncidentsFromKpis(handlingId) {
  const changes = [];
  kpiIncidentRules.forEach((rule) => {
    if (!kpiIncidentRuleMatches(rule)) return;
    changes.push(growIncident(rule.incidentId, 1));
  });
  changes.push(...applyHandlingIncidentAftermath(handlingId, "afterKpi"));
  return changes.filter(Boolean);
}

function applyHandlingIncidentAftermath(handlingId, phase) {
  const rules = handlingTypes[handlingId].incidentAftermath || [];
  return rules
    .filter((rule) => rule.phase === phase && handlingAftermathRuleMatches(rule))
    .map((rule) => growIncident(rule.incidentId, rule.amount || 1))
    .filter(Boolean);
}

function handlingAftermathRuleMatches(rule) {
  if (rule.when === "missing") return !hasActiveIncident(rule.incidentId);
  if (rule.when === "fewActiveWithoutSelf") {
    return activeIncidents().filter((incident) => incident.id !== rule.incidentId).length <= rule.maxCount;
  }
  return true;
}

function kpiIncidentRuleMatches(rule) {
  if (rule.anyActiveDanger) {
    return durationOptions[state.duration].kpis.some((key) => dangerType(state.kpis[key]));
  }
  const value = state.kpis[rule.kpi];
  if (rule.direction === "low") return value < rule.threshold;
  if (rule.direction === "high") return value > rule.threshold;
  return false;
}

function incidentImpact(incidentId, handlingId) {
  return incidentCatalog[incidentId]?.impacts[handlingId] || 0;
}

function growIncident(id, amount) {
  let incident = getIncident(id);
  if (!incident) {
    incident = { id, severity: 0 };
    state.incidents.push(incident);
  }
  const prev = incident.severity;
  incident.severity = clamp(incident.severity + amount, 0, 3);
  if (incident.severity === prev) return null;
  return { id, prev, next: incident.severity };
}

function collectRisks(handlingId) {
  const config = durationOptions[state.duration];
  const risks = new Set();
  config.kpis.forEach((key) => {
    const danger = dangerType(state.kpis[key]);
    if (!danger) return;
    const meta = kpiMeta[key];
    risks.add(`${danger === "low" ? meta.low : meta.high} +1`);
  });
  activeIncidents()
    .filter((incident) => incident.severity >= 3)
    .forEach((incident) => risks.add(`${incidentCatalog[incident.id].risk} +1`));
  if (handlingTypes[handlingId].riskSticker) risks.add(handlingTypes[handlingId].riskSticker);
  if (state.timeLeft < 0) risks.add("会议加班 +1");
  return [...risks];
}

function previewImpact(handlingId, targetId) {
  const targetDelta = incidentImpact(targetId, handlingId);
  const targetText = targetDelta < 0 ? "当前降" : targetDelta > 0 ? "当前升" : "当前稳";
  const sideCount = activeIncidents().filter((incident) => incident.id !== targetId && incidentImpact(incident.id, handlingId) > 0).length;
  const parts = [targetText];
  if (sideCount) parts.push("旁事升");
  if (handlingId === "deflect") parts.push("留遗留");
  return parts.join(" · ");
}

function buildHandlingTitle(handlingId, targetId, useDisplayCopy = true) {
  const targetName = incidentFeedbackMeta(targetId, useDisplayCopy).title || "现场事故";
  const opener = handlingTypes[handlingId]?.feedbackOpener || "已处理";
  return `${opener}：${targetName}`;
}

function buildReaction(handlingId, targetId, changes, risks, useDisplayCopy = true) {
  const changeText = formatTargetChanges(changes, targetId, useDisplayCopy);
  const riskText = risks.length ? `贴纸：${risks.slice(0, 2).join("、")}。` : "暂无新贴纸。";
  return `${changeText || "现场稳住。"} ${riskText}`;
}

function formatTargetChanges(changes, targetId, useDisplayCopy = true) {
  const merged = mergeChanges(changes).filter((change) => change.prev !== change.next);
  const target = merged.find((change) => change.id === targetId);
  const sideEffects = merged.filter((change) => change.id !== targetId && change.next > change.prev).slice(0, 2);
  const parts = [];

  if (target) {
    const displayMeta = incidentFeedbackMeta(target.id, useDisplayCopy);
    const name = displayMeta.title;
    if (target.next < target.prev) parts.push(target.next === 0 ? `${name}：${displayMeta.resolvedFlavor || "已清掉"}。` : `${name}降到 ${target.next}。`);
    else parts.push(`${name}升到 ${target.next}。`);
  } else {
    parts.push(`${incidentFeedbackMeta(targetId, useDisplayCopy).title}暂稳。`);
  }

  if (sideEffects.length) {
    parts.push(
      `旁边：${sideEffects
        .map((change) => `${incidentFeedbackMeta(change.id, useDisplayCopy).title}+${change.next - change.prev}`)
        .join("、")}。`
    );
  }

  return parts.join(" ");
}

function incidentFeedbackMeta(incidentId, useDisplayCopy) {
  if (useDisplayCopy) return incidentDisplayMeta(incidentId);
  return incidentCatalog[incidentId] || { title: "现场事故", resolvedFlavor: "已清掉" };
}

function mergeChanges(changes) {
  const map = new Map();
  changes.forEach((change) => {
    if (!change) return;
    const saved = map.get(change.id);
    if (!saved) {
      map.set(change.id, { ...change });
      return;
    }
    saved.next = change.next;
  });
  return [...map.values()];
}

function resolvedIncidentIdsFromChanges(changes) {
  return mergeChanges(changes)
    .filter((change) => change.prev > 0 && change.next === 0)
    .map((change) => change.id);
}

function buildResultMetrics({ config, remainingIncidents, risks, overtime, meetingSeconds }) {
  const remainingSeverity = remainingIncidents.reduce((sum, incident) => sum + incident.severity, 0);
  const maxIncidentSeverity = remainingIncidents.reduce((max, incident) => Math.max(max, incident.severity), 0);
  const resolvedIds = new Set();
  state.history.forEach((item) => {
    (item.resolvedIncidentIds || []).forEach((id) => resolvedIds.add(id));
  });

  const kpiReadyCount = config.kpis.filter((key) => inTarget(state.kpis[key])).length;
  const worstKpi = findWorstKpi(config.kpis);
  const topIncident = remainingIncidents[0] || null;
  const metrics = {
    handledCount: state.history.length,
    resolvedCount: resolvedIds.size,
    remainingCount: remainingIncidents.length,
    remainingSeverity,
    maxIncidentSeverity,
    kpiReadyCount,
    kpiTotal: config.kpis.length,
    overtime,
    earlyTime: Math.max(0, state.timeLeft),
    meetingSeconds,
    riskCount: risks.length,
    topIncident,
    worstKpi,
    topHandling: topHandlingId(),
    primaryFailure: null
  };
  metrics.primaryFailure = buildPrimaryFailure(metrics);
  return metrics;
}

function buildRating(metrics) {
  const halfKpis = Math.ceil(metrics.kpiTotal / 2);
  const mostKpis = Math.max(1, metrics.kpiTotal - 1);
  const earlyTooMuch = metrics.earlyTime > 20;

  if (metrics.riskCount >= 5 || metrics.remainingSeverity >= 10 || (metrics.maxIncidentSeverity >= 3 && metrics.remainingCount >= 4 && metrics.kpiReadyCount < halfKpis)) {
    return "审计保留意见";
  }

  if (metrics.overtime > 0 && metrics.resolvedCount >= 2 && metrics.remainingSeverity <= 5 && metrics.kpiReadyCount >= halfKpis && metrics.riskCount <= 3) {
    return "加班救场";
  }

  if (metrics.handledCount === 0 || (earlyTooMuch && (metrics.remainingSeverity > 2 || metrics.kpiReadyCount < halfKpis))) {
    return "仓促复工";
  }

  if (metrics.maxIncidentSeverity >= 3 || metrics.riskCount >= 3 || metrics.remainingSeverity >= 7) {
    return "红灯闪烁";
  }

  if (metrics.overtime > 0) return "加班救场";

  if (metrics.remainingSeverity === 0 && metrics.kpiReadyCount >= mostKpis && metrics.riskCount <= 1) {
    return "准点清场";
  }

  if (metrics.remainingSeverity <= 5 && metrics.kpiReadyCount >= halfKpis) return "准点带债";
  return "带事故复工";
}

function buildPrimaryFailure(metrics) {
  if (metrics.remainingSeverity === 0 && metrics.kpiReadyCount === metrics.kpiTotal && metrics.riskCount <= 1) {
    return { id: "clear", type: "clear", label: "清场收工" };
  }
  if (metrics.riskCount >= 5) return { id: "risk_stack", type: "risk", label: "贴纸堆太高" };
  if (metrics.topIncident && (metrics.remainingSeverity >= 6 || metrics.maxIncidentSeverity >= 3)) {
    return { id: `incident:${metrics.topIncident.id}`, type: "incident", label: incidentCatalog[metrics.topIncident.id].title };
  }
  if (metrics.kpiReadyCount < Math.ceil(metrics.kpiTotal / 2) && metrics.worstKpi) {
    return { id: `kpi:${metrics.worstKpi.key}`, type: "kpi", label: kpiMeta[metrics.worstKpi.key].name };
  }
  if (metrics.earlyTime > 20) return { id: "rushed", type: "timing", label: "太早盖章" };
  if (metrics.overtime > 0) return { id: "overtime", type: "timing", label: "会议加班" };
  if (metrics.topIncident && metrics.remainingCount > 0) return { id: `incident:${metrics.topIncident.id}`, type: "incident", label: incidentCatalog[metrics.topIncident.id].title };
  if (metrics.worstKpi) return { id: `kpi:${metrics.worstKpi.key}`, type: "kpi", label: kpiMeta[metrics.worstKpi.key].name };
  if (metrics.riskCount) return { id: "risk_stack", type: "risk", label: "贴纸没撕干净" };
  return { id: "clear", type: "clear", label: "清场收工" };
}

function topHandlingId() {
  const counts = state.history.reduce((acc, item) => {
    acc[item.handling] = (acc[item.handling] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function findWorstKpi(keys) {
  const outside = keys
    .map((key) => {
      const value = state.kpis[key];
      const lowGap = targetZone.min - value;
      const highGap = value - targetZone.max;
      const gap = Math.max(lowGap, highGap, 0);
      return { key, value, gap, side: lowGap > highGap ? "low" : "high" };
    })
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  return outside[0] || null;
}

function buildCulture(metrics) {
  const counts = state.history.reduce((acc, item) => {
    acc[item.handling] = (acc[item.handling] || 0) + 1;
    return acc;
  }, {});
  const topHandling = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (metrics.remainingSeverity >= 10 || metrics.riskCount >= 5) return "事故连锁型";
  if (metrics.overtime > 0 && metrics.remainingSeverity <= 5) return "会议加班型";
  if (topHandling === "deflect") return "历史遗留型";
  if (topHandling === "vision") return "泡沫叙事型";
  if (topHandling === "comfort") return "福利安抚型";
  if (topHandling === "push") return "强行动员型";
  if (metrics.remainingSeverity >= 8 || metrics.riskCount >= 4) return "事故连锁型";
  if (metrics.earlyTime > 20) return "仓促盖章型";
  return "试营业观察型";
}

function buildTitle(rating, culture, topRisk, metrics) {
  const risk = topRisk || "";
  const topIncidentId = metrics.topIncident?.id || "";
  const noAction = metrics.handledCount === 0;
  const highLeftover = metrics.remainingSeverity >= 8 || metrics.maxIncidentSeverity >= 3;

  if (metrics.remainingSeverity === 0 && metrics.kpiReadyCount >= metrics.kpiTotal - 1) {
    return metrics.overtime > 0 ? "加班清场型腿日" : "准点盖章型腿日";
  }
  if (noAction && metrics.overtime > 0 && highLeftover) return "旁观加班型复工";
  if (noAction && metrics.remainingSeverity > 0) return "裸签事故型腿日";
  if (risk.includes("历史") || culture === "历史遗留型" || topIncidentId === "file_pile") return "档案柜增殖型腿日";
  if (risk.includes("供氧") || topIncidentId === "oxygen_red") return "账本发红型复工";
  if (risk.includes("泡沫") || culture === "泡沫叙事型" || topIncidentId === "ppt_bubble") return "PPT 泡泡型复工";
  if (risk.includes("审计") || topIncidentId === "audit_lamp" || rating === "审计保留意见") return "审计留档型复工";
  if (risk.includes("刺激") || topIncidentId === "stim_shake") return "仪表抖动型复工";
  if (risk.includes("下肢") || topIncidentId === "legs_slumped") return "腿部趴桌型复工";
  if (culture === "事故连锁型" || metrics.remainingSeverity >= 6) return "事故串门型复工";
  if (culture === "福利安抚型") return "糖水续命型营业";
  if (culture === "强行动员型") return "口号冲刺型腿日";
  if (metrics.handledCount >= 4) return "满桌盖章型复工";
  if (rating === "加班救场") return "加班救火型复工";
  if (rating === "仓促复工" || metrics.earlyTime > 20) return "早退盖章型复工";
  if (rating === "准点带债") return "带债准点型复工";
  if (rating === "红灯闪烁") return "红灯闪烁型复工";
  return "带事故复工型腿日";
}

function buildEvent() {
  const last = state.history[state.history.length - 1];
  if (!last) return "腿部事业群尚未正式发难，会议室已经开始热身。";
  const firstLine = last.reaction.split("。").filter(Boolean)[0] || "现场暂时稳住";
  return `${last.eventTitle}: ${firstLine}。`;
}

function metricsRemainingText(metrics) {
  if (!metrics.remainingSeverity) return "清场";
  return `${metrics.remainingCount} 件 / ${metrics.remainingSeverity} 级`;
}

function buildRoundHighlight(metrics) {
  const highLeftover = metrics.remainingSeverity >= 8 || metrics.maxIncidentSeverity >= 3;
  if (metrics.handledCount === 0 && metrics.remainingSeverity > 0) {
    return `这一轮没有处理动作，${metricsRemainingText(metrics)}遗留直接进财报。`;
  }
  if (metrics.overtime > 0 && metrics.remainingSeverity > 5) {
    return `会议拖进加班，但 ${metricsRemainingText(metrics)}还没收住。`;
  }
  if (highLeftover) {
    return `最大事故还在 ${metrics.maxIncidentSeverity} 级，不能只看 KPI 窗口。`;
  }
  if (metrics.remainingSeverity === 0 && metrics.kpiReadyCount >= metrics.kpiTotal - 1) return "清场顺手，账本基本愿意盖章。";
  if (metrics.resolvedCount >= 2) return `清掉 ${metrics.resolvedCount} 件事故，办公室至少看见地板。`;
  if (metrics.overtime > 0 && metrics.remainingSeverity <= 5) return "加班没有白加，火势被压回会议桌内。";
  if (metrics.kpiReadyCount >= Math.ceil(metrics.kpiTotal / 2)) return `${metrics.kpiReadyCount}/${metrics.kpiTotal} 个窗口盖章，复工门没完全锁死。`;
  if (metrics.handledCount > 0) return `处理了 ${metrics.handledCount} 件事故，至少不是裸签。`;
  return "按钮没怎么动，秘书省了墨水。";
}

function buildRegret(metrics) {
  const failure = metrics.primaryFailure;
  if (failure.type === "clear") return "没有大遗憾，审计组只捡到一个空纸杯。";
  if (metrics.handledCount === 0 && metrics.remainingSeverity > 0) {
    return `没有处理任何事故，${failure.label}还留在白板上。`;
  }
  if (failure.id === "risk_stack") return "风险贴纸太多，财报封面被贴满。";
  if (failure.id === "rushed") return "章盖得太早，办公室还没来得及收桌。";
  if (failure.id === "overtime") {
    if (metrics.remainingSeverity > 0) return `加班结束了，但还有 ${metricsRemainingText(metrics)}没有签收。`;
    return "加班救回了事故，但节奏文化变成会议加班型。";
  }
  if (failure.type === "kpi") return regretForKpi(failure.id.replace("kpi:", ""));
  if (failure.type === "incident") return regretForIncident(failure.id.replace("incident:", ""), metrics);
  return "现场有点乱，但秘书暂时找不到主责部门。";
}

function buildNextTip(metrics) {
  const failure = metrics.primaryFailure;
  if (metrics.handledCount === 0 && metrics.remainingSeverity > 0) {
    return "下轮至少先点开最急事故牌，别等它自己升级成财报标题。";
  }
  if (metrics.remainingSeverity >= 8 && metrics.topIncident) {
    return `先收 ${incidentCatalog[metrics.topIncident.id].title}，再看哪个 KPI 需要补章。`;
  }
  if (failure.type === "clear") return "下轮可以试试更少动作清场，让秘书少写两行。";
  if (failure.id === "risk_stack") return "贴纸超过三张时，先让审计组下班。";
  if (failure.id === "rushed") return "别太早冲出会议室，先看最急牌有没有翻面。";
  if (failure.id === "overtime") return "想保住准点文化，最后 20 秒只收尾不开新坑。";
  if (failure.type === "kpi") return tipForKpi(failure.id.replace("kpi:", ""));
  if (failure.type === "incident") return tipForIncident(failure.id.replace("incident:", ""));
  return "下轮先盯最大牌，再决定要糖水、口号还是档案柜。";
}

function buildNextPreview({ rating, culture, topRisk, metrics }) {
  const topIncident = metrics.topIncident?.id || "";
  if (metrics.handledCount === 0 && metrics.remainingSeverity > 0) return "白板没有被碰过，最急事故牌下轮会先坐主位。";
  if (metrics.remainingSeverity >= 8) return "白板还挂着大号遗留，下轮开场先别让它自我介绍。";
  if (rating === "审计保留意见" || topRisk.includes("审计")) return "审计组把本轮遗留贴到白板上，红灯还没关。";
  if (metrics.overtime > 0) return "会议钟被钉上白板，下轮秘书先查下班铃。";
  if (topRisk.includes("历史") || culture === "历史遗留型") return "档案柜吞下遗留文件，但柜门开始鼓。";
  if (topRisk.includes("泡沫") || topIncident === "ppt_bubble") return "PPT 泡泡被扫进档案柜，走廊还飘着标题页。";
  if (topRisk.includes("供氧") || topIncident === "oxygen_red") return "供氧账本要求下轮先开预算会。";
  if (topIncident === "legs_slumped") return "腿部事业群把椅子搬近门口，表示可以谈复工。";
  if (culture === "福利安抚型") return "糖水纸杯排到会议桌边，下轮谁先拿谁发言。";
  if (culture === "强行动员型") return "背部基建部已在门口排队，手里攥着施工单。";
  if (!metrics.remainingSeverity) return "会议室被临时扫干净，背部基建部已经探头。";
  return "白板留了几张便签，下轮开场先问是谁贴的。";
}

function regretForKpi(key) {
  const lines = {
    cash: "供氧账本没回到可复工区，财务部拒绝盖章。",
    morale: "动员温度没坐稳，会议室只剩纸杯在鼓掌。",
    growth: "刺激仪表没压住，指针还在偷偷加戏。",
    bubble: "准点很好，但泡沫指数把审计组叫醒了。"
  };
  return lines[key] || "有个 KPI 没进窗口，盖章机装作没电。";
}

function tipForKpi(key) {
  const lines = {
    cash: "下轮可以先救供氧账本，别让财务部最后才说话。",
    morale: "动员温度塌下去时，糖水比口号先到。",
    growth: "刺激仪表抖起来时，先降噪再盖章。",
    bubble: "如果想准点，最后 20 秒别再制造新 PPT。"
  };
  return lines[key] || "下轮先让最偏的仪表回窗口，再考虑盖章。";
}

function regretForIncident(id, metrics = {}) {
  const title = incidentCatalog[id]?.title || "事故牌";
  const severity = metrics.topIncident?.id === id ? metrics.topIncident.severity : metrics.maxIncidentSeverity;
  if (metrics.handledCount === 0) return `${title}没有被处理，最高已经挂到 ${severity || "高"} 级。`;
  if (metrics.topIncident?.id === id && severity >= 3) return `${title}还在 ${severity} 级，不能写成已经压住。`;
  const lines = {
    legs_slumped: "腿部趴桌还没离开桌面，复工章只能先悬着。",
    oxygen_red: "供氧账本还挂着红字，财务部把章收进抽屉。",
    ppt_bubble: "PPT 泡泡没清干净，战略部还在加页。",
    audit_lamp: "审计红灯还在闪，白板不肯签收。",
    stim_shake: "刺激仪表还在抖，会议桌没人敢碰它。",
    file_pile: "历史文件还在长高，档案柜已经不肯关门。"
  };
  return lines[id] || "有张事故牌没翻面，秘书把它夹进了财报。";
}

function tipForIncident(id) {
  const lines = {
    legs_slumped: "腿部趴桌先扶起来，别让它拖到盖章前。",
    oxygen_red: "下轮可以先救供氧账本，别让财务部最后才说话。",
    ppt_bubble: "PPT 泡泡冒头时，别让它坐上主位。",
    audit_lamp: "审计红灯亮时，少画饼，多清档案。",
    stim_shake: "刺激仪表抖起来时，先降噪再盖章。",
    file_pile: "历史文件冒头时，先处理档案柜，别让它继续养债。"
  };
  return lines[id] || "下轮先盯最大牌，再决定要糖水、口号还是档案柜。";
}

function buildTopRisk(risks, remainingIncidents) {
  const severe = remainingIncidents.find((incident) => incident.severity >= 3) || remainingIncidents[0];
  if (risks.length) {
    const cleaned = risks.map(cleanRiskLabel);
    const severeRisk = severe ? incidentCatalog[severe.id].risk : "";
    return cleaned.find((risk) => severeRisk && risk.includes(severeRisk)) || cleaned[0];
  }
  if (severe) return incidentCatalog[severe.id].risk;
  return "无新增贴纸";
}

function cleanRiskLabel(label) {
  return String(label).replace(/\s*\+\d+$/, "");
}

function reportTimingText(report) {
  if (report.timingLabel) return report.timingLabel;
  const early = Math.max(0, (report.duration || 0) - (report.meetingSeconds || 0));
  return buildTimingLabel(report.overtime || 0, early);
}

function buildTimingLabel(overtime, timeLeft) {
  if (overtime > 0) return `加班 +${formatDuration(overtime)}`;
  if (timeLeft > 0) return `提前 ${formatDuration(timeLeft)}`;
  return "准点复工";
}

function buildRemainingText(report) {
  const severity = Number(report.remainingSeverity ?? report.unresolved ?? 0);
  if (!severity) return "清场";
  if (report.remainingCount === undefined) return `${severity} 级`;
  return `${report.remainingCount} 件 / ${severity} 级`;
}

function saveReport(report) {
  const archive = state.archive;
  const day = todayKey();
  if (!archive.operatingDays.includes(day)) archive.operatingDays.push(day);
  archive.meetingCount += 1;
  archive.totalMeetingSeconds += report.meetingSeconds;
  archive.culture = report.culture;
  strategyIds.forEach((strategyId) => {
    archive.strategyCounts[strategyId] += report.history.filter((item) => item.handling === strategyId).length;
  });
  archive.pushCount = archive.strategyCounts.push;
  archive.reports.unshift(report);
  archive.reports = archive.reports.slice(0, 12);
  archive.memoryFacts = buildMemoryFacts(archive.reports);
  if (!archive.titles.includes(report.title)) archive.titles.unshift(report.title);
  archive.titles = archive.titles.slice(0, 16);
  state.archive = archive;
  persistArchive();
}

function loadArchive() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(saveKey) || "{}");
    const reports = (Array.isArray(saved.reports) ? saved.reports : []).slice(0, 12).map(normalizeStoredReport);
    const historyCounts = countStrategies(reports.flatMap((report) => report.history));
    const savedCounts = saved.strategyCounts && typeof saved.strategyCounts === "object" ? saved.strategyCounts : {};
    const strategyCounts = emptyStrategyCounts();
    strategyIds.forEach((strategyId) => {
      const legacyPushCount = strategyId === "push" ? Number(saved.pushCount || 0) : 0;
      strategyCounts[strategyId] = Math.max(0, Number(savedCounts[strategyId] ?? legacyPushCount ?? historyCounts[strategyId]) || 0);
      if (savedCounts[strategyId] === undefined && strategyId !== "push") strategyCounts[strategyId] = historyCounts[strategyId];
      if (strategyId === "push" && savedCounts[strategyId] === undefined) strategyCounts[strategyId] = Math.max(legacyPushCount, historyCounts.push);
    });
    const archive = {
      schemaVersion: 3,
      operatingDays: Array.isArray(saved.operatingDays) ? saved.operatingDays : [],
      meetingCount: Number(saved.meetingCount || 0),
      totalMeetingSeconds: Number(saved.totalMeetingSeconds || 0),
      culture: saved.culture || "",
      reports,
      titles: Array.isArray(saved.titles) ? saved.titles : [],
      pushCount: strategyCounts.push,
      strategyCounts,
      memoryFacts: buildMemoryFacts(reports),
      preparedRoundPack: null
    };
    archive.preparedRoundPack = normalizeStoredRoundPack(saved.preparedRoundPack, archive.memoryFacts);
    return archive;
  } catch {
    return emptyArchive();
  }
}

function emptyArchive() {
  return {
    schemaVersion: 3,
    operatingDays: [],
    meetingCount: 0,
    totalMeetingSeconds: 0,
    culture: "",
    reports: [],
    titles: [],
    pushCount: 0,
    strategyCounts: emptyStrategyCounts(),
    memoryFacts: [],
    preparedRoundPack: null
  };
}

function emptyStrategyCounts() {
  return { comfort: 0, push: 0, vision: 0, deflect: 0 };
}

function countStrategies(history) {
  const counts = emptyStrategyCounts();
  (Array.isArray(history) ? history : []).forEach((item) => {
    if (strategyIds.includes(item?.handling)) counts[item.handling] += 1;
  });
  return counts;
}

function normalizeStoredReport(report, index) {
  const value = report && typeof report === "object" ? report : {};
  const history = (Array.isArray(value.history) ? value.history : [])
    .filter((item) => strategyIds.includes(item?.handling) && incidentCatalog[item?.target])
    .map((item) => ({ handling: item.handling, target: item.target, eventTitle: String(item.eventTitle || "").slice(0, 80) }));
  return {
    ...value,
    reportId: typeof value.reportId === "string" && value.reportId ? value.reportId : legacyReportId(value, index),
    history,
    reportComment: typeof value.reportComment === "string" ? value.reportComment.slice(0, 120) : "",
    agentSource: value.agentSource === "ai" ? "ai" : "local"
  };
}

function legacyReportId(report, index) {
  return `legacy-${hashText(`${report.date || ""}|${report.title || ""}|${report.meetingSeconds || 0}|${index}`)}`;
}

function createReportId() {
  return `report-${Date.now().toString(36)}-${state.roundId.toString(36)}`;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildMemoryFacts(reports) {
  const recent = (Array.isArray(reports) ? reports : []).slice(0, 5);
  if (!recent.length) return [];
  const facts = [];
  const counts = countStrategies(recent.flatMap((report) => report.history || []));
  const topStrategy = strategyIds
    .map((id) => ({ id, count: counts[id] }))
    .sort((a, b) => b.count - a.count || strategyIds.indexOf(a.id) - strategyIds.indexOf(b.id))[0];
  if (topStrategy?.count) {
    facts.push({ id: `strategy:${topStrategy.id}`, label: `最近几局更常用${handlingTypes[topStrategy.id].label}。` });
  }

  const latest = recent[0];
  facts.push({ id: `result:${latest.reportId}`, label: `上一局评级为“${latest.rating || "未评级"}”，节奏是${reportTimingText(latest)}。` });
  if (latest.topRisk && latest.topRisk !== "无新增贴纸") {
    facts.push({ id: `risk:${latest.reportId}`, label: `上一局最显眼的风险是“${cleanRiskLabel(latest.topRisk)}”。` });
  }
  const leftover = Number(latest.remainingSeverity ?? latest.unresolved ?? 0);
  if (leftover > 0) {
    facts.push({ id: `leftover:${latest.reportId}`, label: "上一局仍有事故没有清完。" });
  } else {
    facts.push({ id: `leftover:${latest.reportId}`, label: "上一局事故已经清场。" });
  }
  return facts.slice(0, 4);
}

function persistArchive() {
  try {
    window.localStorage.setItem(saveKey, JSON.stringify(state.archive));
  } catch {
    // Storage is optional; the active round remains playable if persistence is unavailable.
  }
}

function updateReportAgentState(reportId, updates) {
  if (!reportId) return false;
  const reportIndex = state.archive.reports.findIndex((report) => report.reportId === reportId);
  if (reportIndex < 0) return false;
  const updated = { ...state.archive.reports[reportIndex], ...updates };
  state.archive.reports[reportIndex] = updated;
  if (state.report?.reportId === reportId) state.report = updated;
  persistArchive();
  return true;
}

function localRoundContent(duration) {
  const briefings = {
    30: "腿部事业群已开快速会：先点最急事故，两个章用完就复工。",
    60: "腿部事业群把白板推到门口：四次处理，别让一张牌坐大。",
    90: "腿部事业群记得这是恢复预算：五次处理，准点比口号重要。"
  };
  return { source: "local", duration, briefing: briefings[duration] || briefings[90], memoryFactId: "", incidents: [] };
}

function incidentDisplayMeta(incidentId) {
  const base = incidentCatalog[incidentId] || {
    id: incidentId,
    owner: "会议秘书",
    title: "现场事故",
    cardTitle: "现场事故",
    icon: "事",
    line: "现场需要处理。",
    detail: "先选择一个处理方式。",
    resolvedFlavor: "暂时收住"
  };
  const overlay = state.roundContent?.incidents?.find((incident) => incident.id === incidentId) || {};
  return {
    ...base,
    title: overlay.title || base.title,
    cardTitle: overlay.title || base.cardTitle || base.title,
    line: overlay.line || base.line,
    detail: overlay.detail || base.detail,
    resolvedFlavor: overlay.resolvedFlavor || base.resolvedFlavor
  };
}

function preparedPackForDuration(duration) {
  const pack = state.archive.preparedRoundPack;
  return pack && pack.duration === duration ? pack : null;
}

function hasPreparedPack(archive, duration) {
  return Boolean(archive?.preparedRoundPack && archive.preparedRoundPack.duration === duration);
}

function promotePreparedPack(duration) {
  const pack = preparedPackForDuration(duration);
  if (!pack) return null;
  state.archive.preparedRoundPack = null;
  if (state.agent.status === "ready") state.agent.status = "idle";
  persistArchive();
  return { ...pack, incidents: pack.incidents.map((incident) => ({ ...incident })) };
}

function normalizeStoredRoundPack(pack, memoryFacts) {
  if (!pack || typeof pack !== "object" || pack.source !== "ai") return null;
  const duration = Number(pack.duration);
  if (!durationOptions[duration]) return null;
  return normalizeNextRound(pack, duration, memoryFacts, false);
}

function normalizeNextRound(nextRound, duration, memoryFacts, requireGeneratedContent = true) {
  if (!nextRound || typeof nextRound !== "object") return null;
  const allowedMemoryIds = new Set((memoryFacts || []).map((fact) => fact.id));
  const briefing = safeAiText(nextRound.briefing, 100);
  const incidents = [];
  const seen = new Set();
  (Array.isArray(nextRound.incidents) ? nextRound.incidents : []).forEach((incident) => {
    if (!incident || typeof incident !== "object" || !incidentCatalog[incident.id] || seen.has(incident.id)) return;
    const normalized = {
      id: incident.id,
      title: safeAiText(incident.title, 18),
      line: safeAiText(incident.line, 72),
      detail: safeAiText(incident.detail, 90),
      resolvedFlavor: safeAiText(incident.resolvedFlavor, 32)
    };
    if (!normalized.title && !normalized.line && !normalized.detail && !normalized.resolvedFlavor) return;
    seen.add(incident.id);
    incidents.push(normalized);
  });
  if (requireGeneratedContent && !briefing && !incidents.length) return null;
  if (!briefing && !incidents.length) return null;
  return {
    source: "ai",
    duration,
    briefing: briefing || localRoundContent(duration).briefing,
    memoryFactId: allowedMemoryIds.has(nextRound.memoryFactId) ? nextRound.memoryFactId : "",
    incidents,
    preparedAt: Number(nextRound.preparedAt || Date.now())
  };
}

function safeAiText(value, maxLength) {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text || containsUnsafeTrainingAdvice(text)) return "";
  return text.slice(0, maxLength);
}

function containsUnsafeTrainingAdvice(text) {
  return hasForbiddenAiCopy(text);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function homeAgentView(preparedPack) {
  if (preparedPack) {
    return { label: "AI Agent", className: "is-ai", title: "本轮开场已备好", message: preparedPack.briefing, canRetry: false };
  }
  if (state.agent.status === "preparing") {
    return { label: "准备中", className: "is-preparing", title: "AI 正在整理事故稿", message: "可以直接开始；没有等到时会自动使用本地预案。", canRetry: false };
  }
  return {
    label: "本地预案",
    className: "is-local",
    title: aiEnabled ? "部门使用固定值班稿" : "静态试玩使用本地值班稿",
    message: state.agent.error || localRoundContent(state.duration).briefing,
    canRetry: aiEnabled && state.agent.status === "failed"
  };
}

function reportAgentView(report) {
  if (report.agentSource === "ai") return { label: "AI Agent", className: "is-ai", canRetry: state.agent.status === "failed" };
  if (report.agentSource === "preparing") return { label: "准备中", className: "is-preparing", canRetry: false };
  return { label: "本地预案", className: "is-local", canRetry: aiEnabled && state.agent.status === "failed" };
}

function agentSourceLabel(source) {
  if (source === "ai") return "AI Agent";
  if (source === "preparing") return "准备中";
  return "本地预案";
}

function buildLocalReportComment(report) {
  const counts = countStrategies(report.history);
  const top = strategyIds.map((id) => ({ id, count: counts[id] })).sort((a, b) => b.count - a.count)[0];
  if (!top?.count) return "这局你没有正式处理事故，腿部事业群把沉默记进了值班记录。";
  if (Number(report.remainingSeverity || 0) > 0) {
    return `腿部事业群记住你常用${handlingTypes[top.id].label}，但这局仍留下 ${report.remainingSeverity} 级事故。`;
  }
  return `腿部事业群记住你常用${handlingTypes[top.id].label}，这次把事故清到了零。`;
}

function ensureRoundContentPrepared() {
  if (preparedPackForDuration(state.duration)) {
    state.agent.status = "ready";
    state.agent.error = "";
    renderAgentSurface();
    return;
  }
  if (state.agent.status === "preparing" && state.agent.requestDuration === state.duration) return;
  prepareRoundContent({ duration: state.duration });
}

function retryAgentRequest() {
  const report = state.phase === "report" ? state.report : null;
  prepareRoundContent({ duration: report?.duration || state.duration, report, force: true });
}

async function prepareRoundContent({ duration = state.duration, report = null, force = false } = {}) {
  const reportId = report?.reportId || "";
  if (!reportId && !durationOptions[duration]) return;
  if (!reportId && !force && preparedPackForDuration(duration)) return;

  if (!aiEnabled) {
    if (reportId) updateReportAgentState(reportId, { agentSource: "local" });
    state.agent.status = "failed";
    state.agent.error = "AI 接口未启用，本轮使用本地预案。";
    renderAgentSurface();
    return;
  }

  supersedeAgentRequest();
  const requestToken = ++state.agent.requestSequence;
  const controller = new AbortController();
  const requestMemoryFacts = state.archive.memoryFacts.map((fact) => ({ id: fact.id, label: fact.label }));
  state.agent.activeRequestToken = requestToken;
  state.agent.requestDuration = duration;
  state.agent.targetReportId = reportId;
  state.agent.controller = controller;
  state.agent.status = "preparing";
  state.agent.error = "";
  if (reportId) updateReportAgentState(reportId, { agentSource: "preparing" });
  renderAgentSurface();

  const timeout = window.setTimeout(() => controller.abort(), aiRequestBudgetMs);
  try {
    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "round_content", context: buildRoundContentContext(duration, report, requestMemoryFacts) }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI_HTTP_${response.status}`);
    const payload = await response.json();
    if (!isCurrentAgentRequest(requestToken)) return;
    const normalized = normalizeAiPayload(payload, duration, requestMemoryFacts);
    if (!normalized) throw new Error("AI_INVALID_PAYLOAD");
    if (!reportId && !normalized.nextRound) throw new Error("AI_NEXT_ROUND_MISSING");

    if (reportId) {
      const comment = normalized.reportComment || buildLocalReportComment(report);
      updateReportAgentState(reportId, { reportComment: comment, agentSource: normalized.reportComment ? "ai" : "local" });
    }
    if (normalized.nextRound) state.archive.preparedRoundPack = normalized.nextRound;
    const hasReportComment = !reportId || Boolean(normalized.reportComment);
    const hasNextRound = Boolean(normalized.nextRound || preparedPackForDuration(duration));
    state.agent.status = hasReportComment && hasNextRound ? "ready" : "failed";
    state.agent.error = !hasReportComment
      ? "AI 已备好下轮事故稿，但本轮复盘仍使用本地预案。"
      : !hasNextRound
        ? "AI 已补签本轮复盘，但下轮事故稿仍使用本地预案。"
        : "";
    persistArchive();
    renderAgentSurface();
  } catch (error) {
    if (!isCurrentAgentRequest(requestToken)) return;
    if (reportId) updateReportAgentState(reportId, { agentSource: "local" });
    state.agent.status = "failed";
    state.agent.error = error?.name === "AbortError" ? "AI 等待超过 22 秒，本轮已切到本地预案。" : "AI 暂时没有返回，本轮已切到本地预案。";
    renderAgentSurface();
  } finally {
    window.clearTimeout(timeout);
    if (isCurrentAgentRequest(requestToken)) {
      state.agent.activeRequestToken = null;
      state.agent.controller = null;
      state.agent.requestDuration = 0;
      state.agent.targetReportId = "";
    }
  }
}

function supersedeAgentRequest() {
  if (!state.agent.activeRequestToken) return;
  const previousReportId = state.agent.targetReportId;
  state.agent.activeRequestToken = null;
  state.agent.controller?.abort();
  if (previousReportId) updateReportAgentState(previousReportId, { agentSource: "local" });
}

function isCurrentAgentRequest(token) {
  return state.agent.activeRequestToken === token;
}

function buildRoundContentContext(duration, report, memoryFacts) {
  const context = {
    department: "legs",
    duration,
    incidentSlots: incidentOrder.map((id) => ({
      id,
      owner: incidentCatalog[id].owner,
      baseTitle: incidentCatalog[id].title,
      baseLine: incidentCatalog[id].line,
      baseDetail: incidentCatalog[id].detail
    })),
    memoryFacts,
    strategyCounts: { ...state.archive.strategyCounts }
  };
  if (report) {
    context.previousRound = {
      reportId: report.reportId,
      rating: report.rating,
      timingLabel: report.timingLabel,
      culture: report.culture,
      risks: Array.isArray(report.risks) ? report.risks : [],
      history: (Array.isArray(report.history) ? report.history : []).map(({ handling, target, eventTitle }) => ({ handling, target, eventTitle }))
    };
  }
  return context;
}

function normalizeAiPayload(payload, duration, memoryFacts) {
  if (!payload || payload.ok !== true || payload.source !== "ai") return null;
  const nextRound = normalizeNextRound(payload.nextRound, duration, memoryFacts, true);
  const reportComment = safeAiText(payload.reportComment, 120);
  if (!nextRound && !reportComment) return null;
  return {
    reportComment,
    ...(nextRound ? { nextRound } : {}),
    secretaryNote: safeAiText(payload.secretaryNote, 100)
  };
}

function renderAgentSurface() {
  if (["home", "report", "archive"].includes(state.phase)) render();
}

function initialKpis(duration) {
  if (duration === 30) return { cash: 34, morale: 36, growth: 45, bubble: 47 };
  if (duration === 60) return { cash: 46, morale: 42, growth: 38, bubble: 50 };
  return { cash: 52, morale: 46, growth: 44, bubble: 62 };
}

function recommendedDurationText() {
  if (state.duration === 90) return "90 秒恢复预算";
  if (state.duration === 60) return "60 秒标准预算";
  return "30 秒秒杀预算";
}

function formatTimer(seconds) {
  if (seconds < 0) return `加班 +${formatDuration(Math.abs(seconds))}`;
  return formatDuration(seconds);
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function todayKey() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function inTarget(value) {
  return value >= targetZone.min && value <= targetZone.max;
}

function dangerType(value) {
  if (value < 25) return "low";
  if (value > 80) return "high";
  return "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
