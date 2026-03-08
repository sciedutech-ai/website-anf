// ============================================================================
// DASHBOARD.JS - ASHDA NUSANTARA FARM (FULL CRUD FIREBASE)
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, setDoc, doc, updateDoc, 
    deleteDoc, onSnapshot, increment, query, orderBy, limit, getDoc // <-- TAMBAH getDoc DI SINI
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


// --- 2. PENJAGA KEAMANAN (AUTH GUARD) ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("login.html");
    } else {
        console.log("Admin terotorisasi:", user.email);
        initDashboard(); // Jalankan fungsi utama jika login sukses
    }
});

// Fungsi Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    if(confirm("Anda yakin ingin keluar?")) {
        signOut(auth).then(() => window.location.replace("login.html"));
    }
});


// --- 3. FUNGSI UTAMA DASHBOARD ---
function initDashboard() {
    setupNavigasi();
    initDashboardUtama(); // <--- TAMBAHKAN INI
    initCRUDKandang();
    initCRUDProduksi();
    initCRUDEkonomi();
    initCRUDHarga(); 
    initLaporanKeuangan(); 
}


// ==========================================
// A. SISTEM NAVIGASI & UI DASAR
// ==========================================
function setupNavigasi() {
    // Set Tanggal Hari Ini
    const today = new Date();
    document.getElementById('current-date').innerText = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const inputsTanggal = document.querySelectorAll('input[type="date"]');
    inputsTanggal.forEach(input => input.value = today.toISOString().split('T')[0]);

    // Navigasi Antar Halaman
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
        });
    });
}


