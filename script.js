console.log("Dashboard script loaded");

let chartMode = "monthly";

let selectedMonth = null;

let salesChartInstance = null;

// =========================
// DATA MANAGEMENT (NEW)
// =========================

let originalData = [];  // Оригінальні дані
let salesData = [];     // Активні дані

// =========================
// MODAL & EXPORT FUNCTIONS
// =========================

function openModal() {

    const modal = document.getElementById("exportModal");

    modal.classList.remove("hidden");

    document.body.classList.add("modal-open");
}

function closeModal() {

    const modal = document.getElementById("exportModal");

    const modalBox = document.querySelector(".modal-box");

    // Remove loading state if exists
    modalBox.classList.remove("loading");

    modal.classList.add("hidden");

    document.body.classList.remove("modal-open");
}

async function exportCurrentViewToPDF() {

    const modal = document.querySelector(".modal-box");

    const confirmBtn = document.getElementById("confirmExport");

    modal.classList.add("loading");

    confirmBtn.disabled = true;

    // Create a container for the dashboard snapshot
    const dashboardContainer = document.querySelector(".dashboard");
    const tableSection = document.querySelector(".table-section");
    const previousTableDisplay = tableSection ? tableSection.style.display : "";

    try {
        if (tableSection) {
            tableSection.style.display = "none";
        }

        const body = document.body;
        const originalBodyBg = body.style.backgroundColor;
        const originalDashboardBg = dashboardContainer.style.backgroundColor;
        const exportBg = "#0f172a";

        body.style.backgroundColor = exportBg;
        dashboardContainer.style.backgroundColor = exportBg;

        const canvas = await html2canvas(dashboardContainer, {
            allowTaint: true,
            useCORS: true,
            scale: 2,
            logging: false,
            backgroundColor: exportBg
        });

        // Create PDF
        const { jsPDF } = window.jspdf;

        const imgData = canvas.toDataURL("image/png");

        const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
        const pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

        // Generate timestamp
        const now = new Date();

        const timestamp = now.toISOString().slice(0, 10) + "_" + 

                         now.getHours().toString().padStart(2, '0') + "-" +

                         now.getMinutes().toString().padStart(2, '0');

        const filename = `dashboard-current-view_${timestamp}.pdf`;

        pdf.save(filename);

        // Close modal
        setTimeout(() => {

            closeModal();

            confirmBtn.disabled = false;

        }, 500);

    } catch (error) {

        console.error("Error exporting PDF:", error);

        alert("Помилка при експорті PDF. Спробуйте ще раз.");

        modal.classList.remove("loading");

        confirmBtn.disabled = false;

    } finally {

        if (tableSection) {
            tableSection.style.display = previousTableDisplay;
        }

        document.body.style.backgroundColor = originalBodyBg;
        dashboardContainer.style.backgroundColor = originalDashboardBg;
    }
}

// =========================
// DATA VARIABLES
// =========================

let filteredData = [];
let contextData = [];
let categoryChartInstance = null;
let topProductsChartInstance = null;
let regionChartInstance = null;
let paymentChartInstance = null;
let filterTimeout = null;
let selectedProductName = null;
let productList = [];
const monthLabels = [
    "January 2025",
    "February 2025",
    "March 2025",
    "April 2025",
    "May 2025",
    "June 2025",
    "July 2025",
    "August 2025",
    "September 2025",
    "October 2025",
    "November 2025",
    "December 2025"
];

function formatMonthYear(dateString) {
    return new Date(dateString).toLocaleString("en-US", {
        month: "long",
        year: "numeric"
    });
}

function getProductList() {
    return [...new Set(salesData.map(item => item.product))]
        .sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }));
}

function populateProductList() {
    productList = getProductList();
}

function showProductSuggestions(items) {
    const suggestions = document.getElementById("productSuggestions");
    suggestions.innerHTML = "";

    if (!items.length) {
        suggestions.innerHTML = `<div class="suggestion-empty">Нічого не знайдено</div>`;
        suggestions.classList.remove("hidden");
        return;
    }

    items.forEach(product => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.textContent = product;
        item.addEventListener("click", () => {
            selectProduct(product);
        });
        suggestions.appendChild(item);
    });

    suggestions.classList.remove("hidden");
}

