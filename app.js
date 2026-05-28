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
import { getFirestore, collection, addDoc, updateDoc, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const visitorsCollection = collection(db, "visitors");

// ============================================
// BACKGROUND WATERMARK SLIDESHOW
// ============================================

// Image data for background slideshow (using your JPEG files)
const bgSlides = [
    "1.jpeg", "2.jpeg", "3.jpeg", "4.jpeg", "5.jpeg", 
    "6.jpeg", "8.jpeg", "10.jpeg", "1.jpeg", "3.jpeg"
];

let currentBgSlide = 0;
let bgSlideInterval = null;
const BG_SLIDE_INTERVAL_MS = 5000;

// Get background slideshow DOM elements
const bgSlideshowTrack = document.getElementById('bgSlideshowTrack');

// Build background slideshow
function buildBgSlideshow() {
    if (!bgSlideshowTrack) return;
    
    bgSlideshowTrack.innerHTML = bgSlides.map((image, index) => `
        <div class="bg-slide" data-index="${index}">
            <img 
                src="${image}" 
                alt="ISBAT University"
                class="bg-slide-image"
                onerror="this.src='https://placehold.co/1920x1080/0a2b4e/white?text=ISBAT+University'"
            >
        </div>
    `).join('');
}

// Go to specific background slide
function goToBgSlide(index) {
    if (index < 0) index = bgSlides.length - 1;
    if (index >= bgSlides.length) index = 0;
    
    currentBgSlide = index;
    if (bgSlideshowTrack) {
        bgSlideshowTrack.style.transform = `translateX(-${currentBgSlide * 100}%)`;
    }
}

// Next background slide
function nextBgSlide() {
    goToBgSlide(currentBgSlide + 1);
}

// Start background auto-play
function startBgAutoPlay() {
    if (bgSlideInterval) clearInterval(bgSlideInterval);
    bgSlideInterval = setInterval(() => {
        nextBgSlide();
    }, BG_SLIDE_INTERVAL_MS);
}

// Initialize background slideshow
function initBgSlideshow() {
    buildBgSlideshow();
    startBgAutoPlay();
}

// ============================================
// VISITOR FORM FUNCTIONALITY
// ============================================

// DOM Elements
const entryModeBtn = document.getElementById('entryModeBtn');
const exitModeBtn = document.getElementById('exitModeBtn');
const entryPanel = document.getElementById('entryPanel');
const exitPanel = document.getElementById('exitPanel');
const visitorForm = document.getElementById('visitorForm');
const qrResultArea = document.getElementById('qrResultArea');
const qrCodeCanvasDiv = document.getElementById('qrCodeCanvas');
const qrVisitorIdMsg = document.getElementById('qrVisitorIdMsg');
const exitScanResult = document.getElementById('exitScanResult');
const messageArea = document.getElementById('messageArea');
const checkoutPhone = document.getElementById('checkoutPhone');
const manualCheckoutBtn = document.getElementById('manualCheckoutBtn');
const downloadQRBtn = document.getElementById('downloadQRBtn');

let html5QrCodeScanner = null;
let currentScanning = false;

// Show message helper
function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
    setTimeout(() => {
        messageArea.style.display = 'none';
        messageArea.className = 'message-area';
    }, 5000);
}

// Switch between entry/exit panels
entryModeBtn.addEventListener('click', () => {
    entryModeBtn.classList.add('active');
    exitModeBtn.classList.remove('active');
    entryPanel.classList.add('active-panel');
    exitPanel.classList.remove('active-panel');
    stopScanner();
    qrResultArea.style.display = 'none';
    visitorForm.reset();
    if (exitScanResult) exitScanResult.innerHTML = '';
});

exitModeBtn.addEventListener('click', () => {
    exitModeBtn.classList.add('active');
    entryModeBtn.classList.remove('active');
    exitPanel.classList.add('active-panel');
    entryPanel.classList.remove('active-panel');
    qrResultArea.style.display = 'none';
    startScanner();
});

// Start QR scanner
async function startScanner() {
    if (!html5QrCodeScanner) {
        html5QrCodeScanner = new Html5Qrcode("qr-reader");
    }
    if (currentScanning) return;
    try {
        await html5QrCodeScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            onScanError
        );
        currentScanning = true;
        if (exitScanResult) {
            exitScanResult.innerHTML = '<i class="fas fa-camera"></i> Scanner active. Point camera at QR code.';
            exitScanResult.style.background = 'rgba(0,0,0,0.6)';
            exitScanResult.style.color = 'white';
        }
    } catch (err) {
        console.warn("Camera error:", err);
        if (exitScanResult) {
            exitScanResult.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Camera access denied. Please check permissions.';
            exitScanResult.style.background = 'rgba(0,0,0,0.6)';
            exitScanResult.style.color = '#fee2e2';
        }
    }
}

function stopScanner() {
    if (html5QrCodeScanner && currentScanning) {
        html5QrCodeScanner.stop().catch(e => console.log);
        currentScanning = false;
    }
}

