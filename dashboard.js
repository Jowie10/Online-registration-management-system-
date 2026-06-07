import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJwJrrhF6LKboNZpwH7-07IHSApN5vKXg",
  authDomain: "qr-code-sign-in-91fce.firebaseapp.com",
  projectId: "qr-code-sign-in-91fce",
  storageBucket: "qr-code-sign-in-91fce.firebasestorage.app",
  messagingSenderId: "480973024477",
  appId: "1:480973024477:web:13686e41a0856a79af7f34"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const visitorsCollection = collection(db, "visitors");

// Smart QR points to index.html (the visitor page)
const smartQrUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'index.html';

let allVisitors = [];
let reportsHistory = [];

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

// Generate the smart QR code preview (200px for modal)
function generateSmartQR() {
    if (!staticQRDiv) return;
    staticQRDiv.innerHTML = '';
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(smartQrUrl)}`;
    img.alt = "Smart Gate QR Code";
    img.style.width = "200px";
    img.style.margin = "auto";
    img.style.display = "block";
    staticQRDiv.appendChild(img);
}

if (viewQRBtn) {
    viewQRBtn.addEventListener('click', () => {
        generateSmartQR();
        if (qrModal) qrModal.style.display = 'flex';
    });
}
document.querySelector('.close-qr')?.addEventListener('click', () => { if (qrModal) qrModal.style.display = 'none'; });

// **FIXED: Download QR button directly saves a high-res PNG (600x600)**
if (downloadQRBtn) {
    downloadQRBtn.addEventListener('click', () => {
        const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(smartQrUrl)}`;
        const link = document.createElement('a');
        link.download = 'smart_gate_qr.png';
        link.href = downloadUrl;
        link.click();
    });
}