function hideProductSuggestions() {
    const suggestions = document.getElementById("productSuggestions");
    suggestions.classList.add("hidden");
}

function selectProduct(product) {
    const input = document.getElementById("productSearch");
    input.value = product;
    selectedProductName = product;
    hideProductSuggestions();
    applyFilters();
}

function handleProductSearchInput() {
    const input = document.getElementById("productSearch");
    const query = input.value.trim();

    if (!query) {
        selectedProductName = null;
        hideProductSuggestions();
        applyFilters();
        return;
    }

    if (selectedProductName && query !== selectedProductName) {
        selectedProductName = null;
        applyFilters();
    }

    const normalizedQuery = query.toLowerCase();
    const matches = productList.filter(product =>
        product.toLowerCase().includes(normalizedQuery)
    );

    showProductSuggestions(matches);
}

function scheduleFilterUpdate() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(applyFilters, 250);
}

function getCurrentData() {
    return contextData.length ? contextData : filteredData;
}

function resetContext() {
    contextData = [];
    chartMode = "monthly";
    selectedMonth = null;
}

function calculateTrend(currentValue, previousValue) {

    if (!selectedMonth || previousValue === 0) {
        return {
            text: "-",
            className: "neutral"
        };
    }

    const diff = ((currentValue - previousValue) / previousValue) * 100;

    if (diff > 0) {
        return {
            text: `↑ ${diff.toFixed(1)}%`,
            className: "up"
        };
    }

    if (diff < 0) {
        return {
            text: `↓ ${Math.abs(diff).toFixed(1)}%`,
            className: "down"
        };
    }

    return {
        text: "0%",
        className: "neutral"
    };
}

// =========================
// LOAD INITIAL DATA
// =========================

// Завантаження JSON
fetch('data/sales.json')
    .then(response => response.json())
    .then(data => {
        originalData = data;      // Зберігаємо оригінальні дані
        salesData = data;         // Встановлюємо активні дані
        filteredData = data;

        console.log("Data loaded:", salesData);

        // Після завантаження запускаємо систему
        initDashboard();
    })
    .catch(error => {
        console.error("Error loading data:", error);
    });


// =========================
// JSON UPLOAD FUNCTIONS (NEW)
// =========================

/**
 * Перевіряє структуру JSON об'єкту
 */
function validateDataStructure(data) {
    // Перевірка чи це масив
    if (!Array.isArray(data)) {
        return false;
    }

    // Перевірка кожного об'єкту
    const requiredFields = ["order_id", "date", "product", "category", "price", "quantity", "region", "payment_method"];

    return data.every(item => {
        return requiredFields.every(field => field in item);
    });
}

/**
 * Показує error modal
 */
function showErrorModal(title, message) {
    document.getElementById("errorTitle").textContent = title;
    document.getElementById("errorMessage").textContent = message;
    document.getElementById("errorModal").classList.remove("hidden");
}

/**
 * Закривает error modal
 */
function closeErrorModal() {
    document.getElementById("errorModal").classList.add("hidden");
    document.body.classList.remove("modal-open");
}

/**
 * Обработка завантаження файлу
 */
