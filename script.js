// ==========================================
// KONFIGURASI API GOOGLE SHEETS
// ==========================================
// URL Web App Google Apps Script Anda yang sudah berhasil di-deploy
const apiUrl = 'https://script.google.com/macros/s/AKfycbzSY9CDZCWNxJNncZtv2dk16rZgbkh2vhGvHn-eC8Do2xf41Dc0wbHkllc1UlLLVtJbyQ/exec';

// ==========================================
// 1. FUNGSI MENGAMBIL & RENDER HARGA TELUR
// ==========================================
async function loadHargaJatim() {
    const tbody = document.getElementById('body-tabel-harga');
    const marketPriceTicker = document.getElementById('market-price');
    const ashdaPriceTicker = document.getElementById('ashda-price');
    const waktuUpdateElement = document.getElementById('waktu-update'); // Menangkap elemen waktu
    
    // Tampilkan status loading
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Mengambil data harga realtime dari database...</td></tr>';
    if(waktuUpdateElement) waktuUpdateElement.innerHTML = '⏳ Sedang menyinkronkan data...';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Jaringan bermasalah');
        
        const data = await response.json();
        tbody.innerHTML = ''; 

        let hargaSidoarjo = 27900; // Default

        data.forEach(item => {
            let ikonTren = item.tren === 'up' ? '▲ Naik' : item.tren === 'down' ? '▼ Turun' : '▬ Stabil';
            let kelasTren = item.tren === 'up' ? 'trend-up' : item.tren === 'down' ? 'trend-down' : 'trend-stable';

            if (item.kota && item.kota.toLowerCase().includes('sidoarjo')) {
                hargaSidoarjo = parseInt(item.harga);
            }

            tbody.innerHTML += `
                <tr>
                    <td><strong>${item.kota}</strong></td>
                    <td>Rp. ${parseInt(item.harga).toLocaleString('id-ID')}</td>
                    <td class="${kelasTren}">${ikonTren}</td>
                </tr>
            `;
        });

        if(marketPriceTicker) marketPriceTicker.innerText = `Rp. ${hargaSidoarjo.toLocaleString('id-ID')} / KG`;
        if(ashdaPriceTicker) ashdaPriceTicker.innerText = `Rp. 27.000 / KG`;

        // === FITUR BARU: GENERATE WAKTU UPDATE ===
        if(waktuUpdateElement) {
            const now = new Date();
            // Format waktu ke bahasa Indonesia (Contoh: Rabu, 25 Februari 2026 pukul 13:45:10)
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            const waktuFormat = now.toLocaleDateString('id-ID', options).replace(/\./g, ':');
            
            waktuUpdateElement.innerHTML = `✅ <strong>Live Update:</strong> ${waktuFormat} WIB`;
        }

    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="3" style="color: red; text-align: center;">Gagal mengambil data dari Google Sheets. Pastikan koneksi internet lancar.</td></tr>';
        if(waktuUpdateElement) waktuUpdateElement.innerHTML = '❌ Gagal menyinkronkan data.';
        console.error("Error:", error);
    }
}
// ==========================================
// 2. RENDER DATA EDUKASI (PREMIUM STYLE)
// ==========================================
const edukasiData = [
    { 
        judul: "Manajemen Pakan Ayam Petelur Fase Produksi", 
        kategori: "Nutrisi & Pakan",
        date: "20 Feb 2026",
        img: "https://images.unsplash.com/photo-1548550023-2bf3c49bce37?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Komposisi nutrisi yang tepat untuk memaksimalkan ketebalan cangkang dan standar berat telur F1." 
    },
    { 
        judul: "Mencegah Penyakit ND & AI di Musim Hujan", 
        kategori: "Biosekuriti",
        date: "12 Feb 2026",
        img: "https://images.unsplash.com/photo-1516467508483-a7212febe31a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Panduan biosekuriti ketat dan jadwal vaksinasi wajib untuk peternak mandiri agar terhindar dari virus." 
    },
    { 
        judul: "Optimalisasi Sistem Pencahayaan Kandang", 
        kategori: "Manajemen Kandang",
        date: "05 Feb 2026",
        img: "https://images.unsplash.com/photo-1599839619722-39751411ea63?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Bagaimana durasi dan intensitas lampu (lighting) sangat mempengaruhi rasio produktivitas bertelur." 
    }
];

const edukasiGrid = document.getElementById('edukasi-grid');
if (edukasiGrid) {
    edukasiGrid.innerHTML = ''; // Bersihkan data lama
    edukasiData.forEach(item => {
        edukasiGrid.innerHTML += `
            <article class="premium-card">
                <div class="card-img-wrapper">
                    <img src="${item.img}" alt="${item.judul}" loading="lazy">
                    <span class="card-badge badge-yellow">${item.kategori}</span>
                </div>
                <div class="card-body">
                    <span class="card-meta">🗓️ ${item.date}</span>
                    <h3 class="card-title">${item.judul}</h3>
                    <p class="card-excerpt">${item.desc}</p>
                    <a href="#edukasi" class="read-more">Baca Panduan <span class="arrow">→</span></a>
                </div>
            </article>
        `;
    });
}

// ==========================================
// 3. RENDER DATA BERITA (PREMIUM STYLE)
// ==========================================
const beritaData = [
    { 
        judul: "Kebijakan Bapanas Terkait Harga Acuan Telur 2026", 
        kategori: "Regulasi",
        date: "24 Feb 2026",
        img: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Pemerintah resmi merilis batas atas dan batas bawah harga telur di tingkat peternak untuk stabilisasi pasar." 
    },
    { 
        judul: "Ashda Nusantara Perluas Jaringan Mitra Reseller", 
        kategori: "Bisnis",
        date: "20 Feb 2026",
        img: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Program kemitraan baru dengan minimal pengambilan 10KG khusus untuk agen lokal di wilayah Jawa Timur." 
    },
    { 
        judul: "Subsidi Jagung Pakan Tiba Bulan Depan", 
        kategori: "Ekonomi Pangan",
        date: "15 Feb 2026",
        img: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        desc: "Kabar baik bagi peternak, distribusi jagung subsidi akan disalurkan via koperasi daerah." 
    }
];

const beritaGrid = document.getElementById('berita-grid');
if (beritaGrid) {
    beritaGrid.innerHTML = '';
    beritaData.forEach(item => {
        beritaGrid.innerHTML += `
            <article class="premium-card">
                <div class="card-img-wrapper">
                    <img src="${item.img}" alt="${item.judul}" loading="lazy">
                    <span class="card-badge badge-green">${item.kategori}</span>
                </div>
                <div class="card-body">
                    <span class="card-meta">🗓️ ${item.date}</span>
                    <h3 class="card-title">${item.judul}</h3>
                    <p class="card-excerpt">${item.desc}</p>
                    <a href="#berita" class="read-more">Baca Berita <span class="arrow">→</span></a>
                </div>
            </article>
        `;
    });
}
// ==========================================
// 4. JALANKAN SEMUA FUNGSI SAAT WEB DIBUKA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadHargaJatim();
    setInterval(loadHargaJatim, 300000); // Auto-refresh data tiap 5 menit
});