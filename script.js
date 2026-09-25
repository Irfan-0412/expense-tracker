/* ============================================
   BLOOM — Personal Expense Tracker
   All data lives in localStorage. No backend.
   ============================================ */

const STORAGE_KEYS = {
  expenses: "bloom.expenses",
  budget: "bloom.budget",
};

const CATEGORIES = [
  { name: "Food", color: "var(--tangerine)", emoji: "🍔" },
  { name: "Travel", color: "var(--violet)", emoji: "🚌" },
  { name: "Education", color: "var(--green)", emoji: "📚" },
  { name: "Shopping", color: "var(--pink)", emoji: "🛍️" },
  { name: "Bills", color: "var(--yellow)", emoji: "💡" },
  { name: "Other", color: "var(--teal)", emoji: "✨" },
];

const RING_RADIUS = 78;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* -------- state -------- */
let expenses = loadExpenses();
let budget = loadBudget();
let editingId = null;
let searchTerm = "";
let filterCategory = "all";

/* -------- elements -------- */
const el = {
  budgetForm: document.getElementById("budgetForm"),
  budgetInput: document.getElementById("budgetInput"),
  expenseForm: document.getElementById("expenseForm"),
  descInput: document.getElementById("descInput"),
  amountInput: document.getElementById("amountInput"),
  dateInput: document.getElementById("dateInput"),
  categoryChips: document.getElementById("categoryChips"),
  formError: document.getElementById("formError"),
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  expenseList: document.getElementById("expenseList"),
  emptyState: document.getElementById("emptyState"),
  listHeader: document.querySelector(".list-header"),
  ringFill: document.getElementById("ringFill"),
  percentSpent: document.getElementById("percentSpent"),
  budgetValue: document.getElementById("budgetValue"),
  spentValue: document.getElementById("spentValue"),
  remainingValue: document.getElementById("remainingValue"),
  remainingPill: document.querySelector(".stat-pill.remaining"),
};