function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            // Парсим JSON
            const parsedData = JSON.parse(e.target.result);

            // Валідуємо структуру
            if (!validateDataStructure(parsedData)) {
                showErrorModal(
                    "Структура файлу некоректна",
                    "JSON має містити масив об'єктів з полями: order_id, date, product, category, price, quantity, region, payment_method"
                );
                document.getElementById("fileInput").value = "";
                return;
            }

            // Встановлюємо нові дані
            salesData = parsedData;
            filteredData = parsedData;

            // Скидаємо контекст
            resetContext();

            // Очищаємо фільтри
            document.getElementById("categoryFilter").value = "all";
            document.getElementById("startDate").value = "";
            document.getElementById("endDate").value = "";
            document.getElementById("productSearch").value = "";
            selectedProductName = null;

            // Перезавантажуємо фільтри з новими категоріями
            setupFilters();
            populateProductList();

            // Оновлюємо dashboard
            updateDashboard();

            console.log("Custom dataset loaded successfully:", file.name);

            // Очищаємо input
            document.getElementById("fileInput").value = "";

        } catch (error) {
            if (error instanceof SyntaxError) {
                showErrorModal(
                    "Невірний формат JSON",
                    "Файл не являється валідним JSON. Перевірте синтаксис."
                );
            } else {
                showErrorModal(
                    "Помилка при завантаженні",
                    error.message
                );
            }
            document.getElementById("fileInput").value = "";
        }
    };

    reader.onerror = function () {
        showErrorModal(
            "Помилка читання файлу",
            "Не вдалося прочитати файл. Спробуйте ще раз."
        );
        document.getElementById("fileInput").value = "";
    };

    reader.readAsText(file);
}

/**
 * Скидає dataset до оригіналу
 */
function resetDataset() {
    salesData = [...originalData];  // Копіюємо оригінальні дані
    filteredData = [...originalData];

    // Скидаємо контекст
    resetContext();

    // Скидаємо фільтри
    document.getElementById("categoryFilter").value = "all";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("productSearch").value = "";
    selectedProductName = null;

    // Оновлюємо dashboard
    updateDashboard();

    console.log("Dataset reset to original");
}


// =========================
// 2. INIT DASHBOARD
// =========================

function initDashboard() {

    console.log("Dashboard initialized");

    setupFilters();
    populateProductList();
    setupEventListeners();

    calculateStats();
    renderTable();

    renderSalesChart();
    renderCategoryChart();
    renderTopProductsChart();
    renderRegionChart();
    renderPaymentChart();
}


// =========================
// 3. CALCULATE STATS (поки базово)
// =========================

function calculateStats() {

    const data = getCurrentData();

    let totalRevenue = 0;
    let totalQuantity = 0;

    let productSales = {};
    let categorySales = {};

    let previousRevenue = 0;
    let previousOrders = 0;
    let previousProducts = 0;
    let previousAvg = 0;

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const revenue = item.price * item.quantity;

        totalRevenue += revenue;
        totalQuantity += item.quantity;

        productSales[item.product] = (productSales[item.product] || 0) + revenue;
        categorySales[item.category] = (categorySales[item.category] || 0) + revenue;
    }

    const averageOrder = data.length > 0 ? totalRevenue / data.length : 0;

    if (selectedMonth) {
        const currentIndex = monthLabels.indexOf(selectedMonth);

        if (currentIndex > 0) {
            const previousMonth = monthLabels[currentIndex - 1];
            const filtered = filteredData;

            for (let i = 0, len = filtered.length; i < len; i++) {
                const item = filtered[i];
                const month = formatMonthYear(item.date);

                if (month !== previousMonth) {
                    continue;
                }

                const revenue = item.price * item.quantity;
                previousRevenue += revenue;
                previousOrders += 1;
                previousProducts += item.quantity;
            }

            previousAvg = previousOrders > 0 ? previousRevenue / previousOrders : 0;
        }
    }

    let topProduct = "-";
    if (Object.keys(productSales).length > 0) {
        topProduct = Object.keys(productSales).reduce((a, b) =>
            productSales[a] > productSales[b] ? a : b
        );
    }

    let topCategory = "-";
    if (Object.keys(categorySales).length > 0) {
        topCategory = Object.keys(categorySales).reduce((a, b) =>
            categorySales[a] > categorySales[b] ? a : b
        );
    }

    document.getElementById("totalRevenue").textContent =
        "$" + totalRevenue.toFixed(2);

    document.getElementById("totalOrders").textContent =
        data.length;

    document.getElementById("totalProducts").textContent =
        totalQuantity;

    document.getElementById("avgOrder").textContent =
        "$" + averageOrder.toFixed(2);

    document.getElementById("topCategory").textContent =
        topCategory;

    document.getElementById("bestProduct").textContent =
        topProduct;

    // =========================
    // KPI TRENDS
    // =========================

    const revenueTrend =
        calculateTrend(totalRevenue, previousRevenue);

    const ordersTrend =
        calculateTrend(data.length, previousOrders);

    const productsTrend =
        calculateTrend(totalQuantity, previousProducts);

    const avgTrend =
        calculateTrend(averageOrder, previousAvg);

    // Revenue
    const revenueTrendEl =
        document.getElementById("revenueTrend");

    revenueTrendEl.textContent = revenueTrend.text;
    revenueTrendEl.className =
        `trend ${revenueTrend.className}`;

    // Orders
    const ordersTrendEl =
        document.getElementById("ordersTrend");

    ordersTrendEl.textContent = ordersTrend.text;
    ordersTrendEl.className =
        `trend ${ordersTrend.className}`;

    // Products
    const productsTrendEl =
        document.getElementById("productsTrend");

    productsTrendEl.textContent = productsTrend.text;
    productsTrendEl.className =
        `trend ${productsTrend.className}`;

    // Avg
    const avgTrendEl =
        document.getElementById("avgTrend");

    avgTrendEl.textContent = avgTrend.text;
    avgTrendEl.className =
        `trend ${avgTrend.className}`;
}




