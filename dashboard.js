// ============================================================================
// DASHBOARD.JS - SAAS MULTI-TENANT + GLOBAL LOGISTICS DASHBOARD
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, setDoc, doc, updateDoc, 
    deleteDoc, onSnapshot, increment, query, orderBy, limit, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyB7Vy6F_MP_MqDafevAb5ePdQQ4O-OkB4E",
    authDomain: "ashdanusantarafarm-d3d45.firebaseapp.com",
    projectId: "ashdanusantarafarm-d3d45",
    storageBucket: "ashdanusantarafarm-d3d45.firebasestorage.app",
    messagingSenderId: "834435156617",
    appId: "1:834435156617:web:8b57ed07af78c45271d458"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const formatAngka = (angka) => new Intl.NumberFormat('id-ID').format(angka);
const formatRupiah = (angka) => 'Rp ' + new Intl.NumberFormat('id-ID').format(angka);

// Variabel Global
let myMap = null;
let userMarker;
let otherMarkers = [];

// ==========================================
// GANTI DENGAN EMAIL UTAMA ANDA!
// ==========================================
const SUPER_ADMIN_EMAIL = "owner@ashdanusantara.com"; 

// ==========================================
// 2. PENJAGA KEAMANAN & MANAJEMEN SESI (ROLE BASED)
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("login.html");
    } else {
        console.log("Logged in:", user.email);
        
        if (user.email === SUPER_ADMIN_EMAIL) {
            // TAMPILAN KHUSUS SUPER ADMIN
            document.getElementById('nav-admin').classList.remove('hidden');
            document.getElementById('nav-peternak').classList.add('hidden');
            document.getElementById('label-role-aktif').innerText = "Super Admin";
            document.getElementById('txt-nama-sistem').innerText = "ANF Master Control";
            
            // Set halaman default Admin
            document.getElementById('pageTitle').innerText = "Global Distribusi";
            document.getElementById('sec-super-dashboard').classList.remove('hidden');

            setupNavigasi();
            initSuperAdminDashboard(); // Fitur baru Agregat Logistik
            initSuperAdminPanel();     // Manajemen Masa Aktif
            initCRUDHarga(user.uid, true); // Admin bisa edit harga global
        } else {
            // TAMPILAN KHUSUS KLIEN PETERNAK
            document.getElementById('nav-peternak').classList.remove('hidden');
            document.getElementById('nav-admin').classList.add('hidden');
            document.getElementById('label-role-aktif').innerText = "Peternak";
            
            // Set halaman default Peternak
            document.getElementById('pageTitle').innerText = "Dashboard Utama";
            document.getElementById('sec-dashboard').classList.remove('hidden');

            setupNavigasi();
            initProfilDanPeta(user.uid);
            initDashboardUtama(user.uid); 
            initCRUDKandang(user.uid);
            initCRUDProduksi(user.uid);
            initCRUDEkonomi(user.uid);
            initCRUDHarga(user.uid, false); // Peternak hanya bisa lihat harga
            initLaporanKeuangan(user.uid); 
        }
    }
});

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("Anda yakin ingin keluar?")) {
            signOut(auth).catch(err => alert("Gagal logout: " + err.message));
        }
    });
}

const btnKeluarBlocker = document.getElementById('btnKeluarBlocker');
if (btnKeluarBlocker) {
    btnKeluarBlocker.addEventListener('click', () => {
        signOut(auth).catch(err => alert("Gagal logout: " + err.message));
    });
}

// ==========================================
// 3. FUNGSI NAVIGASI
// ==========================================
function setupNavigasi() {
    const today = new Date();
    document.getElementById('current-date').innerText = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.querySelectorAll('input[type="date"]').forEach(input => input.value = today.toISOString().split('T')[0]);

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('pageTitle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }

    document.getElementById('openSidebar').addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar').addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            
            sections.forEach(sec => sec.classList.add('hidden'));
            document.getElementById(targetId).classList.remove('hidden');
            pageTitle.innerText = this.innerText;

            navLinks.forEach(l => {
                l.classList.remove('bg-green-900', 'border-l-4', 'border-yellow-400', 'bg-gray-900');
                l.classList.add('hover:bg-green-700');
            });
            
            if (this.closest('#nav-admin')) {
                this.classList.add('bg-gray-900', 'border-l-4', 'border-yellow-400');
            } else {
                this.classList.add('bg-green-900', 'border-l-4', 'border-yellow-400');
            }
            this.classList.remove('hover:bg-green-700', 'hover:bg-gray-800');

            if (window.innerWidth < 768) toggleSidebar();
            
            if(targetId === 'sec-pengaturan' && myMap) {
                setTimeout(() => myMap.invalidateSize(), 300);
            }
        });
    });
}