/* -------- storage -------- */
function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.expenses);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveExpenses() {
  localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
}
function loadBudget() {
  const raw = localStorage.getItem(STORAGE_KEYS.budget);
  const n = raw ? parseFloat(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}
function saveBudget() {
  localStorage.setItem(STORAGE_KEYS.budget, String(budget));
}

/* -------- helpers -------- */
function formatCurrency(n) {
  return (
    "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
  );
}
function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y.slice(2)}`;
}
function categoryInfo(name) {
  return (
    CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1]
  );
}
function makeId() {
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/* -------- build static pieces -------- */
function renderCategoryChips() {
  el.categoryChips.innerHTML = CATEGORIES.map(
    (c, i) => `
    <input type="radio" name="category" id="cat-${c.name}" value="${c.name}" ${i === 0 ? "checked" : ""} />
    <label for="cat-${c.name}" style="--chip-color:${c.color}">${c.emoji} ${c.name}</label>
  `,
  ).join("");
}
function renderCategoryFilterOptions() {
  el.categoryFilter.innerHTML =
    `<option value="all">All categories</option>` +
    CATEGORIES.map(
      (c) => `<option value="${c.name}">${c.emoji} ${c.name}</option>`,
    ).join("");
}

/* -------- stats + ring -------- */
function renderStats() {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget - total;
  const percent = budget > 0 ? (total / budget) * 100 : 0;
  const clampedPercent = Math.min(percent, 100);

  el.budgetValue.textContent = formatCurrency(budget);
  el.spentValue.textContent = formatCurrency(total);
  el.remainingValue.textContent = formatCurrency(remaining);
  el.percentSpent.textContent = Math.round(percent) + "%";

  el.remainingPill.classList.toggle("over", remaining < 0);

  const offset =
    RING_CIRCUMFERENCE - (clampedPercent / 100) * RING_CIRCUMFERENCE;
  el.ringFill.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.ringFill.style.strokeDashoffset = String(offset);

  let ringColor = "var(--green)";
  if (percent >= 100) ringColor = "var(--alert)";
  else if (percent >= 75) ringColor = "var(--yellow)";
  el.ringFill.style.stroke = ringColor;
}

/* -------- list rendering -------- */
function getFilteredExpenses() {
  return expenses
    .filter((e) => filterCategory === "all" || e.category === filterCategory)
    .filter((e) =>
      e.description.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt,
    );
}

function renderList() {
  const list = getFilteredExpenses();
  el.listHeader.style.display = list.length ? "" : "none";
  el.emptyState.hidden = list.length !== 0;

  el.expenseList.innerHTML = list
    .map((exp) => {
      const info = categoryInfo(exp.category);
      if (exp.id === editingId) return editRowTemplate(exp);
      return `
      <li class="expense-item" style="--item-color:${info.color}" data-id="${exp.id}">
        <span class="item-desc">${escapeHTML(exp.description)}</span>
        <span class="item-chip">${info.emoji} ${exp.category}</span>
        <span class="item-amount">${formatCurrency(exp.amount)}</span>
        <span class="item-date">${formatDate(exp.date)}</span>
        <span class="item-actions">
          <button type="button" class="edit-btn" title="Edit" aria-label="Edit expense">✎</button>
          <button type="button" class="delete-btn" title="Delete" aria-label="Delete expense">🗑</button>
        </span>
      </li>`;
    })
    .join("");
}

function editRowTemplate(exp) {
  const categoryOptions = CATEGORIES.map(
    (c) =>
      `<option value="${c.name}" ${c.name === exp.category ? "selected" : ""}>${c.emoji} ${c.name}</option>`,
  ).join("");
  return `
    <li class="expense-item editing" data-id="${exp.id}">
      <div class="edit-row">
        <input type="text" class="edit-desc" value="${escapeHTML(exp.description)}" maxlength="60" />
        <input type="number" class="edit-amount" value="${exp.amount}" min="0.01" step="0.01" />
        <select class="edit-category">${categoryOptions}</select>
        <input type="date" class="edit-date" value="${exp.date}" />
      </div>
      <div class="edit-actions">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="button" class="save-btn">Save</button>
      </div>
    </li>`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  renderStats();
  renderList();
}

/* -------- form: add expense -------- */
el.expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const description = el.descInput.value.trim();
  const amount = parseFloat(el.amountInput.value);
  const date = el.dateInput.value || todayISO();
  const categoryInput = el.categoryChips.querySelector(
    'input[name="category"]:checked',
  );
  const category = categoryInput ? categoryInput.value : CATEGORIES[0].name;

  if (!description) {
    el.formError.textContent = "Please add a short description.";
    el.descInput.focus();
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    el.formError.textContent = "Amount must be a number greater than 0.";
    el.amountInput.focus();
    return;
  }

  el.formError.textContent = "";
  expenses.push({
    id: makeId(),
    description,
    amount,
    category,
    date,
    createdAt: Date.now(),
  });
  saveExpenses();
  el.expenseForm.reset();
  el.dateInput.value = todayISO();
  renderAll();
});

/* -------- form: set budget -------- */
el.budgetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = parseFloat(el.budgetInput.value);
  if (!Number.isFinite(value) || value < 0) return;
  budget = value;
  saveBudget();
  renderStats();
});

/* -------- search + filter -------- */
el.searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderList();
});
el.categoryFilter.addEventListener("change", (e) => {
  filterCategory = e.target.value;
  renderList();
});

/* -------- list actions (edit / delete / save / cancel) -------- */
el.expenseList.addEventListener("click", (e) => {
  const li = e.target.closest(".expense-item");
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.closest(".delete-btn")) {
    if (confirm("Delete this expense?")) {
      expenses = expenses.filter((x) => x.id !== id);
      saveExpenses();
      renderAll();
    }
    return;
  }

  if (e.target.closest(".edit-btn")) {
    editingId = id;
    renderList();
    return;
  }

  if (e.target.closest(".cancel-btn")) {
    editingId = null;
    renderList();
    return;
  }

  if (e.target.closest(".save-btn")) {
    const desc = li.querySelector(".edit-desc").value.trim();
    const amount = parseFloat(li.querySelector(".edit-amount").value);
    const category = li.querySelector(".edit-category").value;
    const date = li.querySelector(".edit-date").value;

    if (!desc || !Number.isFinite(amount) || amount <= 0 || !date) {
      alert("Please fill in a valid description, amount and date.");
      return;
    }

    const target = expenses.find((x) => x.id === id);
    if (target) {
      target.description = desc;
      target.amount = amount;
      target.category = category;
      target.date = date;
    }
    saveExpenses();
    editingId = null;
    renderAll();
  }
});

/* -------- init -------- */
function init() {
  renderCategoryChips();
  renderCategoryFilterOptions();
  el.dateInput.value = todayISO();
  el.budgetInput.value = budget || "";
  renderAll();
}

init();