// =========================
// 4. RENDER TABLE
// =========================

function renderTable() {
    const tableBody = document.getElementById("salesTableBody");
    const data = getCurrentData();
    let html = "";

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const total = item.price * item.quantity;

        html += `
            <tr>
                <td>${item.date}</td>
                <td>${item.product}</td>
                <td>${item.category}</td>
                <td>$${item.price}</td>
                <td>${item.quantity}</td>
                <td>$${total}</td>
            </tr>
        `;
    }

    tableBody.innerHTML = html;
}


// =========================
// 5. RENDER TABLE
// =========================
function renderSalesChart() {

    const ctx = document
        .getElementById("salesLineChart")
        .getContext("2d");

    const titleEl = document.getElementById("chartTitle");
    const backButton = document.getElementById("backButton");

    let labels = [];
    let values = [];

    const data = getCurrentData();

    if (chartMode === "monthly") {
        titleEl.innerText = "Продажі по місяцях";
        backButton.style.display = "none";

        const salesByMonth = {};
        for (let i = 0, len = monthLabels.length; i < len; i++) {
            salesByMonth[monthLabels[i]] = 0;
        }

        for (let i = 0, len = data.length; i < len; i++) {
            const item = data[i];
            const total = item.price * item.quantity;
            const month = formatMonthYear(item.date);
            if (month in salesByMonth) {
                salesByMonth[month] += total;
            }
        }

        labels = monthLabels;
        values = monthLabels.map(m => salesByMonth[m]);
    } else {
        titleEl.innerText = selectedMonth;
        backButton.style.display = "block";

        const currentIndex = monthLabels.indexOf(selectedMonth);
        const year = selectedMonth.split(" ")[1];
        const daysInMonth = new Date(parseInt(year, 10), currentIndex + 1, 0).getDate();
        const salesByDay = {};

        for (let i = 1; i <= daysInMonth; i++) {
            salesByDay[i] = 0;
        }

        for (let i = 0, len = data.length; i < len; i++) {
            const item = data[i];
            const saleMonth = formatMonthYear(item.date);

            if (saleMonth !== selectedMonth) {
                continue;
            }

            const date = new Date(item.date);
            const day = date.getDate();
            salesByDay[day] += item.price * item.quantity;
        }

        labels = Object.keys(salesByDay);
        values = Object.values(salesByDay);
    }

    if (salesChartInstance) {
        salesChartInstance.data.labels = labels;
        salesChartInstance.data.datasets[0].data = values;
        salesChartInstance.update();
        return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(78,115,223,0.35)");
    gradient.addColorStop(1, "rgba(78,115,223,0)");

    salesChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Дохід",
                data: values,
                borderColor: "#4e73df",
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#4e73df",
                pointBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (chartMode === "monthly" && elements.length > 0) {
                    const index = elements[0].index;
                    selectedMonth = labels[index];
                    chartMode = "daily";
                    contextData = filteredData.filter(item => {
                        return formatMonthYear(item.date) === selectedMonth;
                    });
                    updateDashboard();
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}


// =========================
// 6. PIE CHART
// =========================
function renderCategoryChart() {

    const data = getCurrentData();
    let categoryData = {};

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const total = item.price * item.quantity;

        categoryData[item.category] = (categoryData[item.category] || 0) + total;
    }

    const labels = Object.keys(categoryData);
    const values = Object.values(categoryData);

    if (categoryChartInstance) {
        categoryChartInstance.data.labels = labels;
        categoryChartInstance.data.datasets[0].data = values;
        categoryChartInstance.update();
        return;
    }

    categoryChartInstance = new Chart(document.getElementById("categoryPieChart"), {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#0ea5e9",
                    "#38bdf8",
                    "#60a5fa",
                    "#78a6e2",
                    "#87CEFA",
                    "#22d3ee",
                    "#93c5fd"
                ],
                borderWidth: 0,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: "circle"
                    }
                }
            }
        }
    });
}