// ==========================================
// A. FITUR BARU: DASHBOARD DISTRIBUSI GLOBAL (KHUSUS SUPER ADMIN)
// ==========================================
function initSuperAdminDashboard() {
    let prodListeners = {};
    let globalProdData = {};

    onSnapshot(collection(db, "peternakan"), (snapshot) => {
        snapshot.forEach(docSnap => {
            const userId = docSnap.id;
            const klienData = docSnap.data();

            if (!prodListeners[userId]) {
                // Inisialisasi struktur data per klien
                globalProdData[userId] = { 
                    nama: klienData.nama_peternakan || "Klien " + userId.substring(0,4),
                    telurHariIni: 0,
                    telurBulanIni: 0,
                    lat: klienData.lat,
                    lng: klienData.lng
                };

                // Pasang listener spesifik ke jurnal produksi klien ini
                const q = query(collection(db, "peternakan", userId, "produksi_harian"));
                prodListeners[userId] = onSnapshot(q, (prodSnap) => {
                    let tHariIni = 0; let tBulanIni = 0;
                    const d = new Date();
                    const tdy = d.toISOString().split('T')[0];
                    const cMo = String(d.getMonth() + 1).padStart(2, '0');
                    const cYr = String(d.getFullYear());

                    prodSnap.forEach(pDoc => {
                        const p = pDoc.data();
                        if (p.tanggal === tdy) tHariIni += p.total_telur_kg;
                        
                        const pD = new Date(p.tanggal);
                        if (String(pD.getMonth()+1).padStart(2,'0') === cMo && String(pD.getFullYear()) === cYr) {
                            tBulanIni += p.total_telur_kg;
                        }
                    });

                    globalProdData[userId].telurHariIni = tHariIni;
                    globalProdData[userId].telurBulanIni = tBulanIni;
                    renderSuperDashboard(); 
                });
            } else {
                // Update nama/lokasi saja jika ada perubahan profil
                globalProdData[userId].nama = klienData.nama_peternakan || "Klien " + userId.substring(0,4);
                globalProdData[userId].lat = klienData.lat;
                globalProdData[userId].lng = klienData.lng;
                renderSuperDashboard();
            }
        });
    });

    function renderSuperDashboard() {
        let gtHariIni = 0; let gtBulanIni = 0;
        let tbody = '';
        const tBodyEl = document.getElementById('tabel-distribusi');
        if(!tBodyEl) return;

        Object.keys(globalProdData).forEach(uid => {
            const d = globalProdData[uid];
            gtHariIni += d.telurHariIni;
            gtBulanIni += d.telurBulanIni;
            
            let locBtn = '<span class="text-xs text-gray-400">Belum diset</span>';
            if (d.lat && d.lng) {
                locBtn = `<a href="https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}" target="_blank" class="text-blue-600 hover:underline font-medium"><i class="fa-solid fa-map-location-dot"></i> Buka Maps</a>`;
            }

            tbody += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3 font-semibold text-gray-800">${d.nama}</td>
                    <td class="p-3">${locBtn}</td>
                    <td class="p-3 text-green-700 font-bold">${formatAngka(d.telurHariIni)} kg</td>
                    <td class="p-3 text-blue-700 font-bold">${formatAngka(d.telurBulanIni)} kg</td>
                </tr>
            `;
        });

        document.getElementById('super-telur-hari-ini').innerHTML = `${formatAngka(gtHariIni)} <span class="text-sm font-normal text-gray-500">kg</span>`;
        document.getElementById('super-telur-bulan-ini').innerHTML = `${formatAngka(gtBulanIni)} <span class="text-sm font-normal text-gray-500">kg</span>`;
        document.getElementById('super-klien-aktif').innerText = Object.keys(globalProdData).length;
        tBodyEl.innerHTML = tbody;
    }
}

// ==========================================
// B. FITUR KHUSUS: MANAJEMEN MASA AKTIF KLIEN
// ==========================================
function initSuperAdminPanel() {
    const tabelKlien = document.getElementById('tabel-daftar-klien');
    
    onSnapshot(collection(db, "peternakan"), (snapshot) => {
        tabelKlien.innerHTML = '';
        if (snapshot.empty) { tabelKlien.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-gray-500">Belum ada klien terdaftar.</td></tr>'; return; }

        snapshot.forEach(docSnap => {
            const userId = docSnap.id;
            const data = docSnap.data();
            const namaKlien = data.nama_peternakan || "<span class='text-gray-400 italic'>Belum Set Nama</span>";
            const expiredDate = data.berlaku_sampai || null;
            
            let statusHtml = ''; let tglTeks = '-';

            if (expiredDate) {
                const tglExp = new Date(expiredDate);
                const tglHariIni = new Date();
                tglHariIni.setHours(0,0,0,0); tglExp.setHours(0,0,0,0);
                
                const selisihHari = Math.ceil((tglExp.getTime() - tglHariIni.getTime()) / (1000 * 3600 * 24));
                tglTeks = tglExp.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                if (selisihHari < 0) statusHtml = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">KEDALUWARSA</span>`;
                else if (selisihHari <= 7) statusHtml = `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">SISA ${selisihHari} HARI</span>`;
                else statusHtml = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">AKTIF</span>`;
            } else {
                statusHtml = `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">BELUM DISET</span>`;
            }

            const tr = document.createElement('tr'); tr.className = 'border-b hover:bg-gray-50';
            tr.innerHTML = `
                <td class="p-3 text-xs font-mono text-gray-500">${userId}</td>
                <td class="p-3 font-semibold text-gray-800">${namaKlien}</td>
                <td class="p-3 text-gray-600">${tglTeks}</td>
                <td class="p-3">${statusHtml}</td>
                <td class="p-3 text-right">
                    <button class="btn-set-expired bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors" data-uid="${userId}" data-nama="${data.nama_peternakan || 'Klien'}">
                        <i class="fa-solid fa-calendar-plus mr-1"></i> Set Waktu
                    </button>
                </td>
            `;
            tabelKlien.appendChild(tr);
        });

        document.querySelectorAll('.btn-set-expired').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetUid = e.currentTarget.getAttribute('data-uid');
                const targetNama = e.currentTarget.getAttribute('data-nama');
                const tglBaru = prompt(`Masukkan tanggal berakhir berlangganan untuk "${targetNama}"\nFormat: YYYY-MM-DD\nContoh: 2026-04-15`);
                
                if (tglBaru) {
                    if(!tglBaru.match(/^\d{4}-\d{2}-\d{2}$/)) return alert("Format salah! Harus YYYY-MM-DD.");
                    try {
                        await setDoc(doc(db, "peternakan", targetUid), { berlaku_sampai: tglBaru }, { merge: true });
                    } catch (error) { alert("Gagal update: " + error.message); }
                }
            });
        });
    });
}