// ==========================================
// B. CRUD MANAJEMEN KANDANG (DENGAN FITUR EDIT)
// ==========================================
function initCRUDKandang() {
    const tbodyKandang = document.getElementById('tabel-kandang-body');
    const selectKandang = document.getElementById('idKandang');
    const labelDashPopulasi = document.getElementById('dash-populasi');
    
    // Variabel untuk mode Edit
    const modal = document.getElementById('modalKandang');
    const formKandang = document.getElementById('formTambahKandang');
    const modalTitle = document.querySelector('#modalKandang h3');
    const inputId = document.getElementById('idKandangBaru');
    
    let isEditMode = false;
    let currentEditId = null;
    let kandangDataList = {}; // Menyimpan data lokal sementara untuk form edit
    
    // 1. READ (Membaca Data Real-time & Render Tabel)
    onSnapshot(collection(db, "kandang"), (snapshot) => {
        tbodyKandang.innerHTML = '';
        selectKandang.innerHTML = '<option value="">-- Pilih Kandang --</option>';
        let totalPopulasi = 0;
        kandangDataList = {}; // Reset data lokal

        if (snapshot.empty) {
            tbodyKandang.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-500">Belum ada data kandang.</td></tr>`;
            labelDashPopulasi.innerHTML = "0 <span class='text-sm font-normal text-gray-500'>ekor</span>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            totalPopulasi += data.populasi_aktif;
            kandangDataList[id] = data; // Simpan data ke memori lokal

            let statusBadge = data.status === 'Produksi' ? 'bg-green-100 text-green-700' : (data.status === 'Kosong' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700');
            
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50 transition-colors';
            // Menambahkan Tombol Edit (warna biru) dan Tombol Hapus (warna merah)
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

        // ==========================================
        // EVENT LISTENER: TOMBOL EDIT (Di dalam tabel)
        // ==========================================
        document.querySelectorAll('.btn-edit-kandang').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idEdit = e.currentTarget.getAttribute('data-id');
                const data = kandangDataList[idEdit];
                
                isEditMode = true; // Aktifkan mode edit
                currentEditId = idEdit;
                
                // Ubah tampilan modal untuk Edit
                modalTitle.innerText = "Edit Data Kandang";
                inputId.value = idEdit;
                inputId.readOnly = true; // ID tidak boleh diedit di database NoSQL
                inputId.classList.add('bg-gray-100', 'cursor-not-allowed'); 
                
                // Isi form dengan data lama
                document.getElementById('namaKandangBaru').value = data.nama_kandang;
                document.getElementById('kapasitasKandangBaru').value = data.kapasitas_maksimal;
                document.getElementById('populasiKandangBaru').value = data.populasi_aktif;
                document.getElementById('tipeKandangBaru').value = data.tipe;
                document.getElementById('statusKandangBaru').value = data.status;
                
                modal.classList.remove('hidden'); // Munculkan Modal
            });
        });

        // EVENT LISTENER: TOMBOL HAPUS (Di dalam tabel)
        document.querySelectorAll('.btn-hapus-kandang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                if(confirm(`PERINGATAN: Yakin ingin menghapus kandang ${idHapus} secara permanen?`)) {
                    await deleteDoc(doc(db, "kandang", idHapus));
                }
            });
        });
    });

    // ==========================================
    // 2. KONTROL MODAL & SUBMIT FORM (CREATE & UPDATE)
    // ==========================================
    
    // Tombol Tambah Kandang (Buka Modal mode Create)
    document.getElementById('btnTambahKandang').addEventListener('click', () => {
        isEditMode = false;
        currentEditId = null;
        formKandang.reset();
        
        // Kembalikan tampilan modal untuk Tambah Baru
        modalTitle.innerText = "Data Kandang Baru";
        inputId.readOnly = false;
        inputId.classList.remove('bg-gray-100', 'cursor-not-allowed');
        
        modal.classList.remove('hidden');
    });

    // Tombol Tutup Modal (X)
    document.getElementById('closeModalKandang').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Proses Submit (Bisa untuk Simpan Baru atau Perbarui Data)
    formKandang.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSimpan = document.getElementById('btnSimpanKandangBaru');
        btnSimpan.disabled = true;
        btnSimpan.innerText = isEditMode ? "Memperbarui..." : "Menyimpan...";

        const idInputVal = inputId.value.trim().toUpperCase();
        
        try {
            if (isEditMode) {
                // JALUR UPDATE: Perbarui data kandang yang sudah ada
                await updateDoc(doc(db, "kandang", currentEditId), {
                    nama_kandang: document.getElementById('namaKandangBaru').value,
                    kapasitas_maksimal: parseInt(document.getElementById('kapasitasKandangBaru').value),
                    populasi_aktif: parseInt(document.getElementById('populasiKandangBaru').value),
                    tipe: document.getElementById('tipeKandangBaru').value,
                    status: document.getElementById('statusKandangBaru').value,
                    updated_at: new Date() // Tambahkan penanda waktu update
                });
            } else {
                // JALUR CREATE: Buat data baru dengan cek ID ganda
                const docRef = doc(db, "kandang", idInputVal);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    alert(`GAGAL: Kode/ID Kandang "${idInputVal}" sudah terpakai! Silakan gunakan kode lain.`);
                    btnSimpan.disabled = false;
                    btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database';
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
            
            formKandang.reset();
            modal.classList.add('hidden');
        } catch (error) {
            alert("Terjadi kesalahan: " + error.message);
        } finally {
            btnSimpan.disabled = false;
            btnSimpan.innerHTML = '<i class="fa-solid fa-save"></i> Simpan ke Database';
        }
    });
}