// =========================
// 7. BAR CHART
// =========================
function renderTopProductsChart() {

    const data = getCurrentData();
    let productData = {};

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const total = item.price * item.quantity;
        productData[item.product] = (productData[item.product] || 0) + total;
    }

    const sortedProducts = Object.entries(productData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const labels = sortedProducts.map(item => item[0]);
    const values = sortedProducts.map(item => item[1]);

    if (topProductsChartInstance) {
        topProductsChartInstance.data.labels = labels;
        topProductsChartInstance.data.datasets[0].data = values;
        topProductsChartInstance.update();
        return;
    }

    topProductsChartInstance = new Chart(document.getElementById("topProductsBarChart"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#22c55e",
                    "#4ade80",
                    "#16a34a",
                    "#86efac",
                    "#15803d"
                ],
                borderRadius: 12,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                }
            }
        }
    });
}

// =========================
// 8. Filters
// =========================
function setupFilters() {

    const categoryFilter = document.getElementById("categoryFilter");

    // Очищаємо старі опції (крім першої "all")
    while (categoryFilter.options.length > 1) {
        categoryFilter.remove(1);
    }

    // Унікальні категорії
    const categories = [...new Set(salesData.map(item => item.category))];

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        categoryFilter.appendChild(option);
    });
}

// =========================
// 9. applyFilters
// =========================
function applyFilters() {

    const selectedCategory =
        document.getElementById("categoryFilter").value;

    const startDate =
        document.getElementById("startDate").value;

    const endDate =
        document.getElementById("endDate").value;

    filteredData = salesData.filter(item => {

        let categoryMatch =
            selectedCategory === "all" ||
            item.category === selectedCategory;

        let startDateMatch =
            !startDate || item.date >= startDate;

        let endDateMatch =
            !endDate || item.date <= endDate;

        let productMatch =
            !selectedProductName ||
            item.product === selectedProductName;

        return categoryMatch &&
               startDateMatch &&
               endDateMatch &&
               productMatch;
    });

    resetContext();
    updateDashboard();
}

// =========================
// 10. updateDashboard
// =========================
function updateDashboard() {

    calculateStats();
    renderTable();

    renderSalesChart();
    renderCategoryChart();
    renderTopProductsChart();
    renderRegionChart();
    renderPaymentChart();
}

// =========================
// 11. updateDashboard
// =========================

/**
 * Refresh data to original state
 */
function refreshData() {

    salesData = [...originalData];
    filteredData = [...originalData];

    resetContext();

    document.getElementById("categoryFilter").value = "all";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("productSearch").value = "";
    selectedProductName = null;

    // Перезавантажуємо фільтри
    setupFilters();
    populateProductList();

    updateDashboard();
}