// ==========================================
// C. PROFIL, PETA & CEK MASA AKTIF (PETERNAK)
// ==========================================
function initProfilDanPeta(userId) {
    const sidebarTitle = document.querySelector('aside h1');
    const profilDocRef = doc(db, "peternakan", userId); 

    if (!myMap) {
        myMap = L.map('mapContainer').setView([-7.5, 112.5], 8); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(myMap);

        myMap.on('click', function(e) {
            document.getElementById('inputLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('inputLng').value = e.latlng.lng.toFixed(6);
            const blueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
            if (userMarker) myMap.removeLayer(userMarker);
            userMarker = L.marker(e.latlng, {icon: blueIcon}).addTo(myMap).bindPopup("Lokasi Terpilih! Klik Simpan.").openPopup();
        });
    }

    const blueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const redIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

    onSnapshot(profilDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            sidebarTitle.innerText = data.nama_peternakan || "Sistem Peternak";
            
            document.getElementById('inputNamaFarm').value = data.nama_peternakan || "";
            document.getElementById('inputLat').value = data.lat || "";
            document.getElementById('inputLng').value = data.lng || "";

            if (data.lat && data.lng) {
                const latLng = [parseFloat(data.lat), parseFloat(data.lng)];
                if (userMarker) myMap.removeLayer(userMarker);
                userMarker = L.marker(latLng, {icon: blueIcon}).addTo(myMap).bindPopup("<b>Lokasi Anda</b><br>"+(data.nama_peternakan||"")).openPopup();
                myMap.setView(latLng, 11);
            }

            // CEK MASA AKTIF
            if (data.berlaku_sampai) {
                const tglExpired = new Date(data.berlaku_sampai);
                const tglHariIni = new Date();
                tglHariIni.setHours(0,0,0,0); tglExpired.setHours(0,0,0,0);

                const selisihHari = Math.ceil((tglExpired.getTime() - tglHariIni.getTime()) / (1000 * 3600 * 24));
                const banner = document.getElementById('banner-langganan');
                const blocker = document.getElementById('blocker-langganan');

                if (selisihHari < 0) {
                    blocker.classList.remove('hidden'); blocker.classList.add('flex'); banner.classList.add('hidden');
                } else if (selisihHari <= 7) {
                    banner.classList.remove('hidden'); banner.classList.add('flex');
                    document.getElementById('sisa-hari').innerText = selisihHari;
                    blocker.classList.add('hidden'); blocker.classList.remove('flex');
                } else {
                    banner.classList.add('hidden'); blocker.classList.add('hidden');
                }
            }
        }
    });

    onSnapshot(collection(db, "public_farms"), (snapshot) => {
        otherMarkers.forEach(m => myMap.removeLayer(m));
        otherMarkers = [];

        snapshot.forEach(docSnap => {
            if (docSnap.id !== userId) { 
                const data = docSnap.data();
                if (data.lat && data.lng) {
                    const marker = L.marker([parseFloat(data.lat), parseFloat(data.lng)], {icon: redIcon})
                        .addTo(myMap)
                        .bindPopup(`<b>Mitra ANF:</b><br>${data.nama_peternakan}`);
                    otherMarkers.push(marker);
                }
            }
        });
    });

    document.getElementById('formProfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSimpanProfil');
        const msg = document.getElementById('msgProfil');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        
        try {
            const namaBaru = document.getElementById('inputNamaFarm').value;
            const lat = document.getElementById('inputLat').value;
            const lng = document.getElementById('inputLng').value;

            await setDoc(profilDocRef, { nama_peternakan: namaBaru, lat: lat, lng: lng }, { merge: true });
            await setDoc(doc(db, "public_farms", userId), { nama_peternakan: namaBaru, lat: lat, lng: lng });

            msg.className = "mt-3 p-3 text-sm font-medium bg-green-100 text-green-800 rounded block";
            msg.innerHTML = '<i class="fa-solid fa-check-circle"></i> Profil berhasil diperbarui!';
        } catch (error) {
            msg.className = "mt-3 p-3 text-sm font-medium bg-red-100 text-red-800 rounded block";
            msg.innerText = "Gagal menyimpan: " + error.message;
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save mr-2"></i> Simpan Profil & Lokasi';
            setTimeout(() => msg.classList.add('hidden'), 4000);
        }
    });
}


