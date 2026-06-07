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

// Smart QR points to index.html
const smartQrUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'index.html';

let allVisitors = [];
let reportsHistory = [];

// DOM elements
const tableBody = document.getElementById('tableBody');
const currentlyInsideCount = document.getElementById('currentlyInsideCount');
const leftTodayCount = document.getElementById('leftTodayCount');
const totalDailyCount = document.getElementById('totalDailyCount');
const avgStayTimeSpan = document.getElementById('avgStayTime');
const mostVisitedDeptSpan = document.getElementById('mostVisitedDept');
const peakHourSpan = document.getElementById('peakHour');
const longestStaySpan = document.getElementById('longestStay');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const startDateFilter = document.getElementById('startDateFilter');
const endDateFilter = document.getElementById('endDateFilter');
const applyDateRangeBtn = document.getElementById('applyDateRangeBtn');
const weeklyReportBtn = document.getElementById('weeklyReportBtn');
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

// Date range state
let currentDateRange = { start: null, end: null }; // for filtering exports

// Helper: get date from visitor entry time
function getEntryDate(visitor) {
  const ts = visitor.entryTime?.toDate ? visitor.entryTime.toDate() : new Date(visitor.entryTime);
  return ts;
}

// Helper: format hour (0-23) to 12h range with AM/PM
function formatHour(hour24) {
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${suffix}`;
}

// Calculate peak hour from all visitors
function calculatePeakHour() {
  if (allVisitors.length === 0) return "10:00 - 11:00 AM";
  const hourCount = new Array(24).fill(0);
  allVisitors.forEach(v => {
    const entryDate = getEntryDate(v);
    const hour = entryDate.getHours();
    hourCount[hour]++;
  });
  let maxCount = 0;
  let peakHour = 0;
  for (let i = 0; i < 24; i++) {
    if (hourCount[i] > maxCount) {
      maxCount = hourCount[i];
      peakHour = i;
    }
  }
  const nextHour = (peakHour + 1) % 24;
  return `${formatHour(peakHour)} - ${formatHour(nextHour)}`;
}

// Calculate longest stay (in minutes) among checked-out visitors
function calculateLongestStay() {
  let maxMinutes = 0;
  allVisitors.forEach(v => {
    if (v.exitTime && v.status === "checked-out") {
      const entry = getEntryDate(v);
      const exit = v.exitTime.toDate ? v.exitTime.toDate() : new Date(v.exitTime);
      const diffMs = exit - entry;
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes > maxMinutes) maxMinutes = diffMinutes;
    }
  });
  if (maxMinutes === 0) return "--";
  const hours = Math.floor(maxMinutes / 60);
  const minutes = maxMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Calculate most visited department/purpose
function calculateMostVisited() {
  if (allVisitors.length === 0) return "Administration";
  const purposeCount = {};
  allVisitors.forEach(v => {
    const purpose = v.purpose || "Other";
    purposeCount[purpose] = (purposeCount[purpose] || 0) + 1;
  });
  let maxCount = 0;
  let mostVisited = "Administration";
  for (const [purpose, count] of Object.entries(purposeCount)) {
    if (count > maxCount) {
      maxCount = count;
      mostVisited = purpose;
    }
  }
  return mostVisited;
}

// Update all dynamic stats
function updateDynamicStats() {
  if (peakHourSpan) peakHourSpan.textContent = calculatePeakHour();
  if (longestStaySpan) longestStaySpan.textContent = calculateLongestStay();
  if (mostVisitedDeptSpan) mostVisitedDeptSpan.textContent = calculateMostVisited();
}

// ========== QR CODE MODAL (unchanged) ==========
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
if (downloadQRBtn) {
  downloadQRBtn.addEventListener('click', () => {
    const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(smartQrUrl)}`;
    const link = document.createElement('a');
    link.download = 'smart_gate_qr.png';
    link.href = downloadUrl;
    link.click();
  });
}

// ========== REPORT HISTORY FUNCTIONS ==========
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

// ========== REALTIME LISTENER ==========
function startRealtimeListener() {
  onSnapshot(visitorsCollection, (snapshot) => {
    allVisitors = [];
    snapshot.forEach(doc => allVisitors.push({ id: doc.id, ...doc.data() }));
    allVisitors.sort((a,b) => (b.entryTime?.toDate?.() || new Date(b.entryTime)) - (a.entryTime?.toDate?.() || new Date(a.entryTime)));
    applyFiltersAndRender();
    updateStats();
    updateDynamicStats();  // Update peak hour, longest stay, most visited
  });
}

// ========== STATS ==========
function updateStats() {
  const today = new Date().toDateString();
  const inside = allVisitors.filter(v => v.status === "checked-in").length;
  const leftToday = allVisitors.filter(v => v.exitTime && v.status === "checked-out" && (v.exitTime.toDate ? v.exitTime.toDate() : new Date(v.exitTime)).toDateString() === today).length;
  const daily = allVisitors.filter(v => (v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime)).toDateString() === today).length;
  if(currentlyInsideCount) currentlyInsideCount.textContent = inside;
  if(leftTodayCount) leftTodayCount.textContent = leftToday;
  if(totalDailyCount) totalDailyCount.textContent = daily;
  
  // Calculate average stay duration (for those checked out today or all? Keep as all checked-out)
  const checkedOut = allVisitors.filter(v => v.exitTime && v.status === "checked-out");
  let totalMinutes = 0;
  checkedOut.forEach(v => {
    const entry = v.entryTime.toDate ? v.entryTime.toDate() : new Date(v.entryTime);
    const exit = v.exitTime.toDate ? v.exitTime.toDate() : new Date(v.exitTime);
    totalMinutes += Math.floor((exit - entry) / 60000);
  });
  const avg = checkedOut.length ? Math.round(totalMinutes / checkedOut.length) : 0;
  if (avgStayTimeSpan) avgStayTimeSpan.textContent = avg;
}