// ==========================================
// C. CRUD JURNAL PRODUKSI (DENGAN TABEL RIWAYAT)
// ==========================================
function initCRUDProduksi() {
    const formProduksi = document.getElementById('formProduksi');
    const statusMsg = document.getElementById('statusMsg');
    const selectKandang = document.getElementById('idKandang');
    const inputPakanKg = document.getElementById('pakanKg');
    const tabelRiwayatProduksi = document.getElementById('tabel-riwayat-produksi');

    // --- 1. MAPPING NAMA KANDANG (Agar tabel riwayat menampilkan nama, bukan ID) ---
    let mapKandang = {};
    onSnapshot(collection(db, "kandang"), (snap) => {
        mapKandang = {};
        snap.forEach(doc => {
            mapKandang[doc.id] = doc.data().nama_kandang;
        });
    });

    // --- 2. AUTO-KALKULASI PAKAN (120gr / ekor) ---
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

    // --- 3. CREATE: PROSES SUBMIT JURNAL ---
    formProduksi.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

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

            await addDoc(collection(db, "produksi_harian"), {
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
                await updateDoc(doc(db, "kandang", idKandang), {
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
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-save"></i> Simpan Data';
            setTimeout(() => statusMsg.classList.add('hidden'), 5000);
        }
    });

    // --- 4. READ: MENAMPILKAN TABEL RIWAYAT PRODUKSI ---
    const qProd = query(collection(db, "produksi_harian"), limit(30)); // Batasi 30 data agar ringan
    
    onSnapshot(qProd, (snapshot) => {
        let allProduksi = [];
        snapshot.forEach(doc => {
            allProduksi.push({ id: doc.id, ...doc.data() });
        });

        // Pengurutan Ganda: Tanggal (Terbaru) -> Waktu Input/Timestamp (Terbaru)
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

        // --- 5. DELETE: FUNGSI HAPUS RIWAYAT & KEMBALIKAN POPULASI ---
        document.querySelectorAll('.btn-hapus-produksi').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                const idKandang = e.currentTarget.getAttribute('data-kandang');
                const jmlMati = parseInt(e.currentTarget.getAttribute('data-mati') || 0);

                if(confirm('Yakin ingin menghapus catatan produksi ini? Data grafik dashboard akan ikut terpengaruh.')) {
                    try {
                        await deleteDoc(doc(db, "produksi_harian", idHapus));
                        
                        // Fitur Pintar: Tanyakan apakah ingin mengembalikan jumlah populasi ayam yang terlanjur dicatat mati
                        if (jmlMati > 0) {
                            if(confirm(`Catatan ini memiliki mortalitas ${jmlMati} ekor.\n\nApakah Anda ingin MENGEMBALIKAN ${jmlMati} ekor tersebut ke populasi Kandang? (Pilih 'OK' jika salah ketik mati, pilih 'Cancel' jika ayam memang mati tapi datanya saja yang salah).`)) {
                                await updateDoc(doc(db, "kandang", idKandang), {
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
// D. CRUD KALKULATOR EKONOMI / KEUANGAN (KOMPLEKS)
// ==========================================
function initCRUDEkonomi() {
    const formEkonomi = document.getElementById('formEkonomi');
    const tipeTrx = document.getElementById('tipeTrx');
    const kategoriTrx = document.getElementById('kategoriTrx');
    const tglTrx = document.getElementById('tglTrx');
    
    // Set default tanggal hari ini
    tglTrx.value = new Date().toISOString().split('T')[0];

    // Rekomendasi Kategori (Chart of Accounts) Peternakan Layer
    const daftarKategori = {
        pemasukan: [
            "Penjualan Telur Utuh", 
            "Penjualan Telur Bentes / Retak", 
            "Penjualan Ayam Afkir", 
            "Penjualan Kotoran / Pupuk", 
            "Pendapatan Lain-lain"
        ],
        pengeluaran: [
            "Pembelian Pakan Jadi / Konsentrat", 
            "Pembelian Bahan Baku Pakan (Jagung, Bekatul)", 
            "Obat, Vitamin & Vaksin (OVK)", 
            "Gaji Karyawan / ABK", 
            "Listrik, Air & Internet", 
            "Perawatan & Perbaikan Kandang", 
            "Transportasi & BBM", 
            "Pengeluaran Operasional Lainnya"
        ],
        investasi: [
            "Pembuatan Kandang Baru", 
            "Pembelian Pullet (Ayam Remaja)", 
            "Pembelian Peralatan Kandang", 
            "Suntikan Modal Tambahan", 
            "Pembayaran Cicilan Hutang Pokok"
        ]
    };

    // --- LOGIKA DROPDOWN KATEGORI DINAMIS ---
    tipeTrx.addEventListener('change', function() {
        const tipe = this.value;
        kategoriTrx.innerHTML = ''; // Kosongkan opsi sebelumnya

        if (tipe && daftarKategori[tipe]) {
            kategoriTrx.disabled = false;
            kategoriTrx.innerHTML = '<option value="">-- Pilih Kategori --</option>';
            
            // Masukkan opsi sesuai array rekomendasi
            daftarKategori[tipe].forEach(kat => {
                kategoriTrx.innerHTML += `<option value="${kat}">${kat}</option>`;
            });
        } else {
            kategoriTrx.disabled = true;
            kategoriTrx.innerHTML = '<option value="">-- Pilih Tipe Dulu --</option>';
        }
    });

    // --- 1. CREATE: Input Transaksi ke Database ---
    formEkonomi.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnSubmitEkonomi');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mencatat...';
        
        const tanggal = tglTrx.value;
        const tipe = tipeTrx.value;
        const kategori = kategoriTrx.value;
        const nominal = parseFloat(document.getElementById('nominalTrx').value);
        const keterangan = document.getElementById('keteranganTrx').value.trim();

        try {
            await addDoc(collection(db, "transaksi_keuangan"), {
                tanggal_transaksi: tanggal,
                tipe_transaksi: tipe,
                kategori: kategori,
                nominal: nominal,
                keterangan: keterangan || "-", // Jika kosong, isi dengan strip
                timestamp_input: new Date()    // Waktu aktual data diketik admin
            });
            
            alert("Transaksi berhasil dicatat ke Buku Kas!");
            formEkonomi.reset();
            tipeTrx.dispatchEvent(new Event('change')); // Reset dropdown kategori
            tglTrx.value = new Date().toISOString().split('T')[0];
            
        } catch (error) {
            alert("Gagal mencatat transaksi: " + error.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Catat ke Buku Kas';
        }
    });

    // --- 2. READ: Menghitung Analisis Cepat & Laporan ---
    onSnapshot(collection(db, "transaksi_keuangan"), (snapshot) => {
        let totalInvestasi = 0;
        let totalPemasukan = 0;
        let totalPengeluaran = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.tipe_transaksi === 'investasi') totalInvestasi += data.nominal;
            else if(data.tipe_transaksi === 'pemasukan') totalPemasukan += data.nominal;
            else if(data.tipe_transaksi === 'pengeluaran') totalPengeluaran += data.nominal;
        });

        const labaBersih = totalPemasukan - totalPengeluaran;

        // Update UI Panel Analisis (Kalkulator)
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

        // Update UI Laporan Keuangan (Menu Sebelahnya)
        const laporanPanel = document.querySelector('#sec-laporan .space-y-4');
        if(laporanPanel) {
            laporanPanel.innerHTML = `
                <div class="flex justify-between items-center text-gray-700"><span>Total Pendapatan (Revenue)</span> <span class="font-semibold text-green-700">${formatRupiah(totalPemasukan)}</span></div>
                <div class="flex justify-between items-center text-gray-700"><span>Total Biaya Operasional (Opex)</span> <span class="font-semibold text-red-600">- ${formatRupiah(totalPengeluaran)}</span></div>
                <div class="border-t-2 border-dashed border-gray-300 pt-3 flex justify-between items-center text-lg font-bold ${labaBersih >= 0 ? 'text-green-700' : 'text-red-700'}">
                    <span>${labaBersih >= 0 ? 'Laba Bersih (Net Profit)' : 'Rugi Operasional'}</span> <span>${formatRupiah(Math.abs(labaBersih))}</span>
                </div>
            `;
        }
    });
}

// ==========================================
// E. CRUD HARGA TELUR JATIM
// ==========================================
function initCRUDHarga() {
    const formHargaTelur = document.getElementById('formHargaTelur');
    const inputHargaTelur = document.getElementById('inputHargaTelur');
    const displayHargaTelur = document.getElementById('display-harga-telur');
    const displayTrendHarga = document.getElementById('display-trend-harga');
    const tabelRiwayatHarga = document.getElementById('tabel-riwayat-harga');

    // 1. READ: Ambil 10 data harga terakhir secara real-time
    const qHarga = query(collection(db, "harga_pasar"), orderBy("tanggal", "desc"), limit(10));
    
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
        
        // Render Harga Terkini (Paling Atas di Database)
        displayHargaTelur.innerHTML = formatRupiah(latestData.harga);

        // Kalkulasi Tren (Bandingkan data index 0 dengan index 1 jika ada)
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

        // Render Tabel Riwayat
        docs.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id; // Format ID adalah YYYY-MM-DD
            
            // Format ulang tanggal agar lebih mudah dibaca (ex: 8 Mar 2026)
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

        // 3. DELETE: Event listener untuk tombol hapus riwayat
        document.querySelectorAll('.btn-hapus-harga').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idHapus = e.currentTarget.getAttribute('data-id');
                if(confirm(`Yakin ingin menghapus catatan harga untuk tanggal ${idHapus}?`)) {
                    await deleteDoc(doc(db, "harga_pasar", idHapus));
                }
            });
        });
    });

    // 2. CREATE / UPDATE: Simpan harga hari ini
    formHargaTelur.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnUpdateHarga');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const hargaBaru = parseFloat(inputHargaTelur.value);
        
        // Membuat string tanggal lokal format YYYY-MM-DD yang aman
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`; 

        try {
            // Menggunakan setDoc agar jika hari ini sudah diinput, dia akan menimpa/mengupdate datanya
            await setDoc(doc(db, "harga_pasar", todayStr), {
                tanggal: todayStr,
                harga: hargaBaru,
                timestamp: new Date()
            });
            
            inputHargaTelur.value = "";
        } catch (error) {
            alert("Gagal memperbarui harga: " + error.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Update Sistem';
        }
    });
}

// ==========================================
// F. LAPORAN KEUANGAN & BUKU BESAR (REVISI URUTAN TIMESTAMP)
// ==========================================
function initLaporanKeuangan() {
    const tabelBukuBesar = document.getElementById('tabel-buku-besar');
    const filterBulan = document.getElementById('filterBulanLaporan');
    const filterTahun = document.getElementById('filterTahunLaporan');

    const lapPemasukan = document.getElementById('lap-total-pemasukan');
    const lapPengeluaran = document.getElementById('lap-total-pengeluaran');
    const lapLabaBersih = document.getElementById('lap-laba-bersih');
    const lapInvestasi = document.getElementById('lap-total-investasi');

    // REVISI 1: Ambil data collection secara utuh
    const qTrx = collection(db, "transaksi_keuangan");

    onSnapshot(qTrx, (snapshot) => {
        let allTransactions = [];
        snapshot.forEach(doc => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });

        // REVISI 2: Pengurutan Ganda (Double Sorting) menggunakan JavaScript
        allTransactions.sort((a, b) => {
            // Prioritas 1: Urutkan berdasarkan Tanggal Transaksi (Terbaru di atas)
            if (b.tanggal_transaksi !== a.tanggal_transaksi) {
                return b.tanggal_transaksi.localeCompare(a.tanggal_transaksi);
            }
            // Prioritas 2: Jika tanggalnya SAMA, urutkan berdasarkan Jam/Detik Input (Timestamp)
            const timeA = a.timestamp_input ? a.timestamp_input.toMillis() : 0;
            const timeB = b.timestamp_input ? b.timestamp_input.toMillis() : 0;
            return timeB - timeA;
        });

        // Fungsi internal untuk memfilter dan me-render ulang data ke tabel
        function renderLaporan() {
            const bulanPilih = filterBulan.value;
            const tahunPilih = filterTahun.value;

            let sumPemasukan = 0;
            let sumPengeluaran = 0;
            let sumInvestasi = 0;

            tabelBukuBesar.innerHTML = '';

            // 1. Filter Data Berdasarkan Dropdown Bulan & Tahun
            const filteredData = allTransactions.filter(trx => {
                const trxDate = new Date(trx.tanggal_transaksi);
                const trxMonth = String(trxDate.getMonth() + 1).padStart(2, '0');
                const trxYear = String(trxDate.getFullYear());

                const matchBulan = (bulanPilih === 'all') ? true : (trxMonth === bulanPilih);
                const matchTahun = (trxYear === tahunPilih);

                return matchBulan && matchTahun;
            });

            // 2. Jika Data Kosong
            if(filteredData.length === 0) {
                tabelBukuBesar.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-gray-500 italic"><i class="fa-solid fa-folder-open text-2xl mb-2 block"></i> Tidak ada transaksi pada periode ini.</td></tr>';
            }

            // 3. Render Data ke Tabel
            filteredData.forEach(trx => {
                const dateObj = new Date(trx.tanggal_transaksi);
                const tglLokal = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                
                // Tambahkan waktu (jam:menit) untuk tampilan yang lebih informatif
                const timeString = trx.timestamp_input ? new Date(trx.timestamp_input.toMillis()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
                
                let rowHtml = '';
                let tipeBadge = '';
                
                // Pisahkan logika visual berdasarkan tipe transaksi
                if(trx.tipe_transaksi === 'pemasukan') {
                    sumPemasukan += trx.nominal;
                    tipeBadge = '<span class="bg-green-100 text-green-800 border border-green-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">INCOME</span>';
                    rowHtml = `
                        <td class="p-4 text-right text-green-700 font-semibold bg-green-50/30">${formatRupiah(trx.nominal)}</td>
                        <td class="p-4 text-right text-gray-300">-</td>
                    `;
                } else if (trx.tipe_transaksi === 'pengeluaran') {
                    sumPengeluaran += trx.nominal;
                    tipeBadge = '<span class="bg-red-100 text-red-800 border border-red-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">COST</span>';
                    rowHtml = `
                        <td class="p-4 text-right text-gray-300">-</td>
                        <td class="p-4 text-right text-red-700 font-semibold bg-red-50/30">${formatRupiah(trx.nominal)}</td>
                    `;
                } else if (trx.tipe_transaksi === 'investasi') {
                    sumInvestasi += trx.nominal;
                    tipeBadge = '<span class="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold tracking-wider">CAPEX</span>';
                    rowHtml = `
                        <td class="p-4 text-right text-gray-300">-</td>
                        <td class="p-4 text-right text-purple-700 font-semibold bg-purple-50/30">${formatRupiah(trx.nominal)}</td>
                    `;
                }

                // Render Baris HTML
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-blue-50 transition-colors group';
                tr.innerHTML = `
                    <td class="p-4 text-gray-600 font-medium whitespace-nowrap">
                        ${tglLokal} <br>
                        <span class="text-[10px] text-gray-400 font-normal"><i class="fa-regular fa-clock"></i> ${timeString}</span>
                    </td>
                    <td class="p-4 text-center">${tipeBadge}</td>
                    <td class="p-4">
                        <div class="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">${trx.kategori}</div>
                        <div class="text-xs text-gray-500 mt-1"><i class="fa-solid fa-note-sticky mr-1"></i> ${trx.keterangan || 'Tidak ada catatan'}</div>
                    </td>
                    ${rowHtml}
                `;
                tabelBukuBesar.appendChild(tr);
            });

            // 4. Update Angka Ringkasan Eksekutif
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
// G. SINKRONISASI DASHBOARD UTAMA & GRAFIK
// ==========================================
function initDashboardUtama() {
    const elProduksi = document.getElementById('dash-produksi-hari-ini');
    const elHdp = document.getElementById('dash-hdp-hari-ini');
    const elKas = document.getElementById('dash-kas-bulan-ini');
    
    // Variabel penampung grafik agar bisa di-destroy sebelum dirender ulang (mencegah bug tumpang tindih)
    let myChart = null;

    // 1. SINKRONISASI PRODUKSI & GRAFIK (Baca data produksi)
    const qProd = query(collection(db, "produksi_harian"), orderBy("tanggal", "desc"), limit(50));
    
    onSnapshot(qProd, (snapshot) => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        let totalTelurHariIni = 0;
        let totalHdpHariIni = 0;
        let countKandangHariIni = 0;

        // Objek untuk mengelompokkan data berdasarkan tanggal (karena bisa ada >1 kandang per hari)
        const rekapHarian = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const tgl = data.tanggal;

            // Agregasi (Penggabungan) data per tanggal
            if (!rekapHarian[tgl]) {
                rekapHarian[tgl] = { telur: 0, pakan: 0 };
            }
            rekapHarian[tgl].telur += data.total_telur_kg;
            rekapHarian[tgl].pakan += data.pakan_habis_kg;

            // Hitung spesifik untuk HARI INI
            if (tgl === todayStr) {
                totalTelurHariIni += data.total_telur_kg;
                totalHdpHariIni += data.hdp_persen;
                countKandangHariIni++;
            }
        });

        // Update Widget Hari Ini
        elProduksi.innerHTML = `${totalTelurHariIni.toFixed(1)} <span class="text-sm font-normal text-gray-500">kg</span>`;
        
        if (countKandangHariIni > 0) {
            const rataHdp = (totalHdpHariIni / countKandangHariIni).toFixed(1);
            elHdp.innerHTML = `${rataHdp} <span class="text-sm font-normal text-gray-500">%</span>`;
        } else {
            elHdp.innerHTML = `0 <span class="text-sm font-normal text-gray-500">%</span>`;
        }

        // --- RENDER GRAFIK (7 Hari Terakhir) ---
        // Ambil maksimal 7 tanggal terakhir, urutkan dari yang terlama ke terbaru (kiri ke kanan)
        const sortedDates = Object.keys(rekapHarian).sort().slice(-7); 
        
        const labels = [];
        const dataTelur = [];
        const dataPakan = [];

        sortedDates.forEach(tgl => {
            // Ubah format "YYYY-MM-DD" jadi "DD MMM" untuk label bawah grafik
            const dateObj = new Date(tgl);
            labels.push(dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            
            dataTelur.push(rekapHarian[tgl].telur.toFixed(1));
            dataPakan.push(rekapHarian[tgl].pakan.toFixed(1));
        });

        const ctx = document.getElementById('chartProduksi').getContext('2d');
        
        // Hancurkan grafik lama jika ada update real-time
        if (myChart) myChart.destroy();

        // Buat Grafik Baru
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Produksi Telur (Kg)',
                        data: dataTelur,
                        borderColor: '#eab308', // Yellow-500
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        borderWidth: 3,
                        tension: 0.3, // Membuat garis melengkung halus
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Konsumsi Pakan (Kg)',
                        data: dataPakan,
                        borderColor: '#3b82f6', // Blue-500
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5], // Garis putus-putus
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        type: 'linear', display: true, position: 'left',
                        title: { display: true, text: 'Telur (Kg)' }
                    },
                    y1: { 
                        type: 'linear', display: true, position: 'right',
                        title: { display: true, text: 'Pakan (Kg)' },
                        grid: { drawOnChartArea: false } // Hilangkan garis grid bertumpuk
                    }
                }
            }
        });
    });

    // 2. SINKRONISASI ARUS KAS BERSIH (BULAN INI)
    onSnapshot(collection(db, "transaksi_keuangan"), (snapshot) => {
        const d = new Date();
        const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
        const currentYear = String(d.getFullYear());

        let kasMasukBulanIni = 0;
        let kasKeluarBulanIni = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const tglTrx = new Date(data.tanggal_transaksi);
            const trxMonth = String(tglTrx.getMonth() + 1).padStart(2, '0');
            const trxYear = String(tglTrx.getFullYear());

            // Filter hanya transaksi bulan dan tahun ini
            if (trxMonth === currentMonth && trxYear === currentYear) {
                if (data.tipe_transaksi === 'pemasukan') {
                    kasMasukBulanIni += data.nominal;
                } else if (data.tipe_transaksi === 'pengeluaran') {
                    // Opex mengurangi arus kas
                    kasKeluarBulanIni += data.nominal;
                } else if (data.tipe_transaksi === 'investasi') {
                    // Capex juga mengurangi arus kas riil di bank
                    kasKeluarBulanIni += data.nominal;
                }
            }
        });

        const netCashFlow = kasMasukBulanIni - kasKeluarBulanIni;
        
        // Format & Warnai Widget
        if (netCashFlow > 0) {
            elKas.innerHTML = `<span class="text-green-600">+ ${formatRupiah(netCashFlow)}</span>`;
        } else if (netCashFlow < 0) {
            elKas.innerHTML = `<span class="text-red-600">- ${formatRupiah(Math.abs(netCashFlow))}</span>`;
        } else {
            elKas.innerHTML = formatRupiah(0);
        }
    });
}