// ==========================================
// D. SINKRONISASI DASHBOARD UTAMA (PETERNAK)
// ==========================================
function initDashboardUtama(userId) {
    const elProduksi = document.getElementById('dash-produksi-hari-ini');
    const elHdp = document.getElementById('dash-hdp-hari-ini');
    const elKas = document.getElementById('dash-kas-bulan-ini');
    let myChart = null;

    const qProd = query(collection(db, "peternakan", userId, "produksi_harian"), orderBy("tanggal", "desc"), limit(50));
    
    onSnapshot(qProd, (snapshot) => {
        const todayStr = new Date().toISOString().split('T')[0];
        let totalTelurHariIni = 0; let totalHdpHariIni = 0; let countKandangHariIni = 0;
        const rekapHarian = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const tgl = data.tanggal;

            if (!rekapHarian[tgl]) rekapHarian[tgl] = { telur: 0, pakan: 0 };
            rekapHarian[tgl].telur += data.total_telur_kg;
            rekapHarian[tgl].pakan += data.pakan_habis_kg;

            if (tgl === todayStr) {
                totalTelurHariIni += data.total_telur_kg;
                totalHdpHariIni += data.hdp_persen;
                countKandangHariIni++;
            }
        });

        elProduksi.innerHTML = `${totalTelurHariIni.toFixed(1)} <span class="text-sm font-normal text-gray-500">kg</span>`;
        if (countKandangHariIni > 0) {
            elHdp.innerHTML = `${(totalHdpHariIni / countKandangHariIni).toFixed(1)} <span class="text-sm font-normal text-gray-500">%</span>`;
        } else {
            elHdp.innerHTML = `0 <span class="text-sm font-normal text-gray-500">%</span>`;
        }

        const sortedDates = Object.keys(rekapHarian).sort().slice(-7); 
        const labels = []; const dataTelur = []; const dataPakan = [];

        sortedDates.forEach(tgl => {
            labels.push(new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            dataTelur.push(rekapHarian[tgl].telur.toFixed(1));
            dataPakan.push(rekapHarian[tgl].pakan.toFixed(1));
        });

        const ctx = document.getElementById('chartProduksi').getContext('2d');
        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Produksi Telur (Kg)', data: dataTelur, borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 3, tension: 0.3, fill: true, yAxisID: 'y' },
                    { label: 'Konsumsi Pakan (Kg)', data: dataPakan, borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 2, borderDash: [5, 5], tension: 0.3, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top' } },
                scales: {
                    x: { grid: { display: false } },
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Telur (Kg)' } },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Pakan (Kg)' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    });

    onSnapshot(collection(db, "peternakan", userId, "transaksi_keuangan"), (snapshot) => {
        const d = new Date();
        const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
        const currentYear = String(d.getFullYear());
        let kasMasukBulanIni = 0; let kasKeluarBulanIni = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const tglTrx = new Date(data.tanggal_transaksi);
            const trxMonth = String(tglTrx.getMonth() + 1).padStart(2, '0');
            const trxYear = String(tglTrx.getFullYear());

            if (trxMonth === currentMonth && trxYear === currentYear) {
                if (data.tipe_transaksi === 'pemasukan') kasMasukBulanIni += data.nominal;
                else kasKeluarBulanIni += data.nominal; 
            }
        });

        const netCashFlow = kasMasukBulanIni - kasKeluarBulanIni;
        if (netCashFlow > 0) elKas.innerHTML = `<span class="text-green-600">+ ${formatRupiah(netCashFlow)}</span>`;
        else if (netCashFlow < 0) elKas.innerHTML = `<span class="text-red-600">- ${formatRupiah(Math.abs(netCashFlow))}</span>`;
        else elKas.innerHTML = formatRupiah(0);
    });
}