// ========== FILTERING ==========
function getFilteredVisitors() {
  let filtered = [...allVisitors];
  const term = searchInput?.value.toLowerCase() || '';
  if(term) filtered = filtered.filter(v => v.name?.toLowerCase().includes(term) || v.phone?.includes(term) || v.visitorId?.toLowerCase().includes(term));
  const status = statusFilter?.value || 'all';
  if(status !== 'all') filtered = filtered.filter(v => v.status === status);
  
  // Date range filter (used by export)
  if (currentDateRange.start && currentDateRange.end) {
    const startDate = new Date(currentDateRange.start);
    startDate.setHours(0,0,0,0);
    const endDate = new Date(currentDateRange.end);
    endDate.setHours(23,59,59,999);
    filtered = filtered.filter(v => {
      const entryDate = getEntryDate(v);
      return entryDate >= startDate && entryDate <= endDate;
    });
  } else if (dateFilter?.value) {
    const fd = new Date(dateFilter.value).toDateString();
    filtered = filtered.filter(v => getEntryDate(v).toDateString() === fd);
  }
  return filtered;
}

function applyFiltersAndRender() {
  const filtered = getFilteredVisitors();
  renderTable(filtered);
}

// ========== RENDER TABLE ==========
function renderTable(visitors) {
  if (!tableBody) return;
  if (!visitors.length) { tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No visitors found</td</td>'; return; }
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
    `;
  }).join('');
}
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':'&gt;'); }

// ========== EXPORT FUNCTIONS WITH DATE RANGE ==========
function getExportData() {
  return getFilteredVisitors(); // reuse the same filter logic (including date range)
}

function exportToCSV() {
  const data = getExportData();
  const headers = ['VisitorID','Name','Phone','NIN','Purpose','Visiting','EntryTime','ExitTime','Status'];
  const rows = data.map(v => [
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
  const data = getExportData();
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Visitor Management Report",20,20);
  doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`,20,28);
  doc.text(`Filtered Visitors Count: ${data.length}`,20,35);
  doc.text(`Currently Inside (filtered): ${data.filter(v=>v.status==='checked-in').length}`,20,41);
  let y=50; doc.setFontSize(9);
  data.forEach((v,i)=>{
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
    const body = encodeURIComponent(`Visitor Report\nGenerated: ${new Date().toLocaleString()}\nFiltered Visitors: ${getExportData().length}\nCurrently Inside (filtered): ${getExportData().filter(v=>v.status==='checked-in').length}`);
    window.location.href = `mailto:${email}?subject=${subj}&body=${body}`;
    alert(`Email client opened for ${email}`);
    if(emailModal) emailModal.style.display='none';
  });
}

// ========== WEEKLY REPORT BUTTON ==========
function generateWeeklyReport() {
  const start = startDateFilter?.value;
  const end = endDateFilter?.value;
  if (!start || !end) {
    alert("Please select both start and end dates for the weekly report.");
    return;
  }
  // Set the global date range and refresh the filtered view (optional)
  currentDateRange.start = start;
  currentDateRange.end = end;
  applyFiltersAndRender();  // show only those records in the table
  // Then export to CSV (or PDF) automatically? We'll give user choice.
  alert(`Date range set from ${start} to ${end}. Use Export CSV or PDF to save the weekly report.`);
}

if (weeklyReportBtn) weeklyReportBtn.addEventListener('click', generateWeeklyReport);

// Apply date range button
if (applyDateRangeBtn) {
  applyDateRangeBtn.addEventListener('click', () => {
    const start = startDateFilter?.value;
    const end = endDateFilter?.value;
    if (!start || !end) {
      alert("Please select both start and end dates.");
      return;
    }
    currentDateRange.start = start;
    currentDateRange.end = end;
    // clear the single date filter if any
    if (dateFilter) dateFilter.value = '';
    applyFiltersAndRender();
  });
}

// Clear filters (existing clear button)
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = 'all';
    if (dateFilter) dateFilter.value = '';
    if (startDateFilter) startDateFilter.value = '';
    if (endDateFilter) endDateFilter.value = '';
    currentDateRange.start = null;
    currentDateRange.end = null;
    applyFiltersAndRender();
  });
}

// Event listeners for existing filters
if (refreshBtn) refreshBtn.addEventListener('click', () => applyFiltersAndRender());
if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
if (dateFilter) dateFilter.addEventListener('change', () => {
  // clear date range when single date is used
  currentDateRange.start = null;
  currentDateRange.end = null;
  if (startDateFilter) startDateFilter.value = '';
  if (endDateFilter) endDateFilter.value = '';
  applyFiltersAndRender();
});
if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportToPDF);
if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
if (emailReportBtn) emailReportBtn.addEventListener('click', emailReport);

// Load initial data
loadReportsHistory();
startRealtimeListener();

// ========== AUTO-UPDATING TIME & DATE ==========
function updateDateTime() {
  const now = new Date();
  const footerDate = document.getElementById('footerDate');
  const footerTime = document.getElementById('footerTime');
  if(footerDate) footerDate.textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  if(footerTime) footerTime.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}
setInterval(updateDateTime,1000);
updateDateTime();
