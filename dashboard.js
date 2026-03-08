// ============================================================================
// DASHBOARD.JS - SAAS MULTI-TENANT (ASHDA NUSANTARA FARM)
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

// Helper: Format Angka Ribuan
const formatAngka = (angka) => new Intl.NumberFormat('id-ID').format(angka);
const formatRupiah = (angka) => 'Rp ' + new Intl.NumberFormat('id-ID').format(angka);

// Variabel Global untuk Peta
let myMap;
let userMarker;
let otherMarkers = [];

// --- 2. PENJAGA KEAMANAN (AUTH GUARD) ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("login.html");
    } else {
        console.log("Tenant terotorisasi UID:", user.uid);
        initDashboard(user.uid); // Passing userId ke fungsi utama
    }
});

// Fungsi Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Anda yakin ingin keluar?")) {
        signOut(auth).then(() => window.location.replace("login.html"));
    }
});

// --- 3. FUNGSI UTAMA DASHBOARD ---
function initDashboard(userId) {
    setupNavigasi();
    initProfilDanPeta(userId);
    initDashboardUtama(userId); 
    initCRUDKandang(userId);
    initCRUDProduksi(userId);
    initCRUDEkonomi(userId);
    initCRUDHarga(userId); 
    initLaporanKeuangan(userId); 
}

// ==========================================
// A. SISTEM NAVIGASI & UI DASAR
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
                l.classList.remove('bg-green-900', 'border-l-4', 'border-yellow-400');
                l.classList.add('hover:bg-green-700');
            });
            this.classList.add('bg-green-900', 'border-l-4', 'border-yellow-400');
            this.classList.remove('hover:bg-green-700');

            if (window.innerWidth < 768) toggleSidebar();
            
            // Fix bug peta Leaflet jika tab baru dibuka
            if(targetId === 'sec-pengaturan' && myMap) {
                setTimeout(() => myMap.invalidateSize(), 300);
            }
        });
    });
}

