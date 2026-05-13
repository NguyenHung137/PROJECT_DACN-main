// ============================================================
// PARKFINDER ADMIN SCRIPT – Enhanced v3
// ============================================================

// ─── 1. AUTH ─────────────────────────────────────────────────
if (sessionStorage.getItem('adminLoggedIn') !== 'true') {
    window.location.href = 'login.html?role=admin';
}

// ─── 2. MAPBOX INIT ──────────────────────────────────────────
mapboxgl.accessToken = 'pk.eyJ1Ijoibmd1eWVuaHVuZzEzIiwiYSI6ImNtazFjNnBnejA0czYzZXB5ZTNzcjllcDQifQ' + '.ynvPkLQlpXet1RCrWoMZcA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [106.660172, 10.762622],
    zoom: 13
});
map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

// ─── 3. GEOCODER ─────────────────────────────────────────────
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: '🔍 Tìm nhanh vị trí để thêm bãi xe...',
    countries: 'vn', language: 'vi'
});
map.addControl(geocoder, 'top-left');

const currentMarker = new mapboxgl.Marker({ color: '#F97316' });

geocoder.on('result', e => {
    const coords = e.result.center;
    currentMarker.setLngLat(coords).addTo(map);
    document.getElementById('coordsDisplay').value = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
});

map.on('click', e => {
    const { lng, lat } = e.lngLat;
    currentMarker.setLngLat([lng, lat]).addTo(map);
    document.getElementById('coordsDisplay').value = `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
});

// ─── 4. SAVE PARKING ─────────────────────────────────────────
function saveParking() {
    const name = document.getElementById('parkName').value.trim();
    const coordsRaw = document.getElementById('coordsDisplay').value;
    const status = document.getElementById('parkStatus').value;
    const capacity = document.getElementById('parkCapacity').value || 50;

    if (!name || !coordsRaw || coordsRaw === 'Chưa chọn vị trí') {
        showToast('Vui lòng nhập tên và click chọn vị trí trên bản đồ!', 'error');
        return;
    }

    const [lng, lat] = coordsRaw.split(',').map(c => parseFloat(c.trim()));
    const btn = document.getElementById('btnSave');
    const origText = btn.textContent;
    btn.textContent = '⏳ Đang lưu...';
    btn.disabled = true;

    fetch('http://localhost:8080/api/parking/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, latitude: lat, longitude: lng, status, capacity: parseInt(capacity) })
    })
        .then(res => { if (!res.ok) throw new Error('Lỗi server'); return res.json(); })
        .then(result => {
            showToast(`✅ Đã lưu "${result.name}" thành công!`, 'success');
            document.getElementById('parkName').value = '';
            document.getElementById('coordsDisplay').value = '';
            document.getElementById('parkCapacity').value = '';
            currentMarker.remove();
            loadExistingMarkers();
        })
        .catch(err => showToast('❌ ' + err.message, 'error'))
        .finally(() => { btn.textContent = origText; btn.disabled = false; });
}

// ─── 5. LOAD MARKERS ─────────────────────────────────────────
let parkingMarkers = [];
let allParkingData = [];

function loadExistingMarkers() {
    parkingMarkers.forEach(m => m.remove());
    parkingMarkers = [];

    fetch('http://localhost:8080/api/parking/all')
        .then(res => res.json())
        .then(parkings => {
            allParkingData = parkings;
            const total = parkings.length;
            const avail = parkings.filter(p => p.status === 'available').length;
            animateNum('statTotal', total);
            animateNum('statAvail', avail);
            animateNum('statFull', total - avail);

            parkings.forEach(park => {
                const isAvail = park.status === 'available';
                const color = isAvail ? '#10B981' : '#EF4444';
                const marker = new mapboxgl.Marker({ color })
                    .setLngLat([park.longitude, park.latitude])
                    .setPopup(new mapboxgl.Popup({ maxWidth: '240px' }).setHTML(`
                    <div style="padding:14px;font-family:'Be Vietnam Pro',sans-serif;">
                        <strong style="font-size:14px;color:#0A1628">${park.name}</strong>
                        <div style="margin-top:4px;font-size:12px;color:${isAvail?'#10B981':'#EF4444'};font-weight:600">
                            ${isAvail ? '✅ Còn chỗ' : '❌ Hết chỗ'}
                        </div>
                        <div style="margin-top:6px;font-size:11px;color:#64748B">ID: ${park.id}</div>
                        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
                            <button onclick="openEditModal(${park.id},'${park.name.replace(/'/g,"\\'")}','${park.status}')"
                                style="padding:6px 10px;background:#2563EB;color:white;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">✏️ Sửa</button>
                            <button onclick="toggleParkStatus(${park.id},'${park.status}')"
                                style="padding:6px 10px;background:${isAvail?'#EF4444':'#10B981'};color:white;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">
                                ${isAvail ? '❌ Đặt đầy' : '✅ Mở chỗ'}</button>
                            <button onclick="deletePark(${park.id},'${park.name.replace(/'/g,"\\'")}' )"
                                style="padding:6px 10px;background:#FEF2F2;color:#EF4444;border:1px solid #FCA5A5;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">🗑️ Xóa</button>
                        </div>
                    </div>`))
                    .addTo(map);
                parkingMarkers.push(marker);
            });
        })
        .catch(err => showToast('Không thể tải bãi xe: ' + err.message, 'error'));
}

function animateNum(id, target) {
    const el = document.getElementById(id);
    let current = 0;
    const step = Math.ceil(Math.max(target, 1) / 20);
    const t = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(t);
    }, 30);
}

// ─── 6. EDIT PARKING ─────────────────────────────────────────
let editingParkId = null;

function openEditModal(id, name, status) {
    editingParkId = id;
    document.getElementById('editParkName').value = name;
    document.getElementById('editParkStatus').value = status;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    editingParkId = null;
}

function saveEdit() {
    const name = document.getElementById('editParkName').value.trim();
    const status = document.getElementById('editParkStatus').value;
    if (!name) { showToast('Vui lòng nhập tên bãi xe', 'error'); return; }
    fetch(`http://localhost:8080/api/parking/update/${editingParkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status })
    })
        .then(res => { if (!res.ok) throw new Error('Lỗi server'); return res.json(); })
        .then(() => { showToast('✅ Đã cập nhật bãi xe!', 'success'); closeEditModal(); loadExistingMarkers(); })
        .catch(err => showToast('❌ ' + err.message, 'error'));
}