// ==========================================
// E. CRUD MANAJEMEN KANDANG
// ==========================================
function initCRUDKandang(userId) {
    const tbodyKandang = document.getElementById('tabel-kandang-body');
    const selectKandang = document.getElementById('idKandang');
    const labelDashPopulasi = document.getElementById('dash-populasi');
    
    const modal = document.getElementById('modalKandang');
    const formKandang = document.getElementById('formTambahKandang');
    const modalTitle = document.querySelector('#modalKandang h3');
    const inputId = document.getElementById('idKandangBaru');
    
    let isEditMode = false;
    let currentEditId = null;
    let kandangDataList = {}; 

    const kandangColl = collection(db, "peternakan", userId, "kandang");

    onSnapshot(kandangColl, (snapshot) => {
        tbodyKandang.innerHTML = ''; selectKandang.innerHTML = '<option value="">-- Pilih Kandang --</option>';
        let totalPopulasi = 0; kandangDataList = {}; 

        if (snapshot.empty) {
            tbodyKandang.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-500">Belum ada data kandang.</td></tr>`;
            labelDashPopulasi.innerHTML = "0 <span class='text-sm font-normal text-gray-500'>ekor</span>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data(); const id = docSnap.id;
            totalPopulasi += data.populasi_aktif; kandangDataList[id] = data; 

            let statusBadge = data.status === 'Produksi' ? 'bg-green-100 text-green-700' : (data.status === 'Kosong' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700');
            
            const tr = document.createElement('tr'); tr.className = 'border-b hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-medium">${id} <br><span class="text-xs text-gray-500">${data.nama_kandang}</span></td>
                <td class="p-3">${data.tipe}</td>
                <td class="p-3">${formatAngka(data.kapasitas_maksimal)}</td>
                <td class="p-3 text-green-700 font-bold">${formatAngka(data.populasi_aktif)}</td>
                <td class="p-3"><span class="${statusBadge} px-2 py-1 rounded text-xs font-semibold">${data.status}</span></td>
                <td class="p-3 flex gap-2">
                    <button class="btn-edit-kandang text-blue-500 hover:text-blue-700 text-sm bg-blue-50 px-2 py-1 rounded" data-id="${id}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-hapus-kandang text-red-500 hover:text-red-700 text-sm bg-red-50 px-2 py-1 rounded" data-id="${id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbodyKandang.appendChild(tr);
            if (data.status !== 'Kosong') selectKandang.innerHTML += `<option value="${id}" data-populasi="${data.populasi_aktif}">${data.nama_kandang} (Populasi: ${formatAngka(data.populasi_aktif)})</option>`;
        });

        labelDashPopulasi.innerHTML = `${formatAngka(totalPopulasi)} <span class='text-sm font-normal text-gray-500'>ekor</span>`;

        document.querySelectorAll('.btn-edit-kandang').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idEdit = e.currentTarget.getAttribute('data-id'); const data = kandangDataList[idEdit];
                isEditMode = true; currentEditId = idEdit;
                modalTitle.innerText = "Edit Data Kandang"; inputId.value = idEdit; inputId.readOnly = true; inputId.classList.add('bg-gray-100', 'cursor-not-allowed'); 
                document.getElementById('namaKandangBaru').value = data.nama_kandang; document.getElementById('kapasitasKandangBaru').value = data.kapasitas_maksimal; document.getElementById('populasiKandangBaru').value = data.populasi_aktif; document.getElementById('tipeKandangBaru').value = data.tipe; document.getElementById('statusKandangBaru').value = data.status;
                modal.classList.remove('hidden'); 
            });
        });

        document.querySelectorAll('.btn-hapus-kandang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm(`Yakin ingin menghapus kandang ini?`)) await deleteDoc(doc(kandangColl, e.currentTarget.getAttribute('data-id')));
            });
        });
    });

    document.getElementById('btnTambahKandang').addEventListener('click', () => {
        isEditMode = false; currentEditId = null; formKandang.reset();
        modalTitle.innerText = "Data Kandang Baru"; inputId.readOnly = false; inputId.classList.remove('bg-gray-100', 'cursor-not-allowed');
        modal.classList.remove('hidden');
    });

    document.getElementById('closeModalKandang').addEventListener('click', () => modal.classList.add('hidden'));

    formKandang.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSimpan = document.getElementById('btnSimpanKandangBaru'); btnSimpan.disabled = true; btnSimpan.innerText = "Menyimpan...";
        const idInputVal = inputId.value.trim().toUpperCase();
        
        try {
            if (isEditMode) {
                await updateDoc(doc(kandangColl, currentEditId), {
                    nama_kandang: document.getElementById('namaKandangBaru').value, kapasitas_maksimal: parseInt(document.getElementById('kapasitasKandangBaru').value), populasi_aktif: parseInt(document.getElementById('populasiKandangBaru').value), tipe: document.getElementById('tipeKandangBaru').value, status: document.getElementById('statusKandangBaru').value, updated_at: new Date()
                });
            } else {
                const docRef = doc(kandangColl, idInputVal);
                if ((await getDoc(docRef)).exists()) { alert(`ID Kandang "${idInputVal}" terpakai!`); btnSimpan.disabled = false; btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database'; return; }
                await setDoc(docRef, { nama_kandang: document.getElementById('namaKandangBaru').value, kapasitas_maksimal: parseInt(document.getElementById('kapasitasKandangBaru').value), populasi_aktif: parseInt(document.getElementById('populasiKandangBaru').value), tipe: document.getElementById('tipeKandangBaru').value, status: document.getElementById('statusKandangBaru').value, created_at: new Date() });
            }
            formKandang.reset(); modal.classList.add('hidden');
        } catch (error) { alert("Error: " + error.message); } 
        finally { btnSimpan.disabled = false; btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database'; }
    });
}