// Report history functions (unchanged)
function loadReportsHistory() {
    const saved = localStorage.getItem('visitor_reports');
    if (saved) reportsHistory = JSON.parse(saved);
    renderReportsList();
}
function saveReportsHistory() { localStorage.setItem('visitor_reports', JSON.stringify(reportsHistory)); }
function renderReportsList() {
    if (!reportsListDiv) return;
    if (!reportsHistory.length) { reportsListDiv.innerHTML = '<p style="color: #6b7280;">No reports generated yet.</p>'; return; }
    reportsListDiv.innerHTML = reportsHistory.map((report, idx) => `
        <div class="report-item">
            <span><i class="fas fa-file-${report.type === 'pdf' ? 'pdf' : 'csv'}"></i> ${report.name}</span>
            <div>
                <button onclick="window.downloadReport(${idx})" style="background:none;border:none;cursor:pointer;"><i class="fas fa-download"></i></button>
                <button onclick="window.deleteReport(${idx})" style="background:none;border:none;cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}
window.downloadReport = (idx) => { const r = reportsHistory[idx]; const a = document.createElement('a'); a.href = r.dataUrl; a.download = r.name; a.click(); };
window.deleteReport = (idx) => { reportsHistory.splice(idx,1); saveReportsHistory(); renderReportsList(); };
window.viewDetails = (id) => {
    const v = allVisitors.find(v => v.id === id);
    if(v) alert(`Visitor Details:\n\nName: ${v.name}\nPhone: ${v.phone}\nNIN: ${v.nin || '—'}\nID: ${v.visitorId}\nPurpose: ${v.purpose}\nVisiting: ${v.visitingPerson || 'N/A'}\nEntry: ${v.entryTime?.toDate?.().toLocaleString()}\nExit: ${v.exitTime ? v.exitTime.toDate?.().toLocaleString() : 'Not checked out'}\nStatus: ${v.status === 'checked-in' ? 'Inside' : 'Left'}`);
};

function startRealtimeListener() {
    onSnapshot(visitorsCollection, (snapshot) => {
        allVisitors = [];
        snapshot.forEach(doc => allVisitors.push({ id: doc.id, ...doc.data() }));
        allVisitors.sort((a,b) => (b.entryTime?.toDate?.() || new Date(b.entryTime)) - (a.entryTime?.toDate?.() || new Date(a.entryTime)));
        applyFiltersAndRender();
        updateStats();
    });
}

function updateStats() {
    const today = new Date().toDateString();
    const inside = allVisitors.filter(v => v.status === "checked-in").length;
    const leftToday = allVisitors.filter(v => v.exitTime && v.status === "checked-out" && (v.exitTime.toDate ? v.exitTime.toDate() : new Date(v.exitTime)).toDateString() === today).length;
    const daily = allVisitors.filter(v => (v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime)).toDateString() === today).length;
    if(currentlyInsideCount) currentlyInsideCount.textContent = inside;
    if(leftTodayCount) leftTodayCount.textContent = leftToday;
    if(totalDailyCount) totalDailyCount.textContent = daily;
}

function applyFiltersAndRender() {
    let filtered = [...allVisitors];
    const term = searchInput?.value.toLowerCase() || '';
    if(term) filtered = filtered.filter(v => v.name?.toLowerCase().includes(term) || v.phone?.includes(term) || v.visitorId?.toLowerCase().includes(term));
    const status = statusFilter?.value || 'all';
    if(status !== 'all') filtered = filtered.filter(v => v.status === status);
    if(dateFilter?.value) {
        const fd = new Date(dateFilter.value).toDateString();
        filtered = filtered.filter(v => (v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime)).toDateString() === fd);
    }
    renderTable(filtered);
}

function renderTable(visitors) {
    if (!tableBody) return;
    if (!visitors.length) { tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No visitors found</td</tr>'; return; }
    tableBody.innerHTML = visitors.map(visitor => {
        const isCheckedOut = visitor.status === 'checked-out';
        const rowClass = isCheckedOut ? 'class="checked-out-row"' : '';
        return `
        <tr ${rowClass}>
            <td>${escapeHtml(visitor.visitorId || visitor.id)}</td>
            <td>${escapeHtml(visitor.name)}</td>
            <td>${visitor.phone}</td>
            <td>${escapeHtml(visitor.nin) || '—'}</td>
            <td>${visitor.purpose || '—'}</td>
            <td>${escapeHtml(visitor.visitingPerson) || '—'}</td>
            <td>${visitor.entryTime?.toDate ? visitor.entryTime.toDate().toLocaleString() : new Date(visitor.entryTime).toLocaleString()}</td>
            <td>${visitor.exitTime ? (visitor.exitTime.toDate ? visitor.exitTime.toDate().toLocaleString() : new Date(visitor.exitTime).toLocaleString()) : '—'}</td>
            <td><span class="status-badge status-${visitor.status === 'checked-in' ? 'checked-in' : 'checked-out'}">${visitor.status === 'checked-in' ? 'Inside' : 'Left'}</span></td>
            <td><i class="fas fa-eye action-icon" onclick="window.viewDetails('${visitor.id}')" style="cursor:pointer;"></i></td>
        </tr>
    `}).join('');
}
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':'&gt;'); }

function exportToCSV() {
    const headers = ['VisitorID','Name','Phone','NIN','Purpose','Visiting','EntryTime','ExitTime','Status'];
    const rows = allVisitors.map(v => [
        v.visitorId, v.name, v.phone, v.nin || '', v.purpose || '', v.visitingPerson || '',
        v.entryTime?.toDate ? v.entryTime.toDate().toLocaleString() : new Date(v.entryTime).toLocaleString(),
        v.exitTime ? (v.exitTime.toDate ? v.exitTime.toDate().toLocaleString() : new Date(v.exitTime).toLocaleString()) : '',
        v.status === 'checked-in' ? 'Inside' : 'Left'
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    saveReport(`visitor_report_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`, url, 'csv');
}
function exportToPDF() {
    if(typeof jspdf === 'undefined') { alert("jsPDF not loaded."); return; }
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Visitor Management Report",20,20);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`,20,28);
    doc.text(`Total Visitors: ${allVisitors.length}`,20,35);
    doc.text(`Currently Inside: ${allVisitors.filter(v=>v.status==='checked-in').length}`,20,41);
    let y=50; doc.setFontSize(9);
    allVisitors.forEach((v,i)=>{
        if(y>270){ doc.addPage(); y=20; }
        doc.text(`${i+1}. ${v.name} (${v.visitorId}) - ${v.status==='checked-in'?'Inside':'Left'}`,20,y);
        y+=6;
    });
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    saveReport(`visitor_report_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.pdf`, url, 'pdf');
}
function saveReport(name, dataUrl, type) {
    reportsHistory.unshift({name, dataUrl, type, date: new Date().toISOString()});
    if(reportsHistory.length>20) reportsHistory.pop();
    saveReportsHistory(); renderReportsList();
}
function emailReport() { if(emailModal) emailModal.style.display = 'flex'; }
document.querySelector('.close-email')?.addEventListener('click',()=>{ if(emailModal) emailModal.style.display='none'; });
if(sendEmailBtn){
    sendEmailBtn.addEventListener('click',()=>{
        const email = document.getElementById('emailRecipient')?.value;
        if(!email){ alert("Enter recipient email"); return; }
        const subj = encodeURIComponent('Visitor Management Report');
        const body = encodeURIComponent(`Visitor Report\nGenerated: ${new Date().toLocaleString()}\nTotal Visitors: ${allVisitors.length}\nCurrently Inside: ${allVisitors.filter(v=>v.status==='checked-in').length}`);
        window.location.href = `mailto:${email}?subject=${subj}&body=${body}`;
        alert(`Email client opened for ${email}`);
        if(emailModal) emailModal.style.display='none';
    });
}
window.addEventListener('click',(e)=>{ if(e.target===emailModal && emailModal) emailModal.style.display='none'; if(e.target===qrModal && qrModal) qrModal.style.display='none'; });
if(exportPdfBtn) exportPdfBtn.addEventListener('click',exportToPDF);
if(exportCsvBtn) exportCsvBtn.addEventListener('click',exportToCSV);
if(emailReportBtn) emailReportBtn.addEventListener('click',emailReport);
if(refreshBtn) refreshBtn.addEventListener('click',()=>applyFiltersAndRender());
if(searchInput) searchInput.addEventListener('input',applyFiltersAndRender);
if(statusFilter) statusFilter.addEventListener('change',applyFiltersAndRender);
if(dateFilter) dateFilter.addEventListener('change',applyFiltersAndRender);

loadReportsHistory();
startRealtimeListener();

function updateDateTime() {
    const now = new Date();
    const footerDate = document.getElementById('footerDate');
    const footerTime = document.getElementById('footerTime');
    if(footerDate) footerDate.textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    if(footerTime) footerTime.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}
setInterval(updateDateTime,1000);
updateDateTime();