// ==========================================
// B. PROFIL & PETA (MULTI-TENANT)
// ==========================================
function initProfilDanPeta(userId) {
    const sidebarTitle = document.querySelector('aside h1');
    const profilDocRef = doc(db, "peternakan", userId); 

    // 1. Inisialisasi Peta Leaflet
    myMap = L.map('mapContainer').setView([-7.5, 112.5], 8); // Default Jawa Timur
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(myMap);

    const blueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const redIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

    // 2. Baca Data Profil & Tampilkan
    onSnapshot(profilDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            sidebarTitle.innerText = data.nama_peternakan || "Ashda Nusantara";
            
            document.getElementById('inputNamaFarm').value = data.nama_peternakan || "";
            document.getElementById('inputLat').value = data.lat || "";
            document.getElementById('inputLng').value = data.lng || "";

            // Pasang Marker Sendiri
            if (data.lat && data.lng) {
                const latLng = [parseFloat(data.lat), parseFloat(data.lng)];
                if (userMarker) myMap.removeLayer(userMarker);
                userMarker = L.marker(latLng, {icon: blueIcon}).addTo(myMap).bindPopup("<b>Lokasi Anda</b><br>"+(data.nama_peternakan||"")).openPopup();
                myMap.setView(latLng, 11);
            }
        }
    });

    // 3. Baca Data Peternak Lain (Koleksi Publik)
    onSnapshot(collection(db, "public_farms"), (snapshot) => {
        otherMarkers.forEach(m => myMap.removeLayer(m));
        otherMarkers = [];

        snapshot.forEach(docSnap => {
            if (docSnap.id !== userId) { // Sembunyikan milik sendiri dari marker merah
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

    // 4. Klik Peta untuk Set Lokasi
    myMap.on('click', function(e) {
        document.getElementById('inputLat').value = e.latlng.lat.toFixed(6);
        document.getElementById('inputLng').value = e.latlng.lng.toFixed(6);
        
        if (userMarker) myMap.removeLayer(userMarker);
        userMarker = L.marker(e.latlng, {icon: blueIcon}).addTo(myMap).bindPopup("Lokasi Terpilih! Klik Simpan.").openPopup();
    });

    // 5. Submit Form Profil
    document.getElementById('formProfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSimpanProfil');
        const msg = document.getElementById('msgProfil');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        
        try {
            const namaBaru = document.getElementById('inputNamaFarm').value;
            const lat = document.getElementById('inputLat').value;
            const lng = document.getElementById('inputLng').value;

            // Simpan ke Private Doc
            await setDoc(profilDocRef, {
                nama_peternakan: namaBaru,
                lat: lat,
                lng: lng
            }, { merge: true });

            // Simpan ke Public Doc 
            await setDoc(doc(db, "public_farms", userId), {
                nama_peternakan: namaBaru,
                lat: lat,
                lng: lng
            });

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
// C. SINKRONISASI DASHBOARD UTAMA & GRAFIK
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
// D. CRUD MANAJEMEN KANDANG
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
        tbodyKandang.innerHTML = '';
        selectKandang.innerHTML = '<option value="">-- Pilih Kandang --</option>';
        let totalPopulasi = 0;
        kandangDataList = {}; 

        if (snapshot.empty) {
            tbodyKandang.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-500">Belum ada data kandang.</td></tr>`;
            labelDashPopulasi.innerHTML = "0 <span class='text-sm font-normal text-gray-500'>ekor</span>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            totalPopulasi += data.populasi_aktif;
            kandangDataList[id] = data; 

            let statusBadge = data.status === 'Produksi' ? 'bg-green-100 text-green-700' : (data.status === 'Kosong' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700');
            
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50 transition-colors';
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

            if (data.status !== 'Kosong') {
                selectKandang.innerHTML += `<option value="${id}" data-populasi="${data.populasi_aktif}">${data.nama_kandang} (Populasi: ${formatAngka(data.populasi_aktif)})</option>`;
            }
        });

        labelDashPopulasi.innerHTML = `${formatAngka(totalPopulasi)} <span class='text-sm font-normal text-gray-500'>ekor</span>`;

        document.querySelectorAll('.btn-edit-kandang').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idEdit = e.currentTarget.getAttribute('data-id');
                const data = kandangDataList[idEdit];
                
                isEditMode = true; 
                currentEditId = idEdit;
                
                modalTitle.innerText = "Edit Data Kandang";
                inputId.value = idEdit;
                inputId.readOnly = true; 
                inputId.classList.add('bg-gray-100', 'cursor-not-allowed'); 
                
                document.getElementById('namaKandangBaru').value = data.nama_kandang;
                document.getElementById('kapasitasKandangBaru').value = data.kapasitas_maksimal;
                document.getElementById('populasiKandangBaru').value = data.populasi_aktif;
                document.getElementById('tipeKandangBaru').value = data.tipe;
                document.getElementById('statusKandangBaru').value = data.status;
                
                modal.classList.remove('hidden'); 
            });
        });

        document.querySelectorAll('.btn-hapus-kandang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                if(confirm(`PERINGATAN: Yakin ingin menghapus kandang ${idHapus} secara permanen?`)) {
                    await deleteDoc(doc(kandangColl, idHapus));
                }
            });
        });
    });

    document.getElementById('btnTambahKandang').addEventListener('click', () => {
        isEditMode = false; currentEditId = null; formKandang.reset();
        modalTitle.innerText = "Data Kandang Baru";
        inputId.readOnly = false; inputId.classList.remove('bg-gray-100', 'cursor-not-allowed');
        modal.classList.remove('hidden');
    });

    document.getElementById('closeModalKandang').addEventListener('click', () => modal.classList.add('hidden'));

    formKandang.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSimpan = document.getElementById('btnSimpanKandangBaru');
        btnSimpan.disabled = true; btnSimpan.innerText = isEditMode ? "Memperbarui..." : "Menyimpan...";

        const idInputVal = inputId.value.trim().toUpperCase();
        
        try {
            if (isEditMode) {
                await updateDoc(doc(kandangColl, currentEditId), {
                    nama_kandang: document.getElementById('namaKandangBaru').value,
                    kapasitas_maksimal: parseInt(document.getElementById('kapasitasKandangBaru').value),
                    populasi_aktif: parseInt(document.getElementById('populasiKandangBaru').value),
                    tipe: document.getElementById('tipeKandangBaru').value,
                    status: document.getElementById('statusKandangBaru').value,
                    updated_at: new Date()
                });
            } else {
                const docRef = doc(kandangColl, idInputVal);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    alert(`GAGAL: Kode/ID Kandang "${idInputVal}" sudah terpakai! Silakan gunakan kode lain.`);
                    btnSimpan.disabled = false; btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database';
                    return; 
                }

                await setDoc(docRef, {
                    nama_kandang: document.getElementById('namaKandangBaru').value,
                    kapasitas_maksimal: parseInt(document.getElementById('kapasitasKandangBaru').value),
                    populasi_aktif: parseInt(document.getElementById('populasiKandangBaru').value),
                    tipe: document.getElementById('tipeKandangBaru').value,
                    status: document.getElementById('statusKandangBaru').value,
                    created_at: new Date()
                });
            }
            formKandang.reset(); modal.classList.add('hidden');
        } catch (error) {
            alert("Terjadi kesalahan: " + error.message);
        } finally {
            btnSimpan.disabled = false; btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database';
        }
    });
}