// ─── 7. TOGGLE STATUS ────────────────────────────────────────
function toggleParkStatus(id, currentStatus) {
    const newStatus = currentStatus === 'available' ? 'full' : 'available';
    fetch(`http://localhost:8080/api/parking/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(() => { showToast(`✅ Đã đổi sang "${newStatus === 'available' ? 'Còn chỗ' : 'Đầy chỗ'}"`, 'success'); loadExistingMarkers(); })
        .catch(() => showToast('❌ Không thể đổi trạng thái', 'error'));
}

// ─── 8. DELETE PARKING ───────────────────────────────────────
function deletePark(id, name) {
    if (!confirm(`Xóa bãi xe "${name}"?\nHành động này không thể hoàn tác!`)) return;
    fetch(`http://localhost:8080/api/parking/delete/${id}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('Lỗi server'); return res.text(); })
        .then(() => { showToast(`🗑️ Đã xóa "${name}"`, 'success'); loadExistingMarkers(); })
        .catch(err => showToast('❌ ' + err.message, 'error'));
}

// ─── 9. BOOKING MANAGEMENT ───────────────────────────────────
let allBookings = [];

function loadAdminBookings() {
    fetch('http://localhost:8080/api/booking/all')
        .then(res => res.json())
        .then(bookings => {
            allBookings = bookings;
            document.getElementById('bookingCount').textContent = bookings.length;
            renderBookings(bookings);
        })
        .catch(err => console.error('Lỗi tải booking:', err));
}

function filterBookings() {
    const q = document.getElementById('bookingSearch').value.toLowerCase();
    renderBookings(allBookings.filter(b =>
        (b.userName || '').toLowerCase().includes(q) ||
        (b.parkingLotName || '').toLowerCase().includes(q)
    ));
}

function renderBookings(bookings) {
    const body = document.getElementById('bookingTableBody');
    if (!bookings.length) {
        body.innerHTML = '<tr><td colspan="4" style="color:#94a3b8;text-align:center;padding:20px">Chưa có đặt chỗ nào</td></tr>';
        return;
    }
    body.innerHTML = bookings.map(b => {
        const created = b.createdAt ? new Date(b.createdAt) : null;
        const elapsed = created ? getElapsedStr(created) : '—';
        return `<tr>
            <td><span class="user-name">👤 ${b.userName || '—'}</span></td>
            <td><span class="lot-id">#${b.parkingLotId}</span></td>
            <td><span style="font-size:11px;color:#64748B" title="${created ? created.toLocaleString('vi-VN') : ''}">🕐 ${elapsed}</span></td>
            <td><button class="btn-release" onclick="releaseSpot(${b.parkingLotId})">Xong ✓</button></td>
        </tr>`;
    }).join('');
}

function getElapsedStr(date) {
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return `${sec}s trước`;
    if (sec < 3600) return `${Math.floor(sec/60)}p trước`;
    return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}p`;
}

function releaseSpot(id) {
    if (!confirm('Xác nhận giải phóng bãi xe #' + id + '?')) return;
    fetch(`http://localhost:8080/api/booking/release/${id}`, { method: 'POST' })
        .then(res => res.text())
        .then(msg => { showToast(msg || 'Đã giải phóng chỗ', 'success'); loadAdminBookings(); loadExistingMarkers(); })
        .catch(err => showToast('Lỗi: ' + err, 'error'));
}

