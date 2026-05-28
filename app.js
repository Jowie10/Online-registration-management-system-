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
// BACKGROUND SLIDESHOW - ONLY LOADS EXISTING IMAGES
// ============================================

// List of images to try (in desired order)
const possibleImages = [
    "1.jpg", "1.jpeg",
    "2.jpg", "2.jpeg",
    "3.jpg", "3.jpeg",
    "4.jpg", "4.jpeg",
    "5.jpg", "5.jpeg",
    "6.jpg", "6.jpeg",
    "7.jpg", "7.jpeg",
    "8.jpg", "8.jpeg",
    "9.jpg", "9.jpeg",
    "10.jpg", "10.jpeg",
    "1.jpg", "1.jpeg",
    "2.jpg", "2.jpeg",
    "3.jpg", "3.jpeg",
    "4.jpg", "4.jpeg",
    "5.jpg", "5.jpeg",
    "6.jpg", "6.jpeg",
    "7.jpg", "7.jpeg",
    "8.jpg", "8.jpeg",
    "9.jpg", "9.jpeg",
    "10.jpg", "10.jpeg",
    
  
];

let validImages = []; // Will store only images that exist
let currentBgSlide = 0;
let bgSlideInterval = null;
const BG_SLIDE_INTERVAL_MS = 5000;
const bgSlideshowTrack = document.getElementById('bgSlideshowTrack');

// Function to check if an image exists
function imageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Function to find all existing images
async function findExistingImages() {
    const checkPromises = possibleImages.map(async (img) => {
        const exists = await imageExists(img);
        return { url: img, exists };
    });
    
    const results = await Promise.all(checkPromises);
    validImages = results.filter(r => r.exists).map(r => r.url);
    
    console.log('Found existing images:', validImages);
    
    if (validImages.length === 0) {
        console.warn('No background images found! Using fallback color.');
        // Add a fallback solid color background
        document.body.style.backgroundColor = '#0a2b4e';
        return false;
    }
    
    return true;
}

function buildBgSlideshow() {
    if (!bgSlideshowTrack) return;
    
    if (validImages.length === 0) return;
    
    bgSlideshowTrack.innerHTML = validImages.map((image, index) => `
        <div class="bg-slide" data-index="${index}">
            <img 
                src="${image}" 
                alt="ISBAT University Campus"
                class="bg-slide-image"
                loading="eager"
            >
        </div>
    `).join('');
}

function goToBgSlide(index) {
    if (validImages.length === 0) return;
    if (index < 0) index = validImages.length - 1;
    if (index >= validImages.length) index = 0;
    
    currentBgSlide = index;
    if (bgSlideshowTrack) {
        bgSlideshowTrack.style.transform = `translateX(-${currentBgSlide * 100}%)`;
    }
}

function nextBgSlide() {
    goToBgSlide(currentBgSlide + 1);
}

function startBgAutoPlay() {
    if (bgSlideInterval) clearInterval(bgSlideInterval);
    if (validImages.length <= 1) return; // Don't auto-play if only 1 image
    bgSlideInterval = setInterval(() => {
        nextBgSlide();
    }, BG_SLIDE_INTERVAL_MS);
}

async function initBgSlideshow() {
    const hasImages = await findExistingImages();
    if (hasImages) {
        buildBgSlideshow();
        startBgAutoPlay();
    }
}

// ============================================
// VISITOR FORM FUNCTIONALITY
// ============================================

const entryModeBtn = document.getElementById('entryModeBtn');
const exitModeBtn = document.getElementById('exitModeBtn');
const entryPanel = document.getElementById('entryPanel');
const exitPanel = document.getElementById('exitPanel');
const visitorForm = document.getElementById('visitorForm');
const successArea = document.getElementById('successArea');
const checkoutPhone = document.getElementById('checkoutPhone');
const manualCheckoutBtn = document.getElementById('manualCheckoutBtn');
const exitMessage = document.getElementById('exitMessage');
const messageArea = document.getElementById('messageArea');