// ==========================================
// E. CRUD JURNAL PRODUKSI
// ==========================================
function initCRUDProduksi(userId) {
    const formProduksi = document.getElementById('formProduksi');
    const statusMsg = document.getElementById('statusMsg');
    const selectKandang = document.getElementById('idKandang');
    const inputPakanKg = document.getElementById('pakanKg');
    const tabelRiwayatProduksi = document.getElementById('tabel-riwayat-produksi');

    const kandangColl = collection(db, "peternakan", userId, "kandang");
    const produksiColl = collection(db, "peternakan", userId, "produksi_harian");

    let mapKandang = {};
    onSnapshot(kandangColl, (snap) => {
        mapKandang = {};
        snap.forEach(doc => { mapKandang[doc.id] = doc.data().nama_kandang; });
    });

    selectKandang.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (this.value !== "") {
            const populasiAktif = parseFloat(selectedOption.getAttribute('data-populasi'));
            const estimasiPakanKg = (populasiAktif * 120) / 1000;
            inputPakanKg.value = estimasiPakanKg.toFixed(1);
            inputPakanKg.classList.add('bg-yellow-50', 'transition-colors');
            setTimeout(() => inputPakanKg.classList.remove('bg-yellow-50'), 1000);
        } else {
            inputPakanKg.value = "";
        }
    });

    formProduksi.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

        try {
            const idKandang = selectKandang.value;
            const populasiAwal = parseFloat(selectKandang.options[selectKandang.selectedIndex].getAttribute('data-populasi'));
            
            const mortalitas = parseInt(document.getElementById('mortalitas').value);
            const pakanKg = parseFloat(inputPakanKg.value); 
            const telurUtuhGr = parseFloat(document.getElementById('telurUtuhGr').value);
            const telurBentesGr = parseFloat(document.getElementById('telurBentesGr').value);

            const totalTelurGr = telurUtuhGr + telurBentesGr;
            const totalTelurKg = totalTelurGr / 1000; 
            const fcr = totalTelurKg > 0 ? (pakanKg / totalTelurKg).toFixed(2) : 0;
            const estimasiButir = totalTelurGr / 62.5; 
            const populasiAktif = populasiAwal - mortalitas;
            const hdp = populasiAktif > 0 ? ((estimasiButir / populasiAktif) * 100).toFixed(2) : 0;

            await addDoc(produksiColl, {
                id_kandang: idKandang,
                tanggal: document.getElementById('tanggal').value,
                pakan_habis_kg: pakanKg,
                mortalitas_ekor: mortalitas,
                telur_utuh_gr: telurUtuhGr,       
                telur_bentes_gr: telurBentesGr,   
                total_telur_kg: totalTelurKg,     
                estimasi_butir: Math.round(estimasiButir),
                fcr: parseFloat(fcr),
                hdp_persen: parseFloat(hdp),
                timestamp: new Date()
            });

            if (mortalitas > 0) {
                await updateDoc(doc(kandangColl, idKandang), {
                    populasi_aktif: increment(-mortalitas)
                });
            }

            statusMsg.className = "mt-4 p-3 rounded-md bg-green-100 text-green-700 block text-sm";
            statusMsg.innerHTML = `Data tersimpan! <br> HDP: <b>${hdp}%</b> | FCR: <b>${fcr}</b>`;
            formProduksi.reset();
            document.getElementById('tanggal').value = new Date().toISOString().split('T')[0];

        } catch (error) {
            statusMsg.className = "mt-4 p-3 rounded-md bg-red-100 text-red-700 block text-sm";
            statusMsg.innerHTML = "Gagal: " + error.message;
        } finally {
            btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data';
            setTimeout(() => statusMsg.classList.add('hidden'), 5000);
        }
    });

    const qProd = query(produksiColl, limit(30)); 
    
    onSnapshot(qProd, (snapshot) => {
        let allProduksi = [];
        snapshot.forEach(doc => { allProduksi.push({ id: doc.id, ...doc.data() }); });

        allProduksi.sort((a, b) => {
            if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        tabelRiwayatProduksi.innerHTML = '';

        if (allProduksi.length === 0) {
            tabelRiwayatProduksi.innerHTML = '<tr><td colspan="9" class="text-center p-6 text-gray-500 italic">Belum ada riwayat produksi tercatat.</td></tr>';
            return;
        }

        allProduksi.forEach(data => {
            const namaKandang = mapKandang[data.id_kandang] || data.id_kandang;
            const dateObj = new Date(data.tanggal);
            const tglLokal = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeString = data.timestamp ? new Date(data.timestamp.toMillis()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-yellow-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 whitespace-nowrap">${tglLokal} <br><span class="text-[10px] text-gray-400"><i class="fa-regular fa-clock"></i> ${timeString}</span></td>
                <td class="p-3 font-semibold text-gray-700">${namaKandang}</td>
                <td class="p-3">${data.pakan_habis_kg}</td>
                <td class="p-3 text-green-700 font-bold">${formatAngka(data.telur_utuh_gr)}</td>
                <td class="p-3 text-orange-500">${formatAngka(data.telur_bentes_gr)}</td>
                <td class="p-3 text-red-600 font-bold">${data.mortalitas_ekor}</td>
                <td class="p-3 font-bold text-blue-600">${data.hdp_persen}%</td>
                <td class="p-3">${data.fcr}</td>
                <td class="p-3 text-right">
                    <button class="btn-hapus-produksi text-red-400 hover:text-red-700 bg-red-50 px-2 py-1 rounded transition-colors" data-id="${data.id}" data-kandang="${data.id_kandang}" data-mati="${data.mortalitas_ekor}" title="Hapus"><i class="fa-solid fa-trash text-sm"></i></button>
                </td>
            `;
            tabelRiwayatProduksi.appendChild(tr);
        });

        document.querySelectorAll('.btn-hapus-produksi').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                const idKandang = e.currentTarget.getAttribute('data-kandang');
                const jmlMati = parseInt(e.currentTarget.getAttribute('data-mati') || 0);

                if(confirm('Yakin ingin menghapus catatan produksi ini? Data grafik dashboard akan ikut terpengaruh.')) {
                    try {
                        await deleteDoc(doc(produksiColl, idHapus));
                        if (jmlMati > 0) {
                            if(confirm(`Catatan ini memiliki mortalitas ${jmlMati} ekor.\nApakah Anda ingin MENGEMBALIKAN ${jmlMati} ekor tersebut ke populasi Kandang?`)) {
                                await updateDoc(doc(kandangColl, idKandang), {
                                    populasi_aktif: increment(jmlMati)
                                });
                            }
                        }
                    } catch (err) {
                        alert("Gagal menghapus: " + err.message);
                    }
                }
            });
        });
    });
}

// ==========================================
// F. CRUD KALKULATOR EKONOMI
// ==========================================
function initCRUDEkonomi(userId) {
    const formEkonomi = document.getElementById('formEkonomi');
    const tipeTrx = document.getElementById('tipeTrx');
    const kategoriTrx = document.getElementById('kategoriTrx');
    const tglTrx = document.getElementById('tglTrx');
    
    tglTrx.value = new Date().toISOString().split('T')[0];

    const daftarKategori = {
        pemasukan: ["Penjualan Telur Utuh", "Penjualan Telur Bentes / Retak", "Penjualan Ayam Afkir", "Penjualan Kotoran / Pupuk", "Pendapatan Lain-lain"],
        pengeluaran: ["Pembelian Pakan Jadi / Konsentrat", "Pembelian Bahan Baku Pakan (Jagung, Bekatul)", "Obat, Vitamin & Vaksin (OVK)", "Gaji Karyawan / ABK", "Listrik, Air & Internet", "Perawatan & Perbaikan Kandang", "Transportasi & BBM", "Pengeluaran Operasional Lainnya"],
        investasi: ["Pembuatan Kandang Baru", "Pembelian Pullet (Ayam Remaja)", "Pembelian Peralatan Kandang", "Suntikan Modal Tambahan", "Pembayaran Cicilan Hutang Pokok"]
    };

    tipeTrx.addEventListener('change', function() {
        const tipe = this.value;
        kategoriTrx.innerHTML = ''; 

        if (tipe && daftarKategori[tipe]) {
            kategoriTrx.disabled = false;
            kategoriTrx.innerHTML = '<option value="">-- Pilih Kategori --</option>';
            daftarKategori[tipe].forEach(kat => {
                kategoriTrx.innerHTML += `<option value="${kat}">${kat}</option>`;
            });
        } else {
            kategoriTrx.disabled = true;
            kategoriTrx.innerHTML = '<option value="">-- Pilih Tipe Dulu --</option>';
        }
    });

    const keuanganColl = collection(db, "peternakan", userId, "transaksi_keuangan");

    formEkonomi.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnSubmitEkonomi');
        btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mencatat...';
        
        try {
            await addDoc(keuanganColl, {
                tanggal_transaksi: tglTrx.value,
                tipe_transaksi: tipeTrx.value,
                kategori: kategoriTrx.value,
                nominal: parseFloat(document.getElementById('nominalTrx').value),
                keterangan: document.getElementById('keteranganTrx').value.trim() || "-",
                timestamp_input: new Date()    
            });
            
            alert("Transaksi berhasil dicatat ke Buku Kas!");
            formEkonomi.reset();
            tipeTrx.dispatchEvent(new Event('change')); 
            tglTrx.value = new Date().toISOString().split('T')[0];
            
        } catch (error) {
            alert("Gagal mencatat transaksi: " + error.message);
        } finally {
            btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Catat ke Buku Kas';
        }
    });

    onSnapshot(keuanganColl, (snapshot) => {
        let totalInvestasi = 0; let totalPemasukan = 0; let totalPengeluaran = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.tipe_transaksi === 'investasi') totalInvestasi += data.nominal;
            else if(data.tipe_transaksi === 'pemasukan') totalPemasukan += data.nominal;
            else if(data.tipe_transaksi === 'pengeluaran') totalPengeluaran += data.nominal;
        });

        const labaBersih = totalPemasukan - totalPengeluaran;

        const analisisPanel = document.getElementById('panel-analisis-ekonomi');
        if(analisisPanel) {
            let statusLabaRugi = labaBersih >= 0 
                ? `<span class="text-green-400">+ ${formatRupiah(labaBersih)}</span>` 
                : `<span class="text-red-400">- ${formatRupiah(Math.abs(labaBersih))}</span>`;

            analisisPanel.innerHTML = `
                <div><p class="text-sm text-gray-400">Total Capital / Investasi</p><p class="text-xl font-bold text-white">${formatRupiah(totalInvestasi)}</p></div>
                <div><p class="text-sm text-gray-400">Arus Kas Operasional Bersih</p><p class="text-xl font-bold">${statusLabaRugi}</p></div>
                <div class="bg-gray-700 p-3 rounded mt-2"><p class="text-sm text-gray-300">Status Finansial Terkini Diperbarui Real-time dari Buku Kas.</p></div>
            `;
        }
    });
}

// ==========================================
// G. CRUD HARGA TELUR JATIM
// ==========================================
function initCRUDHarga(userId) {
    const formHargaTelur = document.getElementById('formHargaTelur');
    const inputHargaTelur = document.getElementById('inputHargaTelur');
    const displayHargaTelur = document.getElementById('display-harga-telur');
    const displayTrendHarga = document.getElementById('display-trend-harga');
    const tabelRiwayatHarga = document.getElementById('tabel-riwayat-harga');

    const hargaColl = collection(db, "peternakan", userId, "harga_pasar");
    const qHarga = query(hargaColl, orderBy("tanggal", "desc"), limit(10));
    
    onSnapshot(qHarga, (snapshot) => {
        tabelRiwayatHarga.innerHTML = '';
        
        if (snapshot.empty) {
            displayHargaTelur.innerHTML = "Belum Ada Data";
            displayTrendHarga.innerHTML = "<span class='text-gray-500'>Mulai input harga patokan pertama Anda.</span>";
            tabelRiwayatHarga.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Belum ada riwayat harga.</td></tr>`;
            return;
        }

        const docs = snapshot.docs;
        const latestData = docs[0].data();
        
        displayHargaTelur.innerHTML = formatRupiah(latestData.harga);

        if (docs.length > 1) {
            const prevData = docs[1].data();
            const selisih = latestData.harga - prevData.harga;
            
            if (selisih > 0) {
                displayTrendHarga.innerHTML = `<span class="text-green-600"><i class="fa-solid fa-arrow-trend-up"></i> Naik ${formatRupiah(selisih)} dari data sebelumnya</span>`;
            } else if (selisih < 0) {
                displayTrendHarga.innerHTML = `<span class="text-red-600"><i class="fa-solid fa-arrow-trend-down"></i> Turun ${formatRupiah(Math.abs(selisih))} dari data sebelumnya</span>`;
            } else {
                displayTrendHarga.innerHTML = `<span class="text-gray-500"><i class="fa-solid fa-minus"></i> Stabil (Tidak ada perubahan)</span>`;
            }
        } else {
            displayTrendHarga.innerHTML = `<span class="text-gray-500">Data awal sistem tercatat.</span>`;
        }

        docs.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id; 
            const dateObj = new Date(data.tanggal);
            const tglLokal = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 transition-colors";
            tr.innerHTML = `
                <td class="py-2 text-gray-600">${tglLokal}</td>
                <td class="py-2 font-bold text-gray-800">${formatRupiah(data.harga)}</td>
                <td class="py-2 text-right">
                    <button class="btn-hapus-harga text-red-400 hover:text-red-600" data-id="${id}" title="Hapus"><i class="fa-solid fa-trash text-sm"></i></button>
                </td>
            `;
            tabelRiwayatHarga.appendChild(tr);
        });

        document.querySelectorAll('.btn-hapus-harga').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                if(confirm(`Yakin ingin menghapus catatan harga untuk tanggal ${idHapus}?`)) {
                    await deleteDoc(doc(hargaColl, idHapus));
                }
            });
        });
    });

    formHargaTelur.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnUpdateHarga');
        btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const hargaBaru = parseFloat(inputHargaTelur.value);
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 

        try {
            await setDoc(doc(hargaColl, todayStr), {
                tanggal: todayStr,
                harga: hargaBaru,
                timestamp: new Date()
            });
            inputHargaTelur.value = "";
        } catch (error) {
            alert("Gagal memperbarui harga: " + error.message);
        } finally {
            btnSubmit.disabled = false; btnSubmit.innerHTML = 'Update Sistem';
        }
    });
}

