const root = document.documentElement;
const cursor = document.querySelector(".cursor-dot");

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
