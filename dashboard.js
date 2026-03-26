import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const visitorsCollection = collection(db, "visitors");

// Get the current page URL for QR code
const currentUrl = window.location.origin;
const visitorFormUrl = `${currentUrl}/index.html`;

let allVisitors = [];
let reportsHistory = [];

// DOM Elements
const tableBody = document.getElementById('tableBody');
const currentlyInsideCount = document.getElementById('currentlyInsideCount');
const leftTodayCount = document.getElementById('leftTodayCount');
const totalDailyCount = document.getElementById('totalDailyCount');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const emailReportBtn = document.getElementById('emailReportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const reportsListDiv = document.getElementById('reportsList');
const emailModal = document.getElementById('emailModal');
const viewQRBtn = document.getElementById('viewQRBtn');
const qrModal = document.getElementById('qrModal');
const staticQRDiv = document.getElementById('staticQRCode');
const downloadQRBtn = document.getElementById('downloadQRBtn');

// Generate static QR code for entrance
function generateEntranceQR() {
    staticQRDiv.innerHTML = '';
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(visitorFormUrl)}`;
    img.alt = "Entrance QR Code";
    img.style.width = "200px";
    img.style.margin = "auto";
    img.style.display = "block";
    staticQRDiv.appendChild(img);
}

viewQRBtn.addEventListener('click', () => {
    generateEntranceQR();
    qrModal.style.display = 'flex';
});

document.querySelector('.close-qr')?.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

downloadQRBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'entrance_qr_code.png';
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(visitorFormUrl)}`;
    link.click();
});

// Load reports from localStorage
function loadReportsHistory() {
    const saved = localStorage.getItem('visitor_reports');
    if (saved) reportsHistory = JSON.parse(saved);
    renderReportsList();
}

function saveReportsHistory() {
    localStorage.setItem('visitor_reports', JSON.stringify(reportsHistory));
}