// ==========================================
// H. LAPORAN KEUANGAN BUKU BESAR
// ==========================================
function initLaporanKeuangan(userId) {
    const tabelBukuBesar = document.getElementById('tabel-buku-besar');
    const filterBulan = document.getElementById('filterBulanLaporan');
    const filterTahun = document.getElementById('filterTahunLaporan');

    const lapPemasukan = document.getElementById('lap-total-pemasukan');
    const lapPengeluaran = document.getElementById('lap-total-pengeluaran');
    const lapLabaBersih = document.getElementById('lap-laba-bersih');
    const lapInvestasi = document.getElementById('lap-total-investasi');

    const keuanganColl = collection(db, "peternakan", userId, "transaksi_keuangan");

    onSnapshot(keuanganColl, (snapshot) => {
        let allTransactions = [];
        snapshot.forEach(doc => { allTransactions.push({ id: doc.id, ...doc.data() }); });

        // Pengurutan Ganda (Tanggal lalu Waktu Input)
        allTransactions.sort((a, b) => {
            if (b.tanggal_transaksi !== a.tanggal_transaksi) {
                return b.tanggal_transaksi.localeCompare(a.tanggal_transaksi);
            }
            const timeA = a.timestamp_input ? a.timestamp_input.toMillis() : 0;
            const timeB = b.timestamp_input ? b.timestamp_input.toMillis() : 0;
            return timeB - timeA;
        });

        function renderLaporan() {
            const bulanPilih = filterBulan.value;
            const tahunPilih = filterTahun.value;

            let sumPemasukan = 0; let sumPengeluaran = 0; let sumInvestasi = 0;
            tabelBukuBesar.innerHTML = '';

            const filteredData = allTransactions.filter(trx => {
                const trxDate = new Date(trx.tanggal_transaksi);
                const trxMonth = String(trxDate.getMonth() + 1).padStart(2, '0');
                const trxYear = String(trxDate.getFullYear());

                const matchBulan = (bulanPilih === 'all') ? true : (trxMonth === bulanPilih);
                const matchTahun = (trxYear === tahunPilih);

                return matchBulan && matchTahun;
            });

            if(filteredData.length === 0) {
                tabelBukuBesar.innerHTML = '<tr><td colspan="6" class="text-center p-8 text-gray-500 italic"><i class="fa-solid fa-folder-open text-2xl mb-2 block"></i> Tidak ada transaksi pada periode ini.</td></tr>';
            }

            filteredData.forEach(trx => {
                const dateObj = new Date(trx.tanggal_transaksi);
                const tglLokal = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeString = trx.timestamp_input ? new Date(trx.timestamp_input.toMillis()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
                
                let rowHtml = ''; let tipeBadge = '';
                
                if(trx.tipe_transaksi === 'pemasukan') {
                    sumPemasukan += trx.nominal;
                    tipeBadge = '<span class="bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">INCOME</span>';
                    rowHtml = `<td class="p-4 text-right text-green-700 font-semibold bg-green-50/30">${formatRupiah(trx.nominal)}</td><td class="p-4 text-right text-gray-300">-</td>`;
                } else if (trx.tipe_transaksi === 'pengeluaran') {
                    sumPengeluaran += trx.nominal;
                    tipeBadge = '<span class="bg-red-100 text-red-800 border border-red-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">COST</span>';
                    rowHtml = `<td class="p-4 text-right text-gray-300">-</td><td class="p-4 text-right text-red-700 font-semibold bg-red-50/30">${formatRupiah(trx.nominal)}</td>`;
                } else if (trx.tipe_transaksi === 'investasi') {
                    sumInvestasi += trx.nominal;
                    tipeBadge = '<span class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">CAPEX</span>';
                    rowHtml = `<td class="p-4 text-right text-gray-300">-</td><td class="p-4 text-right text-purple-700 font-semibold bg-purple-50/30">${formatRupiah(trx.nominal)}</td>`;
                }

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-50 transition-colors group';
                tr.innerHTML = `
                    <td class="p-4 text-gray-600 font-medium whitespace-nowrap">
                        ${tglLokal} <br><span class="text-[10px] text-gray-400 font-normal"><i class="fa-regular fa-clock"></i> ${timeString}</span>
                    </td>
                    <td class="p-4 text-center">${tipeBadge}</td>
                    <td class="p-4">
                        <div class="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">${trx.kategori}</div>
                        <div class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-note-sticky mr-1"></i> ${trx.keterangan || 'Tidak ada catatan'}</div>
                    </td>
                    ${rowHtml}
                    <td class="p-4 text-right print:hidden">
                        <button class="btn-hapus-kas text-red-400 hover:text-red-600 bg-red-50 px-2 py-1 rounded transition-colors" data-id="${trx.id}" title="Hapus Transaksi"><i class="fa-solid fa-trash text-sm"></i></button>
                    </td>
                `;
                tabelBukuBesar.appendChild(tr);
            });

            // Event Listener untuk Tombol Hapus Kas
            document.querySelectorAll('.btn-hapus-kas').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idHapus = e.currentTarget.getAttribute('data-id');
                    if(confirm("Yakin ingin menghapus catatan transaksi ini dari Buku Kas?\n\nLaba/Rugi akan otomatis dihitung ulang.")) {
                        try {
                            await deleteDoc(doc(keuanganColl, idHapus)); 
                        } catch (err) {
                            alert("Gagal menghapus: " + err.message);
                        }
                    }
                });
            });

            const labaBersih = sumPemasukan - sumPengeluaran;

            lapPemasukan.innerText = formatRupiah(sumPemasukan);
            lapPengeluaran.innerText = formatRupiah(sumPengeluaran);
            lapInvestasi.innerText = formatRupiah(sumInvestasi);
            
            if (labaBersih > 0) {
                lapLabaBersih.innerText = "+ " + formatRupiah(labaBersih);
                lapLabaBersih.className = "text-xl font-bold text-blue-700";
            } else if (labaBersih < 0) {
                lapLabaBersih.innerText = "- " + formatRupiah(Math.abs(labaBersih));
                lapLabaBersih.className = "text-xl font-bold text-red-600";
            } else {
                lapLabaBersih.innerText = formatRupiah(0);
                lapLabaBersih.className = "text-xl font-bold text-gray-600";
            }
        }

        renderLaporan();
        filterBulan.addEventListener('change', renderLaporan);
        filterTahun.addEventListener('change', renderLaporan);
    });
}

// ==========================================
// I. REGISTRASI PWA (WEB APP)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('PWA ServiceWorker berhasil didaftarkan dengan scope:', registration.scope);
            })
            .catch(error => {
                console.log('PWA ServiceWorker gagal didaftarkan:', error);
            });
    });
}