// ==========================================
// F. CRUD JURNAL PRODUKSI
// ==========================================
function initCRUDProduksi(userId) {
    const formProduksi = document.getElementById('formProduksi');
    const selectKandang = document.getElementById('idKandang');
    const inputPakanKg = document.getElementById('pakanKg');
    const tabelRiwayatProduksi = document.getElementById('tabel-riwayat-produksi');

    const kandangColl = collection(db, "peternakan", userId, "kandang");
    const produksiColl = collection(db, "peternakan", userId, "produksi_harian");

    let mapKandang = {};
    onSnapshot(kandangColl, (snap) => { mapKandang = {}; snap.forEach(doc => { mapKandang[doc.id] = doc.data().nama_kandang; }); });

    selectKandang.addEventListener('change', function() {
        if (this.value !== "") {
            const popAktif = parseFloat(this.options[this.selectedIndex].getAttribute('data-populasi'));
            inputPakanKg.value = ((popAktif * 120) / 1000).toFixed(1);
            inputPakanKg.classList.add('bg-yellow-50', 'transition-colors');
            setTimeout(() => inputPakanKg.classList.remove('bg-yellow-50'), 1000);
        } else { inputPakanKg.value = ""; }
    });

    formProduksi.addEventListener('submit', async (e) => {
        e.preventDefault(); const btnSubmit = document.getElementById('btnSubmit'); const statusMsg = document.getElementById('statusMsg');
        btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

        try {
            const idKandang = selectKandang.value;
            const popAwal = parseFloat(selectKandang.options[selectKandang.selectedIndex].getAttribute('data-populasi'));
            const mati = parseInt(document.getElementById('mortalitas').value);
            const pakan = parseFloat(inputPakanKg.value); 
            const utuhGr = parseFloat(document.getElementById('telurUtuhGr').value);
            const bentesGr = parseFloat(document.getElementById('telurBentesGr').value);

            const totTelurKg = (utuhGr + bentesGr) / 1000; 
            const fcr = totTelurKg > 0 ? (pakan / totTelurKg).toFixed(2) : 0;
            const estButir = (utuhGr + bentesGr) / 62.5; 
            const hdp = (popAwal - mati) > 0 ? ((estButir / (popAwal - mati)) * 100).toFixed(2) : 0;

            await addDoc(produksiColl, { id_kandang: idKandang, tanggal: document.getElementById('tanggal').value, pakan_habis_kg: pakan, mortalitas_ekor: mati, telur_utuh_gr: utuhGr, telur_bentes_gr: bentesGr, total_telur_kg: totTelurKg, estimasi_butir: Math.round(estButir), fcr: parseFloat(fcr), hdp_persen: parseFloat(hdp), timestamp: new Date() });
            if (mati > 0) await updateDoc(doc(kandangColl, idKandang), { populasi_aktif: increment(-mati) });

            statusMsg.className = "mt-4 p-3 rounded-md bg-green-100 text-green-700 block text-sm";
            statusMsg.innerHTML = `Tersimpan! HDP: <b>${hdp}%</b> | FCR: <b>${fcr}</b>`;
            formProduksi.reset(); document.getElementById('tanggal').value = new Date().toISOString().split('T')[0];
        } catch (err) {
            statusMsg.className = "mt-4 p-3 rounded bg-red-100 text-red-700 block text-sm"; statusMsg.innerHTML = "Gagal: " + err.message;
        } finally {
            btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data';
            setTimeout(() => statusMsg.classList.add('hidden'), 5000);
        }
    });
    
    onSnapshot(query(produksiColl, limit(30)), (snapshot) => {
        let arr = []; snapshot.forEach(doc => { arr.push({ id: doc.id, ...doc.data() }); });
        arr.sort((a, b) => b.tanggal !== a.tanggal ? b.tanggal.localeCompare(a.tanggal) : (b.timestamp?.toMillis()||0) - (a.timestamp?.toMillis()||0));

        tabelRiwayatProduksi.innerHTML = arr.length === 0 ? '<tr><td colspan="9" class="text-center p-6 text-gray-500 italic">Belum ada riwayat.</td></tr>' : '';

        arr.forEach(d => {
            const tr = document.createElement('tr'); tr.className = 'border-b hover:bg-yellow-50';
            tr.innerHTML = `<td class="p-3">${new Date(d.tanggal).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})} <br><span class="text-[10px] text-gray-400">${d.timestamp ? new Date(d.timestamp.toMillis()).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : ''}</span></td><td class="p-3 font-semibold text-gray-700">${mapKandang[d.id_kandang]||d.id_kandang}</td><td class="p-3">${d.pakan_habis_kg}</td><td class="p-3 text-green-700 font-bold">${formatAngka(d.telur_utuh_gr)}</td><td class="p-3 text-orange-500">${formatAngka(d.telur_bentes_gr)}</td><td class="p-3 text-red-600 font-bold">${d.mortalitas_ekor}</td><td class="p-3 font-bold text-blue-600">${d.hdp_persen}%</td><td class="p-3">${d.fcr}</td><td class="p-3 text-right"><button class="btn-hapus-produksi text-red-400 hover:text-red-700 bg-red-50 px-2 py-1 rounded" data-id="${d.id}" data-kandang="${d.id_kandang}" data-mati="${d.mortalitas_ekor}"><i class="fa-solid fa-trash"></i></button></td>`;
            tabelRiwayatProduksi.appendChild(tr);
        });

        document.querySelectorAll('.btn-hapus-produksi').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const bData = e.currentTarget.dataset;
                if(confirm('Hapus catatan produksi ini?')) {
                    try {
                        await deleteDoc(doc(produksiColl, bData.id));
                        if (parseInt(bData.mati) > 0 && confirm(`Kembalikan ${bData.mati} ekor mati ke Kandang?`)) await updateDoc(doc(kandangColl, bData.kandang), { populasi_aktif: increment(parseInt(bData.mati)) });
                    } catch (err) { alert("Gagal hapus: " + err.message); }
                }
            });
        });
    });
}


