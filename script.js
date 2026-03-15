const STORAGE_KEY = 'studentSpendingCalculatorData';
const THEME_KEY = 'studentSpendingTheme';

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Study materials',
  'Subscriptions',
  'Entertainment',
  'Other'
];

const dom = {
  incomeInput: document.getElementById('incomeInput'),
  extraIncomeInput: document.getElementById('extraIncomeInput'),
  categoriesContainer: document.getElementById('categoriesContainer'),
  addCategoryButton: document.getElementById('addCategoryButton'),
  resetButton: document.getElementById('resetButton'),
  exportButton: document.getElementById('exportButton'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  totalIncomeDisplay: document.getElementById('totalIncomeDisplay'),
  totalExpensesDisplay: document.getElementById('totalExpensesDisplay'),
  remainingBalanceDisplay: document.getElementById('remainingBalanceDisplay'),
  savingsDisplay: document.getElementById('savingsDisplay'),
  percentSpentDisplay: document.getElementById('percentSpentDisplay'),
  insightsList: document.getElementById('insightsList'),
  categoryTemplate: document.getElementById('categoryTemplate'),
  pieChartCanvas: document.getElementById('pieChart'),
  barChartCanvas: document.getElementById('barChart')
};

let pieChart;
let barChart;

const state = loadState();
initializeTheme();
renderAll();
attachGlobalEvents();

function loadState() {
  const fallback = {
    income: 0,
    extraIncome: 0,
    categories: DEFAULT_CATEGORIES.map((name) => ({
      id: crypto.randomUUID(),
      name,
      amount: 0,
      note: ''
    }))
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return fallback;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.categories)) {
      return fallback;
    }

    const safeCategories = parsed.categories.map((category, index) => ({
      id: category.id || `category-${Date.now()}-${index}`,
      name: String(category.name || `Category ${index + 1}`),
      amount: safeNumber(category.amount),
      note: String(category.note || '')
    }));

    return {
      income: safeNumber(parsed.income),
      extraIncome: safeNumber(parsed.extraIncome),
      categories: safeCategories.length ? safeCategories : fallback.categories
    };
  } catch (error) {
    console.warn('Failed to parse storage data. Using defaults.', error);
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

function attachGlobalEvents() {
  dom.incomeInput.addEventListener('input', (event) => {
    state.income = safeNumber(event.target.value);
    saveAndRefresh();
  });

  dom.extraIncomeInput.addEventListener('input', (event) => {
    state.extraIncome = safeNumber(event.target.value);
    saveAndRefresh();
  });

  dom.addCategoryButton.addEventListener('click', () => {
    const customName = prompt('Enter custom category name:');
    if (!customName) return;

    state.categories.push({
      id: crypto.randomUUID(),
      name: customName.trim() || 'Custom Category',
      amount: 0,
      note: ''
    });
    saveAndRefresh();
  });

  dom.resetButton.addEventListener('click', () => {
    const confirmed = confirm('This will erase all saved data. Continue?');
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    state.income = 0;
    state.extraIncome = 0;
    state.categories = DEFAULT_CATEGORIES.map((name) => ({
      id: crypto.randomUUID(),
      name,
      amount: 0,
      note: ''
    }));
    saveAndRefresh();
  });

  dom.exportButton.addEventListener('click', exportToCSV);

  dom.darkModeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    refreshCharts();
  });
}

function renderAll() {
  dom.incomeInput.value = state.income || '';
  dom.extraIncomeInput.value = state.extraIncome || '';
  renderCategories();
  renderSummary();
  renderInsights();
  refreshCharts();
}

function renderCategories() {
  dom.categoriesContainer.innerHTML = '';

  state.categories.forEach((category) => {
    const fragment = dom.categoryTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.category-item');
    const nameInput = fragment.querySelector('.category-name-input');
    const amountInput = fragment.querySelector('.category-amount');
    const noteInput = fragment.querySelector('.category-note');
    const deleteButton = fragment.querySelector('.delete-category');

    nameInput.value = category.name;
    amountInput.value = category.amount || '';
    noteInput.value = category.note;

    nameInput.addEventListener('input', (event) => {
      category.name = event.target.value.trim() || 'Untitled Category';
      saveAndRefresh(false);
    });

    amountInput.addEventListener('input', (event) => {
      category.amount = safeNumber(event.target.value);
      saveAndRefresh();
    });

    noteInput.addEventListener('input', (event) => {
      category.note = event.target.value;
      saveAndRefresh(false);
    });

    deleteButton.addEventListener('click', () => {
      state.categories = state.categories.filter((entry) => entry.id !== category.id);
      saveAndRefresh();
    });

    item.dataset.categoryId = category.id;
    dom.categoriesContainer.appendChild(fragment);
  });
}

