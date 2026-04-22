// ============================================================
// PARKFINDER ADMIN SCRIPT – Enhanced v2
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
        body: JSON.stringify({ name, latitude: lat, longitude: lng, status })
    })
        .then(res => {
            if (!res.ok) throw new Error('Lỗi server');
            return res.json();
        })
        .then(result => {
            showToast(`✅ Đã lưu "${result.name}" thành công!`, 'success');
            document.getElementById('parkName').value = '';
            document.getElementById('coordsDisplay').value = '';
            currentMarker.remove();
            loadExistingMarkers();
        })
        .catch(err => showToast('❌ ' + err.message, 'error'))
        .finally(() => {
            btn.textContent = origText;
            btn.disabled = false;
        });
}

// ─── 5. LOAD MARKERS ─────────────────────────────────────────
let parkingMarkers = [];

function loadExistingMarkers() {
    parkingMarkers.forEach(m => m.remove());
    parkingMarkers = [];

    fetch('http://localhost:8080/api/parking/all')
        .then(res => res.json())
        .then(parkings => {
            // Update mini stats
            const total = parkings.length;
            const avail = parkings.filter(p => p.status === 'available').length;
            const full = total - avail;
            animateNum('statTotal', total);
            animateNum('statAvail', avail);
            animateNum('statFull', full);

            parkings.forEach(park => {
                const isAvail = park.status === 'available';
                const color = isAvail ? '#10B981' : '#EF4444';
                const marker = new mapboxgl.Marker({ color })
                    .setLngLat([park.longitude, park.latitude])
                    .setPopup(new mapboxgl.Popup().setHTML(`
                    <div style="padding:10px;font-family:'Be Vietnam Pro',sans-serif;">
                        <strong style="font-size:14px;color:#0A1628">${park.name}</strong>
                        <div style="margin-top:4px;font-size:12px;color:${isAvail ? '#10B981' : '#EF4444'};font-weight:600">
                            ${isAvail ? '✅ Còn chỗ' : '❌ Hết chỗ'}
                        </div>
                        <div style="margin-top:4px;font-size:11px;color:#64748B">ID: ${park.id}</div>
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
    const step = Math.ceil(target / 20);
    const t = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(t);
    }, 30);
}

// ─── 6. BOOKING MANAGEMENT ───────────────────────────────────
function loadAdminBookings() {
    fetch('http://localhost:8080/api/booking/all')
        .then(res => res.json())
        .then(bookings => {
            const body = document.getElementById('bookingTableBody');
            document.getElementById('bookingCount').textContent = bookings.length;

            if (!bookings.length) {
                body.innerHTML = '<tr><td colspan="3" style="color:#94a3b8;text-align:center;padding:20px">Chưa có đặt chỗ nào</td></tr>';
                return;
            }

            body.innerHTML = bookings.map(b => `
            <tr>
                <td><span class="user-name">👤 ${b.userName}</span></td>
                <td><span class="lot-id">#${b.parkingLotId}</span></td>
                <td>
                    <button class="btn-release" onclick="releaseSpot(${b.parkingLotId})">Xong ✓</button>
                </td>
            </tr>`).join('');
        })
        .catch(err => console.error('Lỗi tải booking:', err));
}

function releaseSpot(id) {
    if (!confirm('Xác nhận giải phóng bãi xe #' + id + '?')) return;
    fetch(`http://localhost:8080/api/booking/release/${id}`, { method: 'POST' })
        .then(res => res.text())
        .then(msg => {
            showToast(msg || 'Đã giải phóng chỗ', 'success');
            loadAdminBookings();
            loadExistingMarkers();
        })
        .catch(err => showToast('Lỗi: ' + err, 'error'));
}

// ─── 7. LOGOUT ───────────────────────────────────────────────
function logout() {
    if (confirm('Đăng xuất khỏi hệ thống?')) {
        sessionStorage.removeItem('adminLoggedIn');
        sessionStorage.removeItem('adminName');
        window.location.href = 'login.html?role=admin';
    }
}

// ─── 8. TOAST ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        Object.assign(toast.style, {
            position: 'fixed', bottom: '24px', right: '24px',
            padding: '12px 20px', borderRadius: '10px', color: 'white',
            fontSize: '14px', fontWeight: '600', zIndex: '1000',
            fontFamily: "'Be Vietnam Pro', sans-serif",
            transform: 'translateY(60px)', opacity: '0',
            transition: 'all .3s cubic-bezier(.4,0,.2,1)',
            maxWidth: '320px', boxShadow: '0 8px 24px rgba(10,22,40,.25)'
        });
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#EF4444' : '#10B981';
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.transform = 'translateY(60px)';
        toast.style.opacity = '0';
    }, 3500);
}

// ─── 9. INIT ─────────────────────────────────────────────────
map.on('load', () => {
    loadExistingMarkers();
    loadAdminBookings();
    setInterval(loadAdminBookings, 15000); // Refresh booking list every 15s
});