function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
    setTimeout(() => {
        messageArea.style.display = 'none';
        messageArea.className = 'message-area';
    }, 5000);
}

entryModeBtn.addEventListener('click', () => {
    entryModeBtn.classList.add('active');
    exitModeBtn.classList.remove('active');
    entryPanel.classList.add('active-panel');
    exitPanel.classList.remove('active-panel');
    visitorForm.reset();
    if (successArea) successArea.style.display = 'none';
    if (exitMessage) exitMessage.innerHTML = '';
    if (checkoutPhone) checkoutPhone.value = '';
});

exitModeBtn.addEventListener('click', () => {
    exitModeBtn.classList.add('active');
    entryModeBtn.classList.remove('active');
    exitPanel.classList.add('active-panel');
    entryPanel.classList.remove('active-panel');
    if (exitMessage) exitMessage.innerHTML = '';
});

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
    
    if (!/^[\d\s+()-]{8,}$/.test(phone)) {
        showMessage('Please enter a valid phone number', 'error');
        return;
    }
    
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
        console.error("Check error:", err);
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
        
        if (successArea) {
            successArea.style.display = "block";
            setTimeout(() => {
                successArea.style.display = "none";
            }, 5000);
        }
        
        showMessage(`✅ Welcome ${name}! You have checked in successfully.`, 'success');
        visitorForm.reset();
        setTimeout(() => successArea.scrollIntoView({ behavior: "smooth" }), 100);
        
    } catch (err) {
        console.error("Check-in error:", err);
        showMessage('Failed to check-in. Please check Firebase configuration.', 'error');
    }
});

async function manualCheckout() {
    const phone = checkoutPhone?.value.trim();
    
    if (!phone) {
        if (exitMessage) {
            exitMessage.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Please enter your phone number';
            exitMessage.style.background = 'rgba(0,0,0,0.6)';
            exitMessage.style.color = '#fee2e2';
        }
        showMessage('Please enter your phone number', 'error');
        return;
    }
    
    if (exitMessage) {
        exitMessage.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Processing checkout...';
        exitMessage.style.background = 'rgba(0,0,0,0.6)';
        exitMessage.style.color = 'white';
    }
    
    try {
        const q = query(visitorsCollection, 
            where("phone", "==", phone),
            where("status", "==", "checked-in")
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            if (exitMessage) {
                exitMessage.innerHTML = '<i class="fas fa-times-circle"></i> No active visitor found with this phone number.';
                exitMessage.style.background = 'rgba(0,0,0,0.6)';
                exitMessage.style.color = '#fee2e2';
            }
            showMessage('No active visitor found with this phone number', 'error');
            return;
        }
        
        const docRef = snap.docs[0];
        const data = docRef.data();
        
        await updateDoc(docRef.ref, {
            exitTime: Timestamp.now(),
            status: "checked-out"
        });
        
        if (exitMessage) {
            exitMessage.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Goodbye ${data.name}! Thank you for visiting.`;
            exitMessage.style.background = 'rgba(0,0,0,0.6)';
            exitMessage.style.color = '#d1fae5';
        }
        
        showMessage(`${data.name} checked out successfully!`, 'success');
        if (checkoutPhone) checkoutPhone.value = '';
        
        setTimeout(() => {
            if (exitMessage) exitMessage.innerHTML = '';
        }, 5000);
        
    } catch (err) {
        console.error("Checkout error:", err);
        if (exitMessage) {
            exitMessage.innerHTML = '<i class="fas fa-bug"></i> Error during check-out. Please try again.';
            exitMessage.style.background = 'rgba(0,0,0,0.6)';
            exitMessage.style.color = '#fee2e2';
        }
        showMessage('Error during checkout. Please try again.', 'error');
    }
}

if (manualCheckoutBtn) {
    manualCheckoutBtn.addEventListener('click', manualCheckout);
}

if (checkoutPhone) {
    checkoutPhone.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') manualCheckout();
    });
}

window.addEventListener('beforeunload', () => {
    if (bgSlideInterval) clearInterval(bgSlideInterval);
});

// Start the slideshow
initBgSlideshow();