// ==========================================
// G. CRUD KALKULATOR EKONOMI
// ==========================================
function initCRUDEkonomi(userId) {
    const formEkonomi = document.getElementById('formEkonomi');
    const tipeTrx = document.getElementById('tipeTrx'), kategoriTrx = document.getElementById('kategoriTrx'), tglTrx = document.getElementById('tglTrx');
    tglTrx.value = new Date().toISOString().split('T')[0];

    const cat = {
        pemasukan: ["Penjualan Telur Utuh", "Penjualan Telur Bentes / Retak", "Penjualan Ayam Afkir", "Penjualan Kotoran / Pupuk", "Pendapatan Lain-lain"],
        pengeluaran: ["Pembelian Pakan Jadi / Konsentrat", "Pembelian Bahan Baku Pakan (Jagung, Bekatul)", "Obat, Vitamin & Vaksin (OVK)", "Gaji Karyawan / ABK", "Listrik, Air & Internet", "Perawatan & Perbaikan Kandang", "Transportasi & BBM", "Pengeluaran Operasional Lainnya"],
        investasi: ["Pembuatan Kandang Baru", "Pembelian Pullet (Ayam Remaja)", "Pembelian Peralatan Kandang", "Suntikan Modal Tambahan", "Pembayaran Cicilan Hutang Pokok"]
    };

    tipeTrx.addEventListener('change', function() {
        const t = this.value; kategoriTrx.innerHTML = ''; 
        if (t && cat[t]) {
            kategoriTrx.disabled = false; kategoriTrx.innerHTML = '<option value="">-- Pilih Kategori --</option>';
            cat[t].forEach(k => kategoriTrx.innerHTML += `<option value="${k}">${k}</option>`);
        } else {
            kategoriTrx.disabled = true; kategoriTrx.innerHTML = '<option value="">-- Pilih Tipe Dulu --</option>';
        }
    });

    const keuanganColl = collection(db, "peternakan", userId, "transaksi_keuangan");

    formEkonomi.addEventListener('submit', async (e) => {
        e.preventDefault(); const btnSubmit = document.getElementById('btnSubmitEkonomi'); btnSubmit.disabled = true;
        try {
            await addDoc(keuanganColl, { tanggal_transaksi: tglTrx.value, tipe_transaksi: tipeTrx.value, kategori: kategoriTrx.value, nominal: parseFloat(document.getElementById('nominalTrx').value), keterangan: document.getElementById('keteranganTrx').value.trim() || "-", timestamp_input: new Date() });
            alert("Transaksi dicatat ke Buku Kas!"); formEkonomi.reset(); tipeTrx.dispatchEvent(new Event('change')); tglTrx.value = new Date().toISOString().split('T')[0];
        } catch (err) { alert("Gagal mencatat: " + err.message); } finally { btnSubmit.disabled = false; }
    });

    onSnapshot(keuanganColl, (snap) => {
        let tInv = 0, tPem = 0, tPeng = 0;
        snap.forEach(d => { const dt = d.data(); if(dt.tipe_transaksi === 'investasi') tInv += dt.nominal; else if(dt.tipe_transaksi === 'pemasukan') tPem += dt.nominal; else if(dt.tipe_transaksi === 'pengeluaran') tPeng += dt.nominal; });
        const laba = tPem - tPeng; const pnl = document.getElementById('panel-analisis-ekonomi');
        if(pnl) pnl.innerHTML = `<div><p class="text-sm text-gray-400">Total Investasi</p><p class="text-xl font-bold text-white">${formatRupiah(tInv)}</p></div><div><p class="text-sm text-gray-400">Arus Kas Operasional</p><p class="text-xl font-bold ${laba >= 0 ? 'text-green-400' : 'text-red-400'}">${laba >= 0 ? '+ '+formatRupiah(laba) : '- '+formatRupiah(Math.abs(laba))}</p></div>`;
    });
}


// ==========================================
// H. LAPORAN KEUANGAN BUKU BESAR
// ==========================================
function initLaporanKeuangan(userId) {
    const tabKas = document.getElementById('tabel-buku-besar');
    const fBulan = document.getElementById('filterBulanLaporan'), fTahun = document.getElementById('filterTahunLaporan');
    const keuanganColl = collection(db, "peternakan", userId, "transaksi_keuangan");

    onSnapshot(keuanganColl, (snap) => {
        let arr = []; snap.forEach(d => { arr.push({ id: d.id, ...d.data() }); });
        arr.sort((a, b) => b.tanggal_transaksi !== a.tanggal_transaksi ? b.tanggal_transaksi.localeCompare(a.tanggal_transaksi) : (b.timestamp_input?.toMillis()||0) - (a.timestamp_input?.toMillis()||0));

        function renderLaporan() {
            let sIn = 0, sOut = 0, sCap = 0; tabKas.innerHTML = '';
            const filtered = arr.filter(t => {
                const dt = new Date(t.tanggal_transaksi);
                return (fBulan.value === 'all' || String(dt.getMonth() + 1).padStart(2, '0') === fBulan.value) && String(dt.getFullYear()) === fTahun.value;
            });

            if(filtered.length === 0) tabKas.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-500 italic">Tidak ada transaksi.</td></tr>';

            filtered.forEach(trx => {
                const tglTxt = new Date(trx.tanggal_transaksi).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                const jamTxt = trx.timestamp_input ? new Date(trx.timestamp_input.toMillis()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
                
                let rHtml = '', bdg = '';
                if(trx.tipe_transaksi === 'pemasukan') { sIn += trx.nominal; bdg = '<span class="bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded text-[10px] font-bold">INCOME</span>'; rHtml = `<td class="p-4 text-right text-green-700 font-semibold bg-green-50/30">${formatRupiah(trx.nominal)}</td><td class="p-4 text-right text-gray-300">-</td>`; }
                else if (trx.tipe_transaksi === 'pengeluaran') { sOut += trx.nominal; bdg = '<span class="bg-red-100 text-red-800 border border-red-200 px-2 py-1 rounded text-[10px] font-bold">COST</span>'; rHtml = `<td class="p-4 text-right text-gray-300">-</td><td class="p-4 text-right text-red-700 font-semibold bg-red-50/30">${formatRupiah(trx.nominal)}</td>`; }
                else { sCap += trx.nominal; bdg = '<span class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold">CAPEX</span>'; rHtml = `<td class="p-4 text-right text-gray-300">-</td><td class="p-4 text-right text-purple-700 font-semibold bg-purple-50/30">${formatRupiah(trx.nominal)}</td>`; }

                const tr = document.createElement('tr'); tr.className = 'hover:bg-blue-50';
                tr.innerHTML = `<td class="p-4 text-gray-600 font-medium whitespace-nowrap">${tglTxt} <br><span class="text-[10px] text-gray-400 font-normal"><i class="fa-regular fa-clock"></i> ${jamTxt}</span></td><td class="p-4 text-center">${bdg}</td><td class="p-4"><div class="font-bold text-gray-800 group-hover:text-blue-700">${trx.kategori}</div><div class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-note-sticky mr-1"></i> ${trx.keterangan || '-'}</div></td>${rHtml}<td class="p-4 text-right print:hidden"><button class="btn-hapus-kas text-red-400 hover:text-red-600 bg-red-50 px-2 py-1 rounded" data-id="${trx.id}" title="Hapus"><i class="fa-solid fa-trash text-sm"></i></button></td>`;
                tabKas.appendChild(tr);
            });

            document.querySelectorAll('.btn-hapus-kas').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(confirm("Yakin hapus transaksi ini dari Buku Kas?")) await deleteDoc(doc(keuanganColl, e.currentTarget.dataset.id));
                });
            });

            document.getElementById('lap-total-pemasukan').innerText = formatRupiah(sIn);
            document.getElementById('lap-total-pengeluaran').innerText = formatRupiah(sOut);
            document.getElementById('lap-total-investasi').innerText = formatRupiah(sCap);
            const lb = sIn - sOut;
            document.getElementById('lap-laba-bersih').innerText = lb >= 0 ? "+ " + formatRupiah(lb) : "- " + formatRupiah(Math.abs(lb));
            document.getElementById('lap-laba-bersih').className = lb >= 0 ? "text-xl font-bold text-blue-700" : "text-xl font-bold text-red-600";
        }
        renderLaporan(); fBulan.addEventListener('change', renderLaporan); fTahun.addEventListener('change', renderLaporan);
    });
}


