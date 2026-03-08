// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Konfigurasi Ashda Nusantara Farm Anda
const firebaseConfig = {
    apiKey: "AIzaSyB7Vy6F_MP_MqDafevAb5ePdQQ4O-OkB4E",
    authDomain: "ashdanusantarafarm-d3d45.firebaseapp.com",
    projectId: "ashdanusantarafarm-d3d45",
    storageBucket: "ashdanusantarafarm-d3d45.firebasestorage.app",
    messagingSenderId: "834435156617",
    appId: "1:834435156617:web:8b57ed07af78c45271d458"
};

// Inisialisasi Firebase & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Menangani Form Login
const formLogin = document.getElementById('formLogin');
const errorMsg = document.getElementById('errorMsg');
const btnLogin = document.getElementById('btnLogin');

formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Status Loading
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Memproses...';
    btnLogin.disabled = true;
    errorMsg.classList.add('hidden');

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Berhasil login!
            const user = userCredential.user;
            console.log("Login sukses:", user.email);
            // Pindahkan halaman ke Dashboard
            window.location.href = 'dashboard.html'; 
        })
        .catch((error) => {
            // Gagal login
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> Masuk Sistem';
            btnLogin.disabled = false;
            
            errorMsg.classList.remove('hidden');
            // Menerjemahkan pesan error Firebase
            if(error.code === 'auth/invalid-credential') {
                errorMsg.innerText = "Email atau Password salah!";
            } else if (error.code === 'auth/too-many-requests') {
                errorMsg.innerText = "Terlalu banyak percobaan. Coba lagi nanti.";
            } else {
                errorMsg.innerText = "Terjadi kesalahan: " + error.message;
            }
        });
});