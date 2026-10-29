import "./style.css";
import { Game } from "./game/game";
import type { Status } from "./game/game";
import { LEVELS, LEVEL_ORDER } from "./game/levels";
import type { LevelId } from "./game/levels";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};
const show = (id: string, visible: boolean) =>
  $(id).classList.toggle("hidden", !visible);
const write = (id: string, text: string) => {
  const element = $(id);
  if (element.textContent !== text) element.textContent = text;
};
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
let notificationTimer: ReturnType<typeof setTimeout>;
let damageTimer: ReturnType<typeof setTimeout>;
let lastPhase = "";
let lastLevelId: LevelId | undefined;
let game: Game;
function notify(message: string) {
  clearTimeout(notificationTimer);
  write("notification", message);
  $("notification").classList.add("visible");
  notificationTimer = setTimeout(
    () => $("notification").classList.remove("visible"),
    3800
  );
}
const LEVEL_COPY: Record<
  LevelId,
  {
    title: [string, string];
    region: string;
    intro: string;
    caption: string;
    code: string;
    inventory: [string, string];
    won: string;
    lost: string;
  }
> = {
  hippos: {
    title:["HIPPO","NAP"],region:"HIPPO-KINDERSTUBE",
    intro:"Sechs Baby-Hippos wollen kuscheln.<br>Ihre Umarmungen kosten dich Gesundheit.<br><strong>Drei Karotten pro Hippo. Dann schlafen sie.</strong>",
    caption:"KAROTTEN & MITTAGSSCHLAF",code:"05",inventory:["3 KAROTTEN PRO HIPPO","ALLE HIPPOS SATT"],
    won:"Alle Baby-Hippos sind satt und schlafen. Gute Nacht, kleine Hippos!",
    lost:"Zu viele Umarmungen! Halte Abstand und füttere jedes Hippo mit drei Karotten.",
  },
  office: {
    title: ["STEEL", "HORIZON"], region: "BÜROKOMPLEX",
    intro: "Drei Etagen. Keine menschliche Besatzung.<br>Killerroboter sichern das Gebäude.<br><strong>Finde die Zugangskarte. Erreiche den Aufzug.</strong>",
    caption: "NORDSTERN TOWER", code: "06", inventory: ["ZUGANGSKARTE GESUCHT", "ZUGANGSKARTE GEFUNDEN"],
    won: "Der Aufzug bringt dich aus dem Bürokomplex.", lost: "Die Kampfmaschinen haben dich ausgeschaltet. Nutze alle drei Etagen und die Railgun.",
  },
  bakery: {
    title: ["SUGAR", "RUSH"], region: "KONDITOREI",
    intro: "Die Kuchen sind wütend.<br>Deine Shotgun verschießt Insulinspritzen.<br><strong>Hol das Geheimrezept. Raus aus der Backstube.</strong>",
    caption: "BACKSTUBE", code: "04", inventory: ["GEHEIMREZEPT GESUCHT", "GEHEIMREZEPT GEFUNDEN"],
    won: "Das Rezept ist gerettet. Hinter dir bleibt eine sehr wütende Konditorei.",
    lost: "Die Kuchen haben dich überrollt. Nutze die Streuung deiner Insulin-Shotgun.",
  },
  station: {
    title: ["LOCK", "DOWN"],
    region: "FORSCHUNGSANLAGE",
    intro:
      "Die Verbindung ist abgebrochen.<br>Das Sicherheitssystem jagt dich.<br><strong>Finde einen Weg nach draußen.</strong>",
    caption: "REAKTORHALLE",
    code: "A–01",
    inventory: ["KEINE ZUGANGSKARTE", "ZUGANGSKARTE AKTIV"],
    won: "Die Schleuse ist offen. Hinter dir fällt die Station wieder in die Dunkelheit.",
    lost: "Das Sicherheitssystem hat dich gefunden. Die Station gibt dir eine zweite Chance.",
  },
  outbreak: {
    title: ["DEAD", "COAST"],
    region: "KÜSTENSTADT",
    intro:
      "Die Straßen brennen.<br>Zwischen den Palmen lauern Infizierte.<br><strong>Erreiche das Safehouse.</strong>",
    caption: "PALM BOULEVARD",
    code: "02",
    inventory: ["FUNKGERÄT GESUCHT", "FUNKSIGNAL AKTIV"],
    won: "Die Safehouse-Tür fällt ins Schloss. Draußen brennen die Straßen weiter.",
    lost: "Die Infizierten haben dich überrannt. Versuch es mit mehr Abstand und nutze die Vorräte.",
  },
  lakehouse: {
    title: ["LAKE", "HOUSE"],
    region: "SEEGRUNDSTÜCK",
    intro:
      "Ein Haus am See. Ein Boot am Steg.<br>Und verdächtig viele gelbe Gummienten.<br><strong>Hol den Schlüssel. Leg ab.</strong>",
    caption: "SEEHAUS & BOOTSTEG",
    code: "03",
    inventory: ["BOOTSSCHLÜSSEL GESUCHT", "BOOTSSCHLÜSSEL GEFUNDEN"],
    won: "Der Außenborder springt an. Das Seehaus und seine Gummienten verschwinden hinter dir.",
    lost: "Die Enten haben dich erwischt. Halte Abstand und nutze die Treppe und die Deckung.",
  },
};
function updateStatus(status: Status) {
  const level = LEVELS[status.levelId],
    copy = LEVEL_COPY[status.levelId];
  write("enemy-label", level.enemyLabel);
  write("weapon-name", level.kind === "hippo" ? "KAROTTEN" : level.kind === "robot" ? "RG–4" : level.kind === "cake" ? "INS–6" : "PX–9");
  write("weapon-type", level.kind === "hippo" ? "FÜTTERN" : level.kind === "robot" ? "RAILGUN" : level.kind === "cake" ? "INSULIN-SHOTGUN" : "DIENSTPISTOLE");
  if (lastLevelId !== status.levelId) {
    lastLevelId = status.levelId;
    document.body.dataset.level = status.levelId;
    document.title = `SEKTOR 7 — ${level.name}`;
    write("title-top", copy.title[0]);
    write("title-bottom", copy.title[1]);
    write("station-name", copy.region);
    write(
      "menu-mission",
      `EINSATZ ${String(LEVEL_ORDER.indexOf(status.levelId) + 1).padStart(
        3,
        "0"
      )}`
    );
    $("intro-copy").innerHTML = copy.intro;
    write("caption-label", copy.caption);
    write("caption-code", copy.code);
    LEVEL_ORDER.forEach((key, index) => {
      const el = $(`level-${index + 1}`),
        active = status.levelId === key;
      el.classList.toggle("active", active);
      el.setAttribute("aria-pressed", String(active));
    });
    const url = new URL(location.href);
    url.searchParams.set(
      "level",
      String(LEVEL_ORDER.indexOf(status.levelId) + 1)
    );
    history.replaceState(null, "", url);
  }
  write("health", String(status.health));
  $("health-bar").style.width = `${status.health}%`;
  document
    .querySelector(".health-panel")
    ?.classList.toggle("danger", status.health < 30);
  write("ammo", level.kind === "hippo" ? "∞" : String(status.ammo).padStart(2, "0"));
  write("reserve", level.kind === "hippo" ? "∞" : String(status.reserve).padStart(2, "0"));
  write("kills", String(status.kills).padStart(2, "0"));
  write("enemy-total", String(status.total).padStart(2, "0"));
  write("card-status", copy.inventory[status.hasCard ? 1 : 0]);
  write(
    "objective",
    status.hasCard ? level.objectiveAfter : level.objectiveBefore
  );
  write("location", status.location);
  write("fps", `${status.fps} FPS`);
  write(
    "reload-hint",
    level.kind === "hippo" ? "KLICK · KAROTTE WERFEN · 3 PRO HIPPO" : status.reloading
      ? level.kind === "robot" ? "RAILGUN WIRD GELADEN …" : level.kind === "cake" ? "INSULIN WIRD NACHGELADEN …" : "MAGAZIN WIRD GEWECHSELT …"
      : status.ammo === 0
      ? "R · NACHLADEN"
      : level.kind === "robot"
      ? "RAILGUN · HOCHENERGIE"
      : level.kind === "cake"
      ? "INSULIN · SHOTGUN · 7 SPRITZEN"
      : "9 MM · HALBAUTOMATISCH"
  );
  $("reload-hint").classList.toggle(
    "urgent",
    status.ammo === 0 || status.reloading
  );
  if (status.phase === "transition" && status.nextLevelId) {
    write("transition-level", LEVELS[status.nextLevelId].name);
    write("transition-seconds", String(Math.ceil(status.transitionSeconds)));
    write(
      "transition-stats",
      `${level.name.toUpperCase()} · ${formatTime(status.seconds)} · ${
        status.kills
      }/${status.total} ${level.enemyLabel}`
    );
  }
  if (status.phase !== lastPhase) {
    lastPhase = status.phase;
    show("menu", status.phase === "menu");
    show("hud", status.phase !== "menu");
    show("pause", status.phase === "paused");
    show("level-transition", status.phase === "transition");
    const ended = status.phase === "won" || status.phase === "dead";
    show("result", ended);
    show("hippo-continue", status.phase === "won" && level.kind === "hippo");
    if (ended) {
      const won = status.phase === "won";
      write(
        "result-eyebrow",
        won ? level.kind === "hippo" ? "ALLE HIPPOS SCHLAFEN" : "LETZTER EINSATZ ABGESCHLOSSEN" : "SIGNAL VERLOREN"
      );
      write("result-title", won ? level.kind === "hippo" ? "Gute Nacht." : "Auf und davon." : "Einsatz gescheitert.");
      write("result-copy", won ? copy.won : copy.lost);
      $("result-stats").replaceChildren();
      for (const text of [
        `ZEIT ${formatTime(status.seconds)}`,
        `${level.enemyLabel} ${status.kills}/${status.total}`,
      ]) {
        const span = document.createElement("span");
        span.textContent = text;
        $("result-stats").append(span);
      }
    }
  }
}
function loadSettings() {
  try {
    const settings = JSON.parse(
      localStorage.getItem("sektor7.settings") ?? "{}"
    );
    if (Number.isFinite(settings.sensitivity))
      $("sensitivity").setAttribute(
        "value",
        String(Math.max(0.3, Math.min(2, settings.sensitivity)))
      );
    if (Number.isFinite(settings.volume))
      $("volume").setAttribute(
        "value",
        String(Math.max(0, Math.min(100, settings.volume)))
      );
    if (["low", "high"].includes(settings.quality))
      $<HTMLSelectElement>("quality").value = settings.quality;
    if (typeof settings.showFps === "boolean")
      $<HTMLInputElement>("fps-toggle").checked = settings.showFps;
  } catch {
    /* Storage is optional, including in private browsing. */
  }
}
function applySettings() {
  const sensitivity = Number($<HTMLInputElement>("sensitivity").value),
    volume = Number($<HTMLInputElement>("volume").value),
    quality = $<HTMLSelectElement>("quality").value,
    showFps = $<HTMLInputElement>("fps-toggle").checked;
  if (game) {
    game.sensitivity = sensitivity;
    game.audio.setVolume(volume / 100);
    game.setQuality(quality);
  }
  write("sensitivity-value", sensitivity.toFixed(1));
  write("volume-value", `${volume} %`);
  show("fps", showFps);
  try {
    localStorage.setItem(
      "sektor7.settings",
      JSON.stringify({ sensitivity, volume, quality, showFps })
    );
  } catch {}
}
loadSettings();
const start = $<HTMLButtonElement>("start");
try {
  game = new Game(
    $<HTMLCanvasElement>("game"),
    {
      status: updateStatus,
      notify,
      interaction: (message) => {
        show("interaction", Boolean(message));
        const text = $("interaction").querySelector("span");
        if (text) text.textContent = message;
      },
      hit: () => {
        const marker = $("hit-marker");
        marker.classList.remove("visible");
        void marker.offsetWidth;
        marker.classList.add("visible");
      },
      damage: () => {
        clearTimeout(damageTimer);
        $("damage-flash").style.opacity = ".65";
        damageTimer = setTimeout(
          () => ($("damage-flash").style.opacity = "0"),
          160
        );
      },
    },
    undefined,
    LEVEL_ORDER[
      Number(new URLSearchParams(location.search).get("level")) - 1
    ] ?? "station"
  );
  applySettings();
  const waitForLevel = () => {
    start.disabled = true;
    write("start-label", "LEVEL WIRD GELADEN");
    const scene = game.scene;
    scene.executeWhenReady(() => {
      if (game.scene !== scene) return;
      start.disabled = false;
      write("start-label", "EINSATZ STARTEN");
    });
  };
  waitForLevel();
  LEVEL_ORDER.forEach((key, index) => {
    $(`level-${index + 1}`).addEventListener("click", () => {
      if (game.level.id === key) return;
      game.selectLevel(key);
      waitForLevel();
    });
  });
  for (const id of ["select-level-pause", "select-level-result"])
    $(id).addEventListener("click", () => {
      game.returnToMenu();
      waitForLevel();
    });
  start.addEventListener("click", () => game.start());
  $("resume").addEventListener("click", () => game.resume());
  $("restart").addEventListener("click", () => game.start());
  $("hippo-continue").addEventListener("click", () => { game.selectLevel("office"); game.start(); });
  $("restart-pause").addEventListener("click", () => game.start());
  const openSettings = () => {
    if (game.phase === "playing" || game.phase === "transition") game.pause();
    show("settings", true);
    $("settings-close").focus();
  };
  $("settings-toggle").addEventListener("click", openSettings);
  $("pause-settings").addEventListener("click", openSettings);
  const closeSettings = () => {
    applySettings();
    show("settings", false);
  };
  $("settings-close").addEventListener("click", closeSettings);
  $("settings-done").addEventListener("click", closeSettings);
  for (const id of ["sensitivity", "volume", "quality", "fps-toggle"])
    $(id).addEventListener("input", applySettings);
  document.addEventListener("keydown", (event) => {
    if (
      event.code === "Escape" &&
      !$("settings").classList.contains("hidden")
    ) {
      event.preventDefault();
      closeSettings();
    }
  });
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    // Development/test inspection for browser QA. Not included in production builds.
    Object.assign(window, {
      __SEKTOR7__: { game, state: () => game.diagnostics() },
    });
  }
} catch (error) {
  console.error("SEKTOR 7 could not initialise:", error);
  write(
    "error-copy",
    "Die 3D-Engine konnte nicht starten. Bitte nutze einen aktuellen Desktop-Browser mit aktivierter Hardwarebeschleunigung."
  );
  show("error", true);
}