// ==========================================
// I. CRUD HARGA TELUR JATIM
// ==========================================
function initCRUDHarga(userId, isAdmin = false) {
    const form = document.getElementById('formHargaTelur');
    const panelInput = document.getElementById('panel-input-harga');
    
    // Sembunyikan panel input jika yang login bukan Super Admin
    if (panelInput) {
        if (!isAdmin) panelInput.classList.add('hidden');
        else panelInput.classList.remove('hidden');
    }

    // Perhatikan: Harga Pasar dibaca dari collection global "harga_pasar_jatim"
    const hargaColl = collection(db, "harga_pasar_jatim");
    
    onSnapshot(query(hargaColl, orderBy("tanggal", "desc"), limit(10)), (snap) => {
        const tab = document.getElementById('tabel-riwayat-harga'); tab.innerHTML = '';
        if (snap.empty) { tab.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Belum ada riwayat harga.</td></tr>`; return; }
        
        const docs = snap.docs; const cur = docs[0].data();
        document.getElementById('display-harga-telur').innerHTML = formatRupiah(cur.harga);
        
        if (docs.length > 1) {
            const selisih = cur.harga - docs[1].data().harga;
            document.getElementById('display-trend-harga').innerHTML = selisih > 0 ? `<span class="text-green-600"><i class="fa-solid fa-arrow-trend-up"></i> Naik ${formatRupiah(selisih)}</span>` : (selisih < 0 ? `<span class="text-red-600"><i class="fa-solid fa-arrow-trend-down"></i> Turun ${formatRupiah(Math.abs(selisih))}</span>` : `<span class="text-gray-500"><i class="fa-solid fa-minus"></i> Stabil</span>`);
        }
        
        docs.forEach(dSnap => {
            const d = dSnap.data(); const tr = document.createElement('tr'); tr.className = "border-b hover:bg-gray-50";
            const btnHapusHtml = isAdmin ? `<button class="btn-hapus-harga text-red-400" data-id="${dSnap.id}"><i class="fa-solid fa-trash text-sm"></i></button>` : '';
            tr.innerHTML = `<td class="py-2 text-gray-600">${new Date(d.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</td><td class="py-2 font-bold">${formatRupiah(d.harga)}</td><td class="py-2 text-right">${btnHapusHtml}</td>`;
            tab.appendChild(tr);
        });
        
        if(isAdmin) {
            document.querySelectorAll('.btn-hapus-harga').forEach(btn => btn.addEventListener('click', async (e) => { if(confirm("Hapus harga ini?")) await deleteDoc(doc(hargaColl, e.currentTarget.dataset.id)); }));
        }
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); const b = document.getElementById('btnUpdateHarga'); b.disabled = true;
            const d = new Date(); const tStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            try { await setDoc(doc(hargaColl, tStr), { tanggal: tStr, harga: parseFloat(document.getElementById('inputHargaTelur').value), timestamp: new Date() }); document.getElementById('inputHargaTelur').value = ""; } 
            catch (err) { alert("Error: " + err.message); } finally { b.disabled = false; }
        });
    }
}


// ==========================================
// J. REGISTRASI PWA (WEB APP)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA ServiceWorker siap:', reg.scope))
            .catch(err => console.log('PWA Error:', err));
    });
}