function computeTotals() {
  const totalIncome = safeNumber(state.income) + safeNumber(state.extraIncome);
  const totalExpenses = state.categories.reduce((sum, category) => sum + safeNumber(category.amount), 0);
  const remainingBalance = totalIncome - totalExpenses;
  const savings = Math.max(remainingBalance, 0);
  const spentPercent = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  return { totalIncome, totalExpenses, remainingBalance, savings, spentPercent };
}

function renderSummary() {
  const totals = computeTotals();

  dom.totalIncomeDisplay.textContent = currency(totals.totalIncome);
  dom.totalExpensesDisplay.textContent = currency(totals.totalExpenses);
  dom.remainingBalanceDisplay.textContent = currency(totals.remainingBalance);
  dom.savingsDisplay.textContent = currency(totals.savings);
  dom.percentSpentDisplay.textContent = `${totals.spentPercent.toFixed(1)}%`;

  dom.remainingBalanceDisplay.classList.toggle('text-rose-500', totals.remainingBalance < 0);
  dom.remainingBalanceDisplay.classList.toggle('text-emerald-500', totals.remainingBalance >= 0);
}

function renderInsights() {
  const { totalIncome, totalExpenses, savings } = computeTotals();
  const entries = state.categories
    .map((category) => ({ ...category, share: totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const insights = [];

  if (entries.length > 0 && entries[0].amount > 0) {
    insights.push(`You spent ${entries[0].share.toFixed(1)}% on ${entries[0].name.toLowerCase()} this month.`);
  }

  if (totalIncome > 0) {
    const savingsRate = (savings / totalIncome) * 100;
    insights.push(`Your savings rate is ${savingsRate.toFixed(1)}%.`);
  }

  const entertainment = state.categories.find((category) => category.name.toLowerCase().includes('entertain'));
  if (entertainment && totalIncome > 0) {
    const entertainmentShare = (entertainment.amount / totalIncome) * 100;
    if (entertainmentShare > 20) {
      insights.push('Consider limiting entertainment spending to stay on budget.');
    }
  }

  if (totalExpenses > totalIncome && totalIncome > 0) {
    insights.push('Warning: your spending is higher than your income.');
  }

  if (!insights.length) {
    insights.push('Start entering expenses to generate personalized insights.');
  }

  dom.insightsList.innerHTML = insights.map((text) => `<li class="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">• ${text}</li>`).join('');
}

function chartColors() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    text: dark ? '#e2e8f0' : '#334155',
    grid: dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.35)',
    palette: ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
  };
}

function refreshCharts() {
  const { totalIncome, totalExpenses } = computeTotals();
  const colors = chartColors();

  const labels = state.categories.map((category) => category.name);
  const amounts = state.categories.map((category) => safeNumber(category.amount));

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(dom.pieChartCanvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data: amounts,
          backgroundColor: labels.map((_, index) => colors.palette[index % colors.palette.length])
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: colors.text
          }
        }
      }
    }
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(dom.barChartCanvas, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [
        {
          label: 'Amount',
          data: [totalIncome, totalExpenses],
          backgroundColor: ['#10b981', '#f43f5e'],
          borderRadius: 10
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: colors.text },
          grid: { color: colors.grid }
        },
        x: {
          ticks: { color: colors.text },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: colors.text
          }
        }
      }
    }
  });
}

function exportToCSV() {
  const { totalIncome, totalExpenses, remainingBalance, savings, spentPercent } = computeTotals();
  const rows = [
    ['Metric', 'Value'],
    ['Income', totalIncome],
    ['Extra Income', state.extraIncome],
    ['Total Expenses', totalExpenses],
    ['Remaining Balance', remainingBalance],
    ['Savings', savings],
    ['Percent Spent', `${spentPercent.toFixed(2)}%`],
    [],
    ['Category', 'Amount', 'Note']
  ];

  state.categories.forEach((category) => {
    rows.push([category.name, category.amount, category.note.replaceAll('"', '""')]);
  });

  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-spending-data.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}

function saveAndRefresh(fullRender = true) {
  saveState();

  if (fullRender) {
    renderAll();
    return;
  }

  renderSummary();
  renderInsights();
  refreshCharts();
}
