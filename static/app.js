// Habit Tracker front-end: talks to the Flask REST API and renders habit cards

const WINDOW = 20; // days shown on each card

// ---------- dates (browser local time) ----------
function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function parseIso(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}
function shortDate(d) {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// ---------- API ----------
async function request(method, url, body) {
    let res;
    try {
        res = await fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (e) {
        throw new Error("Server is not responding");
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (res.status >= 500) {
        throw new Error(method === "GET" ? "Couldn't load habits — database unavailable" : "Couldn't save — database unavailable");
    }
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

const api = {
    list: () => request("GET", "/api/habits"),
    create: name => request("POST", "/api/habits", { name }),
    rename: (id, name) => request("PATCH", `/api/habits/${id}`, { name }),
    remove: id => request("DELETE", `/api/habits/${id}`),
    toggle: (id, day) => request("POST", `/api/habits/${id}/toggle`, { day }),
};

// ---------- stats ----------
function currentStreak(logs) {
    const done = new Set(logs);
    let d = done.has(iso(TODAY)) ? TODAY : addDays(TODAY, -1);
    let n = 0;
    while (done.has(iso(d))) {
        n++;
        d = addDays(d, -1);
    }
    return n;
}

// Days in the last WINDOW days (but not before the habit's first day) and how many are done
function windowFor(habit) {
    const first = [habit.created_at.slice(0, 10), ...habit.logs].sort()[0];
    const windowStart = addDays(TODAY, -(WINDOW - 1));
    const from = parseIso(first) > windowStart ? parseIso(first) : windowStart;
    const days = Math.max(0, Math.round((TODAY - from) / 86400000) + 1);
    const done = habit.logs.filter(d => parseIso(d) >= from && parseIso(d) <= TODAY).length;
    return { days, done };
}

function percent(done, days) {
    return days ? Math.round(done / days * 100) : 0;
}

// ---------- render ----------
let habits = [];
let loadFailed = false;
let firstRender = true;

function renderStats() {
    let sumDone = 0, sumDays = 0, best = 0;
    habits.forEach(h => {
        const w = windowFor(h);
        sumDone += w.done;
        sumDays += w.days;
        best = Math.max(best, currentStreak(h.logs));
    });
    document.getElementById("s-streak").textContent = best;
    document.getElementById("s-done").textContent = percent(sumDone, sumDays) + "%";
    document.getElementById("s-count").textContent = habits.length;
}

function render(popId, popDay) {
    renderStats();
    const box = document.getElementById("cards");
    box.innerHTML = "";

    if (loadFailed || !habits.length) {
        const empty = document.createElement("div");
        empty.className = "panel empty";
        empty.textContent = loadFailed ? "Couldn't load habits — check the database" : "No habits yet — add your first one above";
        box.appendChild(empty);
        return;
    }

    habits.forEach((h, i) => box.appendChild(buildCard(h, i, popId, popDay)));
    firstRender = false;
}

function iconButton(symbol, title, label, extraClass) {
    const b = document.createElement("button");
    b.className = "icon-btn" + (extraClass ? " " + extraClass : "");
    b.textContent = symbol;
    b.title = title;
    b.setAttribute("aria-label", label);
    return b;
}

function buildCard(h, index, popId, popDay) {
    const w = windowFor(h);
    const streak = currentStreak(h.logs);
    const done = new Set(h.logs);

    const card = document.createElement("article");
    card.className = "panel card " + h.color;
    if (firstRender) card.style.setProperty("--i", index + 5);
    else card.style.animation = "none";

    // header: name + rename / delete
    const head = document.createElement("div");
    head.className = "card-head";
    const name = document.createElement("button");
    name.className = "name";
    name.textContent = h.name;
    name.title = "Click to rename";
    const tools = document.createElement("div");
    tools.className = "tools";
    const edit = iconButton("✎", "Rename", "Rename " + h.name);
    const del = iconButton("✕", "Delete", "Delete " + h.name, "del");
    name.onclick = edit.onclick = () => startRename(h, head);
    del.onclick = () => removeHabit(h);
    tools.append(edit, del);
    head.append(name, tools);

    // streak and percent
    const st = document.createElement("div");
    st.className = "streak";
    st.textContent = streak;
    const small = document.createElement("small");
    small.textContent = "day streak";
    st.appendChild(small);

    const meta = document.createElement("div");
    meta.className = "meta";
    const pct = document.createElement("span");
    pct.textContent = percent(w.done, w.days) + "% done";
    const period = document.createElement("span");
    period.textContent = "last 20 days";
    meta.append(pct, period);

    // grid: past days are read-only, only today is clickable
    const cells = document.createElement("div");
    cells.className = "cells";
    for (let k = WINDOW - 1; k >= 0; k--) {
        const day = iso(addDays(TODAY, -k));
        const isToday = k === 0;
        const c = document.createElement(isToday ? "button" : "span");
        c.className = "cell" + (done.has(day) ? " on" : "") + (isToday ? " today" : " past");
        if (popId === h.id && popDay === day) c.classList.add("pop");
        c.title = day + (isToday ? " (today)" : "");
        c.setAttribute("aria-label", h.name + " " + day + (done.has(day) ? " done" : " not done"));
        if (isToday) c.onclick = () => toggle(h, day);
        cells.appendChild(c);
    }

    const range = document.createElement("div");
    range.className = "range";
    const from = document.createElement("span");
    from.textContent = shortDate(addDays(TODAY, -(WINDOW - 1)));
    const to = document.createElement("span");
    to.textContent = "today";
    range.append(from, to);

    const doneToday = done.has(iso(TODAY));
    const doneBtn = document.createElement("button");
    doneBtn.className = "done-btn" + (doneToday ? " on" : "");
    doneBtn.textContent = doneToday ? "✓ Done" : "✓ Done today";
    doneBtn.onclick = () => toggle(h, iso(TODAY));

    card.append(head, st, meta, cells, range, doneBtn);
    return card;
}

// ---------- actions ----------
async function load() {
    try {
        habits = await api.list();
        loadFailed = false;
    } catch (e) {
        loadFailed = true;
        toast(e.message);
    }
    render();
}

async function toggle(h, day) {
    try {
        await api.toggle(h.id, day);
        habits = await api.list();
        render(h.id, day);
    } catch (e) {
        toast(e.message);
    }
}

async function removeHabit(h) {
    if (!confirm('Delete "' + h.name + '"?')) return;
    try {
        await api.remove(h.id);
        habits = await api.list();
        render();
    } catch (e) {
        toast(e.message);
    }
}

function startRename(h, head) {
    const input = document.createElement("input");
    input.className = "name-input";
    input.value = h.name;
    input.maxLength = 100;
    const tools = document.createElement("div");
    tools.className = "tools";
    const save = iconButton("✓", "Save", "Save name");
    const cancel = iconButton("↩", "Cancel", "Cancel rename");
    tools.append(save, cancel);
    head.replaceChildren(input, tools);
    input.focus();
    input.select();

    async function commit() {
        try {
            await api.rename(h.id, input.value);
            habits = await api.list();
        } catch (e) {
            toast(e.message);
        }
        render();
    }
    save.onclick = commit;
    cancel.onclick = () => render();
    input.onkeydown = e => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") render();
    };
}

document.getElementById("add-form").onsubmit = async e => {
    e.preventDefault();
    const input = document.getElementById("add-input");
    try {
        await api.create(input.value);
        input.value = "";
        habits = await api.list();
        loadFailed = false;
        render();
    } catch (err) {
        toast(err.message);
    }
};

async function checkDb() {
    const status = document.getElementById("db-status");
    const dot = document.getElementById("live-dot");
    const live = document.getElementById("live-text");
    status.textContent = "database: checking…";
    status.className = "";
    try {
        const res = await fetch("/health");
        const data = await res.json();
        status.textContent = "database: " + data.db;
        status.className = res.ok ? "ok" : "error";
        dot.className = "dot " + (res.ok ? "ok" : "error");
        live.textContent = res.ok ? "database: connected" : "database: offline";
    } catch (e) {
        status.textContent = "Server is not responding";
        status.className = "error";
        dot.className = "dot error";
        live.textContent = "server offline";
    }
}

let toastTimer;
function toast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

document.getElementById("today-date").textContent =
    TODAY.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

load();
checkDb();