// ─── 10. EXPORT CSV ──────────────────────────────────────────
function exportCSV() {
    if (!allBookings.length) { showToast('Không có dữ liệu để xuất', 'error'); return; }
    const headers = ['STT', 'Khách hàng', 'Số điện thoại', 'Bãi xe', 'Thời gian', 'Số tiền'];
    const rows = allBookings.map((b, i) => [
        i + 1, b.userName || '—', b.phone || '—',
        b.parkingLotName || ('Bãi #' + b.parkingLotId),
        b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : '—',
        b.totalPrice ? b.totalPrice.toLocaleString('vi-VN') + ' VNĐ' : 'Chưa TT'
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
        download: `parkfinder_${new Date().toISOString().slice(0,10)}.csv`
    });
    a.click();
    showToast('📥 Đã xuất file CSV!', 'success');
}

// ─── 11. LOGOUT ──────────────────────────────────────────────
function logout() {
    if (confirm('Đăng xuất khỏi hệ thống?')) {
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminName');
        window.location.href = 'login.html?role=admin';
    }
}

// ─── 12. TOAST ───────────────────────────────────────────────
function showToast(msg, type = 'success') {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        Object.assign(toast.style, {
            position:'fixed', bottom:'24px', right:'24px',
            padding:'12px 20px', borderRadius:'10px', color:'white',
            fontSize:'14px', fontWeight:'600', zIndex:'1000',
            fontFamily:"'Be Vietnam Pro', sans-serif",
            transform:'translateY(60px)', opacity:'0',
            transition:'all .3s cubic-bezier(.4,0,.2,1)',
            maxWidth:'320px', boxShadow:'0 8px 24px rgba(10,22,40,.25)'
        });
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#EF4444' : '#10B981';
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.transform = 'translateY(60px)'; toast.style.opacity = '0'; }, 3500);
}

// ─── 13. INIT ────────────────────────────────────────────────
map.on('load', () => {
    loadExistingMarkers();
    loadAdminBookings();
    setInterval(loadAdminBookings, 15000);
    setInterval(() => filterBookings(), 30000);
});
