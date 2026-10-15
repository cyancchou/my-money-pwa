(() => {
  "use strict";
  const STORAGE_KEY = "my-money-planner-v1";
  const defaults = [
    { id: "longTerm", name: "長期存款", amount: 3000, icon: "▤", desc: "長期累積，盡量不動用", savings: true },
    { id: "bank", name: "額外銀行存款", amount: 2000, icon: "▥", desc: "額外存入銀行", savings: true },
    { id: "investment", name: "投資", amount: 1000, icon: "↗", desc: "投資預算，依自己的計畫投入", savings: true },
    { id: "personal", name: "私人生活費", amount: 4000, icon: "♡", desc: "約會、購物、娛樂", savings: false },
    { id: "emergency", name: "緊急預備金", amount: 1000, icon: "◇", desc: "應付突發必要支出", savings: true },
    { id: "goals", name: "未來目標基金", amount: 1250, icon: "☆", desc: "旅遊、演唱會、相機", savings: true },
    { id: "living", name: "補生活費", amount: 2000, icon: "⌂", desc: "轉入日常生活費帳戶", savings: false }
  ];
  const $ = (id) => document.getElementById(id);
  const els = {
    prev: $("prevMonth"), next: $("nextMonth"), thisMonth: $("thisMonth"),
    monthYear: $("monthYear"), monthNumber: $("monthNumber"), salary: $("salary"),
    customMode: $("customMode"), allocationHint: $("allocationHint"),
    savedAmount: $("savedAmount"), progressPercent: $("progressPercent"),
    progressNumbers: $("progressNumbers"), progressBar: $("progressBar"),
    progressRemaining: $("progressRemaining"), budgetList: $("budgetList"),
    summarySavings: $("summarySavings"), summaryGoals: $("summaryGoals"),
    summaryInvest: $("summaryInvest"), summaryPersonal: $("summaryPersonal"),
    allocatedTotal: $("allocatedTotal"), unallocated: $("unallocated"),
    balanceMessage: $("balanceMessage"), notes: $("notes"), toast: $("toast"),
    exportData: $("exportData"), importFile: $("importFile")
  };
  let db = loadDB();
  let month = currentMonthKey();
  let toastTimer;

  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function formatMoney(n) {
    return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
  }
  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.months && typeof parsed.months === "object") return parsed;
      }
    } catch (e) { console.warn("Could not load saved data", e); }
    return { version: 1, months: {} };
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      showToast("無法儲存，請檢查瀏覽器儲存空間");
      return false;
    }
  }
  function initialMonth() {
    return {
      salary: 14250,
      customMode: false,
      amounts: Object.fromEntries(defaults.map(c => [c.id, c.amount])),
      savedAmount: 0,
      notes: ""
    };
  }
  function getMonthData() {
    if (!db.months[month]) db.months[month] = initialMonth();
    const data = db.months[month];
    if (!data.amounts) data.amounts = Object.fromEntries(defaults.map(c => [c.id, c.amount]));
    defaults.forEach(c => { if (!Number.isFinite(Number(data.amounts[c.id]))) data.amounts[c.id] = c.amount; });
    if (!Number.isFinite(Number(data.salary))) data.salary = 14250;
    if (!Number.isFinite(Number(data.savedAmount))) data.savedAmount = 0;
    if (typeof data.notes !== "string") data.notes = "";
    return data;
  }
  function saveCurrentField(field, value) {
    const data = getMonthData();
    data[field] = value;
    persist();
  }
  function allocate(data) {
    const salary = Math.max(0, Math.round(Number(data.salary) || 0));
    if (data.customMode) return Object.fromEntries(defaults.map(c => [c.id, Math.max(0, Math.round(Number(data.amounts[c.id]) || 0))]));
    const totalBase = defaults.reduce((sum, c) => sum + c.amount, 0);
    let used = 0;
    const amounts = {};
    defaults.forEach((c, i) => {
      const amount = i === defaults.length - 1 ? salary - used : Math.round(salary * c.amount / totalBase);
      amounts[c.id] = amount;
      used += amount;
    });
    return amounts;
  }
  function render() {
    const data = getMonthData();
    const [year, mm] = month.split("-").map(Number);
    els.monthYear.textContent = `${year} 年`;
    els.monthNumber.textContent = `${mm} 月`;
    els.salary.value = data.salary;
    els.customMode.checked = !!data.customMode;
    els.savedAmount.value = data.savedAmount;
    els.notes.value = data.notes;
    const amounts = allocate(data);
    const total = Object.values(amounts).reduce((sum, n) => sum + n, 0);
    const salary = Math.max(0, Math.round(Number(data.salary) || 0));
    const get = id => amounts[id] || 0;
    els.summarySavings.textContent = formatMoney(get("longTerm") + get("bank") + get("emergency"));
    els.summaryGoals.textContent = formatMoney(get("goals"));
    els.summaryInvest.textContent = formatMoney(get("investment"));
    els.summaryPersonal.textContent = formatMoney(get("personal"));
    els.allocatedTotal.textContent = formatMoney(total);
    const difference = salary - total;
    els.unallocated.textContent = formatMoney(difference);
    els.unallocated.style.color = difference === 0 ? "var(--green-dark)" : "#9b694a";
    els.balanceMessage.textContent = difference === 0 ? "預算總額與薪水一致。" : difference > 0 ? `還有 ${formatMoney(difference)} 尚未分配。` : `預算超出薪水 ${formatMoney(Math.abs(difference))}，請調整金額。`;
    els.allocationHint.textContent = data.customMode ? "目前為自訂模式，請確認分配總額與薪水一致。" : "預設分配會依薪水按比例換算，總額與薪水一致。";
    const goal = get("longTerm") + get("bank") + get("investment") + get("emergency") + get("goals");
    const saved = Math.max(0, Number(data.savedAmount) || 0);
    const progress = goal > 0 ? Math.min(100, Math.round(saved / goal * 100)) : 0;
    els.progressPercent.textContent = `${progress}%`;
    els.progressNumbers.textContent = `${formatMoney(saved)} / ${formatMoney(goal)}`;
    els.progressBar.style.width = `${progress}%`;
    els.progressRemaining.textContent = saved >= goal ? "本月目標已達成，做得好！" : `距離本月目標還差 ${formatMoney(goal - saved)}。`;
    els.budgetList.innerHTML = "";
    defaults.forEach(c => {
      const amount = get(c.id);
      const pct = salary > 0 ? Math.min(100, amount / salary * 100) : 0;
      const card = document.createElement("article");
      card.className = "budget-item card";
      const main = document.createElement("div");
      main.className = "budget-main";
      const icon = document.createElement("div");
      icon.className = "category-icon";
      icon.textContent = c.icon;
      const text = document.createElement("div");
      text.className = "category-text";
      const title = document.createElement("strong");
      title.textContent = c.name;
      const desc = document.createElement("small");
      desc.textContent = c.desc;
      text.append(title, desc);
      const amountBox = document.createElement("div");
      amountBox.className = "category-amount";
      if (data.customMode) {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.inputMode = "numeric";
        input.setAttribute("aria-label", c.name + "預算金額");
        input.value = amount;
        input.addEventListener("change", () => {
          const current = getMonthData();
          current.amounts[c.id] = Math.max(0, Math.round(Number(input.value) || 0));
          persist(); render();
        });
        amountBox.appendChild(input);
      } else {
        const strong = document.createElement("strong");
        strong.textContent = formatMoney(amount);
        const small = document.createElement("small");
        small.textContent = `${salary > 0 ? (amount / salary * 100).toFixed(1) : "0.0"}%`;
        amountBox.append(strong, small);
      }
      main.append(icon, text, amountBox);
      const track = document.createElement("div");
      track.className = "item-track";
      const bar = document.createElement("div");
      bar.className = "item-bar";
      bar.style.width = `${pct}%`;
      track.appendChild(bar);
      card.append(main, track);
      els.budgetList.appendChild(card);
    });
  }
  function changeMonth(delta) {
    const [year, mm] = month.split("-").map(Number);
    const d = new Date(year, mm - 1 + delta, 1);
    month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    render();
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2300);
  }
  els.prev.addEventListener("click", () => changeMonth(-1));
  els.next.addEventListener("click", () => changeMonth(1));
  els.thisMonth.addEventListener("click", () => { month = currentMonthKey(); render(); });
  els.salary.addEventListener("change", () => {
    const data = getMonthData();
    data.salary = Math.max(0, Math.round(Number(els.salary.value) || 0));
    persist(); render();
  });
  els.customMode.addEventListener("change", () => {
    const data = getMonthData();
    if (els.customMode.checked && !data.customMode) data.amounts = allocate(data);
    data.customMode = els.customMode.checked;
    persist(); render();
  });
  els.savedAmount.addEventListener("change", () => {
    saveCurrentField("savedAmount", Math.max(0, Math.round(Number(els.savedAmount.value) || 0)));
    render();
  });
  els.notes.addEventListener("input", () => {
    const data = getMonthData();
    data.notes = els.notes.value;
    persist();
  });
  els.exportData.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-money-planner-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("已匯出備份檔");
  });
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !parsed.months || typeof parsed.months !== "object") throw new Error("invalid");
      if (!confirm("匯入備份會取代目前這個 App 的所有本機資料。確定要繼續嗎？")) return;
      db = parsed; persist(); render(); showToast("備份匯入成功");
    } catch (e) { showToast("檔案格式不正確，無法匯入"); }
    finally { els.importFile.value = ""; }
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("Service worker registration failed", err));
    });
  }
  if (!db.months[month]) {
    db.months[month] = initialMonth();
    persist();
  }
  render();
})();