function renderReportsList() {
    if (!reportsHistory.length) {
        reportsListDiv.innerHTML = '<p style="color: #6b7280;">No reports generated yet. Click Export to create reports.</p>';
        return;
    }
    reportsListDiv.innerHTML = reportsHistory.map((report, idx) => `
        <div class="report-item">
            <span><i class="fas fa-file-${report.type === 'pdf' ? 'pdf' : 'csv'}"></i> ${report.name} (${new Date(report.date).toLocaleString()})</span>
            <div>
                <button onclick="window.downloadReport(${idx})"><i class="fas fa-download"></i></button>
                <button onclick="window.deleteReport(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.downloadReport = (idx) => {
    const report = reportsHistory[idx];
    const link = document.createElement('a');
    link.href = report.dataUrl;
    link.download = report.name;
    link.click();
};

window.deleteReport = (idx) => {
    reportsHistory.splice(idx, 1);
    saveReportsHistory();
    renderReportsList();
};

// Real-time listener
function startRealtimeListener() {
    onSnapshot(visitorsCollection, (snapshot) => {
        allVisitors = [];
        snapshot.forEach(doc => {
            allVisitors.push({ id: doc.id, ...doc.data() });
        });
        applyFiltersAndRender();
        updateStats();
    });
}

function updateStats() {
    const today = new Date().toDateString();
    const currentlyInside = allVisitors.filter(v => v.status === "checked-in").length;
    const leftTodayCountVal = allVisitors.filter(v => {
        if (!v.exitTime) return false;
        const exitDate = v.exitTime.toDate ? v.exitTime.toDate() : new Date(v.exitTime);
        return v.status === "checked-out" && exitDate.toDateString() === today;
    }).length;
    const totalDaily = allVisitors.filter(v => {
        const entryDate = v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime);
        return entryDate.toDateString() === today;
    }).length;

    currentlyInsideCount.textContent = currentlyInside;
    leftTodayCount.textContent = leftTodayCountVal;
    totalDailyCount.textContent = totalDaily;
}

function applyFiltersAndRender() {
    let filtered = [...allVisitors];
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(v =>
            v.name?.toLowerCase().includes(searchTerm) ||
            v.phone?.includes(searchTerm) ||
            v.visitorId?.toLowerCase().includes(searchTerm)
        );
    }
    const status = statusFilter.value;
    if (status !== 'all') {
        filtered = filtered.filter(v => v.status === status);
    }
    if (dateFilter.value) {
        const filterDate = new Date(dateFilter.value).toDateString();
        filtered = filtered.filter(v => {
            const entryDate = v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime);
            return entryDate.toDateString() === filterDate;
        });
    }
    renderTable(filtered);
}

function renderTable(visitors) {
    if (!visitors.length) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No visitors found</td></tr>';
        return;
    }
    tableBody.innerHTML = visitors.map(visitor => `
        <tr>
            <td>${visitor.visitorId || visitor.id}</td>
            <td>${visitor.name}</td>
            <td>${visitor.phone}</td>
            <td>${visitor.purpose}</td>
            <td>${visitor.visitingPerson || '—'}</td>
            <td>${visitor.entryTime?.toDate ? visitor.entryTime.toDate().toLocaleString() : new Date(visitor.entryTime).toLocaleString()}</td>
            <td>${visitor.exitTime ? (visitor.exitTime.toDate ? visitor.exitTime.toDate().toLocaleString() : new Date(visitor.exitTime).toLocaleString()) : '—'}</td>
            <td><span class="status-badge status-${visitor.status === 'checked-in' ? 'checked-in' : 'checked-out'}">${visitor.status === 'checked-in' ? 'Inside' : 'Left'}</span></td>
            <td><i class="fas fa-eye action-icon" onclick="window.viewDetails('${visitor.id}')"></i></td>
        </tr>
    `).join('');
}

window.viewDetails = async (id) => {
    alert("Visitor details feature - can be expanded with modal view.");
};

// Export functions
function exportToCSV() {
    const filtered = allVisitors;
    const headers = ['VisitorID', 'Name', 'Phone', 'Purpose', 'Visiting', 'EntryTime', 'ExitTime', 'Status'];
    const rows = filtered.map(v => [
        v.visitorId, v.name, v.phone, v.purpose, v.visitingPerson || '—',
        v.entryTime?.toDate ? v.entryTime.toDate().toLocaleString() : new Date(v.entryTime).toLocaleString(),
        v.exitTime ? (v.exitTime.toDate ? v.exitTime.toDate().toLocaleString() : new Date(v.exitTime).toLocaleString()) : '',
        v.status
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const filename = `visitor_report_${new Date().toISOString().slice(0, 19)}.csv`;
    saveReport(filename, url, 'csv');
}

function exportToPDF() {
    if (typeof jspdf === 'undefined') {
        alert("jsPDF library not loaded. Please check your internet connection.");
        return;
    }
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Visitor Management Report", 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 28);
    
    let y = 40;
    doc.setFontSize(9);
    allVisitors.forEach((v, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${idx + 1}. ${v.name} (${v.visitorId}) - ${v.status} - ${v.purpose}`, 20, y);
        y += 6;
    });
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const filename = `visitor_report_${new Date().toISOString().slice(0, 19)}.pdf`;
    saveReport(filename, url, 'pdf');
}

function saveReport(name, dataUrl, type) {
    reportsHistory.unshift({ name, dataUrl, type, date: new Date().toISOString() });
    if (reportsHistory.length > 20) reportsHistory.pop();
    saveReportsHistory();
    renderReportsList();
}

// Email simulation
function emailReport() {
    emailModal.style.display = 'flex';
}

document.querySelector('.close-email')?.addEventListener('click', () => {
    emailModal.style.display = 'none';
});

sendEmailBtn.addEventListener('click', () => {
    const email = document.getElementById('emailRecipient').value;
    if (!email) {
        alert("Please enter recipient email");
        return;
    }
    alert(`Report would be emailed to ${email} (requires backend email service)`);
    emailModal.style.display = 'none';
    document.getElementById('emailRecipient').value = '';
    document.getElementById('emailMessage').value = '';
});

window.addEventListener('click', (e) => {
    if (e.target === emailModal) emailModal.style.display = 'none';
    if (e.target === qrModal) qrModal.style.display = 'none';
});

exportPdfBtn.addEventListener('click', exportToPDF);
exportCsvBtn.addEventListener('click', exportToCSV);
emailReportBtn.addEventListener('click', emailReport);
refreshBtn.addEventListener('click', () => applyFiltersAndRender());
searchInput.addEventListener('input', applyFiltersAndRender);
statusFilter.addEventListener('change', applyFiltersAndRender);
dateFilter.addEventListener('change', applyFiltersAndRender);

loadReportsHistory();
startRealtimeListener();