// QR scan success handler
async function onScanSuccess(decodedText) {
    stopScanner();
    const visitorId = decodedText.trim();
    if (exitScanResult) {
        exitScanResult.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Processing checkout...';
    }

    try {
        const q = query(visitorsCollection, where("visitorId", "==", visitorId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            if (exitScanResult) {
                exitScanResult.innerHTML = '<i class="fas fa-times-circle"></i> Invalid QR: Visitor not found.';
                exitScanResult.style.background = 'rgba(0,0,0,0.6)';
                exitScanResult.style.color = '#fee2e2';
            }
            setTimeout(() => startScanner(), 2000);
            return;
        }
        
        const docRef = snap.docs[0];
        const data = docRef.data();
        
        if (data.status === "checked-out") {
            if (exitScanResult) {
                exitScanResult.innerHTML = '<i class="fas fa-clock"></i> Visitor already checked out.';
                exitScanResult.style.background = 'rgba(0,0,0,0.6)';
                exitScanResult.style.color = '#fef3c7';
            }
            setTimeout(() => startScanner(), 2000);
            return;
        }
        
        await updateDoc(docRef.ref, { 
            exitTime: Timestamp.now(), 
            status: "checked-out" 
        });
        
        if (exitScanResult) {
            exitScanResult.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Check-out successful! ${data.name} has left.`;
            exitScanResult.style.background = 'rgba(0,0,0,0.6)';
            exitScanResult.style.color = '#d1fae5';
        }
        showMessage(`${data.name} checked out successfully!`, 'success');
        
    } catch (err) {
        console.error("Checkout error:", err);
        if (exitScanResult) {
            exitScanResult.innerHTML = '<i class="fas fa-bug"></i> Error during check-out. Please try again.';
            exitScanResult.style.background = 'rgba(0,0,0,0.6)';
            exitScanResult.style.color = '#fee2e2';
        }
    }
    
    setTimeout(() => {
        if (exitPanel.classList.contains('active-panel')) {
            startScanner();
        }
    }, 2000);
}

function onScanError(errMsg) {
    // Silent error handling
}

// Manual checkout by phone
async function manualCheckout() {
    const phone = checkoutPhone.value.trim();
    if (!phone) {
        showMessage('Please enter your phone number', 'error');
        return;
    }
    
    try {
        const q = query(visitorsCollection, 
            where("phone", "==", phone),
            where("status", "==", "checked-in")
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            showMessage('No active visitor found with this phone number', 'error');
            return;
        }
        
        const docRef = snap.docs[0];
        const data = docRef.data();
        
        await updateDoc(docRef.ref, {
            exitTime: Timestamp.now(),
            status: "checked-out"
        });
        
        showMessage(`${data.name} checked out successfully!`, 'success');
        checkoutPhone.value = '';
        
    } catch (err) {
        console.error("Manual checkout error:", err);
        showMessage('Error during checkout. Please try again.', 'error');
    }
}

if (manualCheckoutBtn) {
    manualCheckoutBtn.addEventListener('click', manualCheckout);
}

// Generate QR code
function generateQRCode(text, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
    img.alt = "QR Code";
    img.style.width = "180px";
    img.style.margin = "auto";
    img.style.display = "block";
    container.appendChild(img);
}

// Download QR code
if (downloadQRBtn) {
    downloadQRBtn.addEventListener('click', () => {
        const visitorIdText = qrVisitorIdMsg?.textContent || '';
        const visitorId = visitorIdText.split(':')[1]?.trim();
        if (visitorId) {
            const link = document.createElement('a');
            link.download = `visitor_qr_${visitorId}.png`;
            link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(visitorId)}`;
            link.click();
        }
    });
}

// Handle check-in form submission
visitorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('visitorName').value.trim();
    const phone = document.getElementById('visitorPhone').value.trim();
    const purpose = document.getElementById('visitorPurpose').value;
    const visitingPerson = document.getElementById('visitingPerson')?.value.trim() || '';
    
    if (!name || !phone) {
        showMessage('Please enter name and phone number', 'error');
        return;
    }
    
    // Basic phone validation
    if (!/^[\d\s+()-]{8,}$/.test(phone)) {
        showMessage('Please enter a valid phone number', 'error');
        return;
    }
    
    // Check if visitor is already checked in
    try {
        const activeQuery = query(
            visitorsCollection, 
            where("phone", "==", phone), 
            where("status", "==", "checked-in")
        );
        const activeSnap = await getDocs(activeQuery);
        
        if (!activeSnap.empty) {
            showMessage('You are already checked in! Please check out when leaving.', 'error');
            return;
        }
    } catch (err) {
        console.error("Check active visitor error:", err);
    }
    
    const visitorId = `VIS_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const visitorData = {
        visitorId: visitorId,
        name: name,
        phone: phone,
        purpose: purpose,
        visitingPerson: visitingPerson,
        entryTime: Timestamp.now(),
        exitTime: null,
        status: "checked-in"
    };
    
    try {
        await addDoc(visitorsCollection, visitorData);
        
        qrResultArea.style.display = "block";
        generateQRCode(visitorId, "qrCodeCanvas");
        qrVisitorIdMsg.innerHTML = `<i class="fas fa-id-card"></i> Visitor ID: ${visitorId}<br>Show this QR code to exit.`;
        
        showMessage(`${name} checked in successfully!`, 'success');
        visitorForm.reset();
        
        // Scroll to QR
        setTimeout(() => qrResultArea.scrollIntoView({ behavior: "smooth" }), 100);
        
    } catch (err) {
        console.error("Check-in error:", err);
        showMessage('Failed to check-in. Please check Firebase configuration.', 'error');
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (html5QrCodeScanner && currentScanning) {
        html5QrCodeScanner.stop();
    }
    if (bgSlideInterval) {
        clearInterval(bgSlideInterval);
    }
});

// Initialize background slideshow and scanner
initBgSlideshow();
if (exitPanel && exitPanel.classList.contains('active-panel')) {
    startScanner();
}