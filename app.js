const root = document.documentElement;
const cursor = document.querySelector(".cursor-dot");

root.classList.add("js");

addEventListener("pointermove", (event) => {
  root.style.setProperty("--pointer-x", `${event.clientX}px`);
  root.style.setProperty("--pointer-y", `${event.clientY}px`);
  cursor?.style.setProperty("transform", `translate3d(${event.clientX}px, ${event.clientY}px, 0)`);
});

document.querySelectorAll("a, button, .toy-card").forEach((element) => {
  element.addEventListener("pointerenter", () => cursor?.classList.add("is-hovering"));
  element.addEventListener("pointerleave", () => cursor?.classList.remove("is-hovering"));
});

document.querySelectorAll(".tilt-window").forEach((windowElement) => {
  windowElement.addEventListener("pointermove", (event) => {
    const rect = windowElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    windowElement.style.setProperty("--tilt-x", `${y * -5}deg`);
    windowElement.style.setProperty("--tilt-y", `${x * 6}deg`);
  });
  windowElement.addEventListener("pointerleave", () => {
    windowElement.style.removeProperty("--tilt-x");
    windowElement.style.removeProperty("--tilt-y");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  },
  { threshold: 0.12 },
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

// Project details are local. Opening an introduction never contacts another site.
const projectIntroductions = {
  "TrainPal": {
    image: "./assets/trainpal-gentle-idle.webp", caption: "TrainPal 角色形象", visual: "character",
    summary: "把健身视频里的动作整理成训练计划，确认后就能跟着练。",
    highlights: ["查看视频里的动作，确认或调整计划", "跟着计划训练，记录完成情况"],
    boundary: "当前提供项目源码，暂未提供公开在线体验。",
  },
  "AI Job Copilot": {
    graphic: ["JD", "↕", "RÉSUMÉ"], caption: "岗位与简历对照示意", visual: "job",
    summary: "投递前先看懂岗位要求，再对照自己的简历准备。",
    highlights: ["浏览岗位资料，分析具体 JD", "查看简历匹配结果，继续追问并保存记录"],
    boundary: "分析结果用于求职准备，不预测录用概率。当前可查看源码。",
  },
  "Bili-Bill": {
    image: "./assets/bili-bill-dashboard.png", caption: "Bili-Bill 界面预览 · 图中数据仅作展示", visual: "screenshot",
    summary: "把 B 站观看记录和收藏整理起来，找回自己看过的内容。",
    highlights: ["查看个人观看账单和收藏", "数据保存在本地，AI 功能需自行配置"],
    boundary: "浏览器扩展项目，需要按仓库说明安装使用。",
  },
  "LY-LLM Wiki": {
    graphic: ["PAPERS", "↓", "EVIDENCE"], caption: "文献与原文依据示意", visual: "research",
    summary: "整理冰雪跑道抗滑研究文献，让查到的结论有原文可核对。",
    highlights: ["围绕研究问题查找文献", "核对论述、公式和对应的原文依据"],
    boundary: "研究用工具。结论仍需人工核验，当前可查看源码。",
  },
  "Momentum Planet": {
    graphic: ["◉", "MOMENTUM", "PLANET"], caption: "动量星球 · 项目主题示意", visual: "planet",
    summary: "一边运动打卡，一边带着角色闯关。",
    highlights: ["选择角色，查看星球征途", "完成每日挑战，查看角色成长"],
    boundary: "Web Demo，体验将在新标签页打开。", demo: "https://momentum-planet.vercel.app/",
  },
  "知音": {
    image: "./assets/zhiyin-card.png", caption: "知音灵感卡 · 模拟数据预览", visual: "phone",
    summary: "刷到喜欢的内容，收进一张能继续补充的灵感卡。",
    highlights: ["滑到第二条视频，打开知音", "收进灵感袋，把后续相关内容补进来"],
    boundary: "交互原型使用模拟数据，不调用真实 AI 或发送提醒。",
    demo: "./zhiyin/", github: "https://github.com/LittleNuB/Douyin-SubfuncDesign-Zhiyin",
  },
  "Body Inc.": {
    graphic: ["BODY INC.", "90s", "下一组再议"], caption: "办公室事故 · 游戏主题示意", visual: "body",
    summary: "下一组开始前，先当一会儿身体公司的老板。",
    highlights: ["点开办公室事故，选择处理方式", "结束小会，查看财报和本地档案"],
    boundary: "可玩实验，使用本地规则和文案，不提供训练或安全建议。",
    demo: "./body-inc/", github: "https://github.com/LittleNuB/body-inc-next-set-reconsidered",
  },
};

const projectDialog = document.querySelector(".project-dialog");
let projectOpener = null;
let previousOverflow = "";

function openProjectIntroduction(name, opener) {
  const project = projectIntroductions[name];
  if (!project || !projectDialog || projectDialog.open) return;
  projectOpener = opener;
  const card = opener.closest(".work-row, .toy-card");
  const github = project.github || (opener.hostname === "github.com" ? opener.href : null);
  projectDialog.querySelector("#project-title").textContent = name;
  projectDialog.querySelector("#project-summary").textContent = project.summary;
  projectDialog.querySelector(".project-status").textContent = card.querySelector("header span, :scope > span")?.textContent || "PROJECT";
  projectDialog.querySelector(".project-boundary").textContent = project.boundary;
  const highlights = projectDialog.querySelector(".project-highlights");
  highlights.replaceChildren(...project.highlights.map(text => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  const preview = projectDialog.querySelector(".project-preview-content");
  preview.className = `project-preview-content preview-${project.visual}`;
  preview.replaceChildren();
  if (project.image) {
    const picture = document.createElement("img");
    picture.src = project.image;
    picture.alt = project.caption;
    preview.append(picture);
  } else {
    project.graphic.forEach(text => {
      const line = document.createElement("span");
      line.textContent = text;
      preview.append(line);
    });
  }
  projectDialog.querySelector("figcaption").textContent = project.caption;
  for (const [selector, href] of [[".project-demo", project.demo], [".project-github", github]]) {
    const link = projectDialog.querySelector(selector);
    link.hidden = !href;
    link.removeAttribute("href");
    link.removeAttribute("target");
    if (href) {
      link.href = href;
      if (new URL(href, location.href).origin !== location.origin) {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
    }
  }
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  projectDialog.showModal();
  projectDialog.scrollTop = 0;
  cursor?.classList.remove("is-hovering");
}

if (projectDialog && typeof projectDialog.showModal === "function") {
  document.querySelectorAll(".work-row, .toy-card > a").forEach(opener => {
    const name = opener.closest(".toy-card")?.querySelector("h3").textContent || opener.querySelector("strong")?.textContent;
    if (!projectIntroductions[name]) return;
    opener.setAttribute("aria-haspopup", "dialog");
    opener.setAttribute("aria-label", `查看 ${name} 项目介绍`);
    if (opener.closest(".toy-card")) opener.textContent = "了解项目 ↗";
    opener.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openProjectIntroduction(name, opener);
    });
  });
  projectDialog.querySelector(".project-close").addEventListener("click", () => projectDialog.close());
  projectDialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...projectDialog.querySelectorAll("button, a[href]")].filter(element => !element.hidden);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  let backdropPress = false;
  const outsideDialog = event => {
    const rect = projectDialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  projectDialog.addEventListener("pointerdown", event => { backdropPress = outsideDialog(event); });
  projectDialog.addEventListener("click", event => {
    if (backdropPress && outsideDialog(event)) projectDialog.close();
    backdropPress = false;
  });
  projectDialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    projectOpener?.focus({ preventScroll: true });
  });
}