// =========================
// SETUP EVENT LISTENERS
// =========================

function setupEventListeners() {

    document.getElementById("backButton")
        .addEventListener("click", () => {

            resetContext();
            updateDashboard();
        });

    document.getElementById("importButton")
        .addEventListener("click", () => {

            document.getElementById("fileInput").click();
        });

    document.getElementById("fileInput")
        .addEventListener("change", handleFileUpload);

    document.getElementById("refreshButton")
        .addEventListener("click", refreshData);

    const productInput = document.getElementById("productSearch");
    productInput.addEventListener("input", handleProductSearchInput);
    productInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideProductSuggestions();
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            const suggestions = document.getElementById("productSuggestions");
            const firstSuggestion = suggestions.querySelector(".suggestion-item");
            if (firstSuggestion) {
                selectProduct(firstSuggestion.textContent);
            }
        }
    });

    document.addEventListener("click", (e) => {
        const searchWrapper = document.querySelector(".search-wrapper");
        if (!searchWrapper.contains(e.target)) {
            hideProductSuggestions();
        }
    });

    // Clear button removed — no-op

    // Filter listeners
    document.getElementById("categoryFilter")
        .addEventListener("change", scheduleFilterUpdate);

    document.getElementById("startDate")
        .addEventListener("change", scheduleFilterUpdate);

    document.getElementById("endDate")
        .addEventListener("change", scheduleFilterUpdate);

    document.getElementById("exportButton")
        .addEventListener("click", openModal);

    document.getElementById("cancelExport")
        .addEventListener("click", closeModal);

    document.getElementById("confirmExport")
        .addEventListener("click", exportCurrentViewToPDF);

    // Close modal when clicking outside
    document.getElementById("exportModal")
        .addEventListener("click", (e) => {

            if (e.target.id === "exportModal") {

                closeModal();
            }
        });

    // Close modal with Escape key
    document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            const modal = document.getElementById("exportModal");

            if (!modal.classList.contains("hidden")) {

                closeModal();
            }
        }
    });
}

// =========================
// REGION ANALYTICS
// =========================

function renderRegionChart() {

    const data = getCurrentData();
    let regionData = {};

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const revenue = item.price * item.quantity;
        regionData[item.region] = (regionData[item.region] || 0) + revenue;
    }

    const sortedRegions = Object.entries(regionData)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedRegions.map(item => item[0]);
    const values = sortedRegions.map(item => item[1]);

    if (regionChartInstance) {
        regionChartInstance.data.labels = labels;
        regionChartInstance.data.datasets[0].data = values;
        regionChartInstance.update();
        return;
    }

    regionChartInstance = new Chart(document.getElementById("regionChart"), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Дохід за регіоном",
                data: values,
                backgroundColor: [
                    "#8B4513",
                    "#CD853F",
                    "#D2B48C",
                    "#DEB887",
                    "#FFDEAD",
                    "#FFEBCD",
                    "#FDF5E6"
                ],
                borderRadius: 12,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: "rgba(0,0,0,0.05)"
                    }
                }
            }
        }
    });
}

// =========================
// PAYMENT ANALYTICS
// =========================

function renderPaymentChart() {

    const data = getCurrentData();
    let paymentData = {};

    for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
        const revenue = item.price * item.quantity;
        paymentData[item.payment_method] = (paymentData[item.payment_method] || 0) + revenue;
    }

    const labels = Object.keys(paymentData);
    const values = Object.values(paymentData);

    if (paymentChartInstance) {
        paymentChartInstance.data.labels = labels;
        paymentChartInstance.data.datasets[0].data = values;
        paymentChartInstance.update();
        return;
    }

    paymentChartInstance = new Chart(document.getElementById("paymentChart"), {
        type: "polarArea",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#7c3aed",
                    "#8b5cf6",
                    "#a855f7",
                    "#9333ea",
                    "#c084fc",
                    "#6d28d9"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

