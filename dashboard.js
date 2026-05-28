import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration - REPLACE WITH YOUR OWN FIREBASE PROJECT CREDENTIALS
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
const sendEmailBtn = document.getElementById('sendEmailBtn');

// Generate static QR code for entrance
function generateEntranceQR() {
    if (!staticQRDiv) return;
    staticQRDiv.innerHTML = '';
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(visitorFormUrl)}`;
    img.alt = "Entrance QR Code";
    img.style.width = "200px";
    img.style.margin = "auto";
    img.style.display = "block";
    staticQRDiv.appendChild(img);
}

if (viewQRBtn) {
    viewQRBtn.addEventListener('click', () => {
        generateEntranceQR();
        if (qrModal) qrModal.style.display = 'flex';
    });
}

document.querySelector('.close-qr')?.addEventListener('click', () => {
    if (qrModal) qrModal.style.display = 'none';
});

if (downloadQRBtn) {
    downloadQRBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'entrance_qr_code.png';
        link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(visitorFormUrl)}`;
        link.click();
    });
}

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
    if (!reportsListDiv) return;
    if (!reportsHistory.length) {
        reportsListDiv.innerHTML = '<p style="color: #6b7280;">No reports generated yet. Click Export to create reports.</p>';
        return;
    }
    reportsListDiv.innerHTML = reportsHistory.map((report, idx) => `
        <div class="report-item">
            <span><i class="fas fa-file-${report.type === 'pdf' ? 'pdf' : 'csv'}"></i> ${report.name} (${new Date(report.date).toLocaleString()})</span>
            <div>
                <button onclick="window.downloadReport(${idx})" style="background:none;border:none;cursor:pointer;"><i class="fas fa-download"></i></button>
                <button onclick="window.deleteReport(${idx})" style="background:none;border:none;cursor:pointer;"><i class="fas fa-trash"></i></button>
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

window.viewDetails = (id) => {
    const visitor = allVisitors.find(v => v.id === id);
    if (visitor) {
        alert(`Visitor Details:\n\nName: ${visitor.name}\nPhone: ${visitor.phone}\nID: ${visitor.visitorId}\nPurpose: ${visitor.purpose}\nVisiting: ${visitor.visitingPerson || 'N/A'}\nEntry: ${visitor.entryTime?.toDate?.().toLocaleString() || new Date(visitor.entryTime).toLocaleString()}\nExit: ${visitor.exitTime ? (visitor.exitTime.toDate?.().toLocaleString() || new Date(visitor.exitTime).toLocaleString()) : 'Not checked out'}\nStatus: ${visitor.status === 'checked-in' ? 'Currently Inside' : 'Left'}`);
    }
};

// Real-time listener
function startRealtimeListener() {
    onSnapshot(visitorsCollection, (snapshot) => {
        allVisitors = [];
        snapshot.forEach(doc => {
            allVisitors.push({ id: doc.id, ...doc.data() });
        });
        allVisitors.sort((a, b) => {
            const timeA = a.entryTime?.toDate?.() || new Date(a.entryTime);
            const timeB = b.entryTime?.toDate?.() || new Date(b.entryTime);
            return timeB - timeA;
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

    if (currentlyInsideCount) currentlyInsideCount.textContent = currentlyInside;
    if (leftTodayCount) leftTodayCount.textContent = leftTodayCountVal;
    if (totalDailyCount) totalDailyCount.textContent = totalDaily;
}

function applyFiltersAndRender() {
    let filtered = [...allVisitors];
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(v =>
            v.name?.toLowerCase().includes(searchTerm) ||
            v.phone?.includes(searchTerm) ||
            v.visitorId?.toLowerCase().includes(searchTerm)
        );
    }
    const status = statusFilter?.value || 'all';
    if (status !== 'all') {
        filtered = filtered.filter(v => v.status === status);
    }
    if (dateFilter?.value) {
        const filterDate = new Date(dateFilter.value).toDateString();
        filtered = filtered.filter(v => {
            const entryDate = v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime);
            return entryDate.toDateString() === filterDate;
        });
    }
    renderTable(filtered);
}

function renderTable(visitors) {
    if (!tableBody) return;
    if (!visitors.length) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No visitors found</td</tr>';
        return;
    }
    tableBody.innerHTML = visitors.map(visitor => `
        <tr>
            <td>${visitor.visitorId || visitor.id}</td>
            <td>${escapeHtml(visitor.name)}</td>
            <td>${visitor.phone}</td>
            <td>${visitor.purpose || '—'}</td>
            <td>${escapeHtml(visitor.visitingPerson) || '—'}</td>
            <td>${visitor.entryTime?.toDate ? visitor.entryTime.toDate().toLocaleString() : new Date(visitor.entryTime).toLocaleString()}</td>
            <td>${visitor.exitTime ? (visitor.exitTime.toDate ? visitor.exitTime.toDate().toLocaleString() : new Date(visitor.exitTime).toLocaleString()) : '—'}</td>
            <td><span class="status-badge status-${visitor.status === 'checked-in' ? 'checked-in' : 'checked-out'}">${visitor.status === 'checked-in' ? 'Inside' : 'Left'}</span></td>
            <td><i class="fas fa-eye action-icon" onclick="window.viewDetails('${visitor.id}')" style="cursor:pointer;"></i></td>
        </tr>
    `).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Export functions
function exportToCSV() {
    const headers = ['VisitorID', 'Name', 'Phone', 'Purpose', 'Visiting', 'EntryTime', 'ExitTime', 'Status'];
    const rows = allVisitors.map(v => [
        v.visitorId, v.name, v.phone, v.purpose || '', v.visitingPerson || '',
        v.entryTime?.toDate ? v.entryTime.toDate().toLocaleString() : new Date(v.entryTime).toLocaleString(),
        v.exitTime ? (v.exitTime.toDate ? v.exitTime.toDate().toLocaleString() : new Date(v.exitTime).toLocaleString()) : '',
        v.status === 'checked-in' ? 'Inside' : 'Left'
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `visitor_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
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
    doc.text(`Total Visitors: ${allVisitors.length}`, 20, 35);
    doc.text(`Currently Inside: ${allVisitors.filter(v => v.status === 'checked-in').length}`, 20, 41);
    
    let y = 50;
    doc.setFontSize(9);
    allVisitors.forEach((v, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${idx + 1}. ${v.name} (${v.visitorId}) - ${v.status === 'checked-in' ? 'Inside' : 'Left'} - ${v.purpose || 'No purpose'}`, 20, y);
        y += 6;
    });
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const filename = `visitor_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
    saveReport(filename, url, 'pdf');
}

function saveReport(name, dataUrl, type) {
    reportsHistory.unshift({ name, dataUrl, type, date: new Date().toISOString() });
    if (reportsHistory.length > 20) reportsHistory.pop();
    saveReportsHistory();
    renderReportsList();
}

// Email modal handling
function emailReport() {
    if (emailModal) emailModal.style.display = 'flex';
}

document.querySelector('.close-email')?.addEventListener('click', () => {
    if (emailModal) emailModal.style.display = 'none';
});

if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', () => {
        const email = document.getElementById('emailRecipient')?.value;
        if (!email) {
            alert("Please enter recipient email");
            return;
        }
        
        const headers = ['VisitorID', 'Name', 'Phone', 'Purpose', 'Visiting', 'EntryTime', 'ExitTime', 'Status'];
        const rows = allVisitors.map(v => [
            v.visitorId, v.name, v.phone, v.purpose || '', v.visitingPerson || '',
            v.entryTime?.toDate ? v.entryTime.toDate().toLocaleString() : new Date(v.entryTime).toLocaleString(),
            v.exitTime ? (v.exitTime.toDate ? v.exitTime.toDate().toLocaleString() : new Date(v.exitTime).toLocaleString()) : '',
            v.status === 'checked-in' ? 'Inside' : 'Left'
        ]);
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const subject = encodeURIComponent('Visitor Management Report');
        const body = encodeURIComponent(`Please find attached the visitor report.\n\nReport generated on: ${new Date().toLocaleString()}\n\nTotal Visitors: ${allVisitors.length}\nCurrently Inside: ${allVisitors.filter(v => v.status === 'checked-in').length}\n\nNote: This is a simulated email. In production, you would use a backend email service.\n\nReport Data:\n${csvContent.substring(0, 1000)}...`);
        
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        
        alert(`Email client opened for ${email}\n\nIn production, you would use a backend service to send the report as an attachment.`);
        
        if (emailModal) emailModal.style.display = 'none';
        const emailInput = document.getElementById('emailRecipient');
        const messageInput = document.getElementById('emailMessage');
        if (emailInput) emailInput.value = '';
        if (messageInput) messageInput.value = '';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === emailModal && emailModal) emailModal.style.display = 'none';
    if (e.target === qrModal && qrModal) qrModal.style.display = 'none';
});

if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportToPDF);
if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
if (emailReportBtn) emailReportBtn.addEventListener('click', emailReport);
if (refreshBtn) refreshBtn.addEventListener('click', () => applyFiltersAndRender());
if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
if (dateFilter) dateFilter.addEventListener('change', applyFiltersAndRender);

loadReportsHistory();
startRealtimeListener();