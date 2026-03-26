// Firebase Configuration - REPLACE WITH YOUR OWN FIREBASE PROJECT CREDENTIALS
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp, onSnapshot, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const visitorsCollection = collection(db, "visitors");

// DOM Elements
const entryModeBtn = document.getElementById('entryModeBtn');
const exitModeBtn = document.getElementById('exitModeBtn');
const entryPanel = document.getElementById('entryPanel');
const exitPanel = document.getElementById('exitPanel');
const visitorForm = document.getElementById('visitorForm');
const qrResultArea = document.getElementById('qrResultArea');
const qrCodeCanvasDiv = document.getElementById('qrCodeCanvas');
const qrVisitorIdMsg = document.getElementById('qrVisitorIdMsg');
const exitScanResultDiv = document.getElementById('exitScanResult');

let html5QrCodeScanner = null;
let currentScanning = false;

// Switch between entry/exit panels
entryModeBtn.addEventListener('click', () => {
    entryModeBtn.classList.add('active');
    exitModeBtn.classList.remove('active');
    entryPanel.classList.add('active-panel');
    exitPanel.classList.remove('active-panel');
    stopScanner();
    qrResultArea.style.display = 'none';
    visitorForm.reset();
});

exitModeBtn.addEventListener('click', () => {
    exitModeBtn.classList.add('active');
    entryModeBtn.classList.remove('active');
    exitPanel.classList.add('active-panel');
    entryPanel.classList.remove('active-panel');
    qrResultArea.style.display = 'none';
    startScanner();
});

async function startScanner() {
    if (!html5QrCodeScanner) {
        html5QrCodeScanner = new Html5Qrcode("qr-reader");
    }
    if (currentScanning) return;
    try {
        await html5QrCodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, onScanError);
        currentScanning = true;
        exitScanResultDiv.innerHTML = '<i class="fas fa-camera"></i> Scanner active. Point at QR code.';
    } catch (err) {
        console.warn("Camera error:", err);
        exitScanResultDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Camera access denied.';
    }
}

function stopScanner() {
    if (html5QrCodeScanner && currentScanning) {
        html5QrCodeScanner.stop().catch(e => console.log);
        currentScanning = false;
    }
}

async function onScanSuccess(decodedText) {
    stopScanner();
    const visitorId = decodedText.trim();
    exitScanResultDiv.innerHTML = `<i class="fas fa-spinner fa-pulse"></i> Processing checkout...`;

    try {
        const q = query(visitorsCollection, where("visitorId", "==", visitorId));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const docRef = snap.docs[0];
            const data = docRef.data();
            if (data.status === "checked-out") {
                exitScanResultDiv.innerHTML = '<i class="fas fa-clock"></i> Visitor already checked out.';
                startScanner();
                return;
            }
            await updateDoc(docRef.ref, { exitTime: Timestamp.now(), status: "checked-out" });
            exitScanResultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Check-out successful! ${data.name} has left.`;
        } else {
            exitScanResultDiv.innerHTML = '<i class="fas fa-times-circle"></i> Invalid QR: Visitor not found.';
        }
    } catch (err) {
        console.error(err);
        exitScanResultDiv.innerHTML = '<i class="fas fa-bug"></i> Error during check-out.';
    }
    setTimeout(() => { if (exitPanel.classList.contains('active-panel')) startScanner(); }, 2000);
}

function onScanError(errMsg) { }

function generateQRCode(text, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
    img.alt = "QR Code";
    img.style.width = "160px";
    img.style.margin = "auto";
    img.style.display = "block";
    container.appendChild(img);
}

visitorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('visitorName').value.trim();
    const phone = document.getElementById('visitorPhone').value.trim();
    const purpose = document.getElementById('visitorPurpose').value;
    if (!name || !phone) {
        alert("Please enter name and phone");
        return;
    }

    const visitorId = `VIS_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const visitorData = {
        visitorId: visitorId,
        name: name,
        phone: phone,
        purpose: purpose,
        entryTime: Timestamp.now(),
        exitTime: null,
        status: "checked-in"
    };

    try {
        await addDoc(visitorsCollection, visitorData);
        qrResultArea.style.display = "block";
        generateQRCode(visitorId, "qrCodeCanvas");
        qrVisitorIdMsg.innerHTML = `<i class="fas fa-id-card"></i> Visitor ID: ${visitorId}<br>Show this QR to exit.`;
        visitorForm.reset();
        setTimeout(() => qrResultArea.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
        console.error("Check-in error:", err);
        alert("Failed to check-in. Check Firebase configuration.");
    }
});

window.addEventListener('beforeunload', () => { if (html5QrCodeScanner && currentScanning) html5QrCodeScanner.stop(); });
if (exitPanel.classList.contains('active-panel')) startScanner();