// ============================================================
// PARKFINDER USER SCRIPT – Enhanced v3 (Payment Integration)
// ============================================================

// ─── 1. AUTH CHECK ─────────────────────────────────────────
if (sessionStorage.getItem('userLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}
const CURRENT_USER = sessionStorage.getItem('userName') || 'Khách';
document.getElementById('userNameDisplay').textContent = '👤 ' + CURRENT_USER;

function doLogout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        sessionStorage.removeItem('userLoggedIn');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userId');
        window.location.href = 'login.html';
    }
}

// ─── 2. MAPBOX INIT ─────────────────────────────────────────
mapboxgl.accessToken = 'pk.eyJ1Ijoibmd1eWVuaHVuZzEzIiwiYSI6ImNtazFjNnBnejA0czYzZXB5ZTNzcjllcDQifQ' + '.ynvPkLQlpXet1RCrWoMZcA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [106.660172, 10.762622],
    zoom: 13
});

map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

// Map Legend
const legendHTML = `
<div class="map-legend">
    <div class="legend-title">Chú thích</div>
    <div class="legend-item"><div class="legend-dot ld-green"></div>Còn chỗ</div>
    <div class="legend-item"><div class="legend-dot ld-red"></div>Hết chỗ</div>
</div>`;
document.getElementById('map').insertAdjacentHTML('afterend', legendHTML);

// ─── 3. NOMINATIM SEARCH (OSM – hỗ trợ số nhà Việt Nam) ─────
let searchDebounceTimer = null;
let searchMarker = null;
let activeIndex = -1;
let searchResults = [];

function getIcon(item) {
    const cls = (item.class || '').toLowerCase();
    if (cls === 'highway') return '🛣️';
    if (cls === 'amenity') return '📍';
    if (cls === 'building') return '🏢';
    if (cls === 'place') return '🔖';
    const t = (item.type || '').toLowerCase();
    if (t === 'house' || t === 'residential') return '🏠';
    return '📌';
}

function buildDisplayName(item) {
    const a = item.address || {};
    const parts = [];
    if (a.house_number) parts.push(a.house_number);
    if (a.road || a.pedestrian || a.path) parts.push(a.road || a.pedestrian || a.path);
    const main = parts.length ? parts.join(' ') : (item.name || item.display_name.split(',')[0]);

    const sub = [];
    if (a.suburb || a.neighbourhood) sub.push(a.suburb || a.neighbourhood);
    if (a.city_district || a.town || a.city) sub.push(a.city_district || a.town || a.city);
    const secondary = sub.join(', ') || item.display_name.split(',').slice(1, 3).join(',').trim();
    return { main, secondary };
}

function getTypeLabel(item) {
    const cls = (item.class || '').toLowerCase();
    const t = (item.type || '').toLowerCase();
    if (cls === 'highway') return 'Đường';
    if (cls === 'amenity') return 'Tiện ích';
    if (cls === 'building') return 'Tòa nhà';
    if (cls === 'place') return 'Địa điểm';
    if (t === 'house' || t === 'residential') return 'Số nhà';
    return '';
}

function onSearchInput() {
    const q = document.getElementById('searchInput').value.trim();
    document.getElementById('searchClear').style.display = q ? 'flex' : 'none';
    clearTimeout(searchDebounceTimer);
    if (q.length < 2) { closeDropdown(); return; }
    searchDebounceTimer = setTimeout(() => nominatimSearch(q), 380);
}

async function nominatimSearch(q) {
    showSearchLoading();
    try {
        const url = `https://nominatim.openstreetmap.org/search` +
            `?q=${encodeURIComponent(q + ', Hồ Chí Minh, Việt Nam')}` +
            `&format=json&addressdetails=1&limit=8&countrycodes=vn` +
            `&viewbox=106.4,10.6,107.0,11.0&bounded=0` +
            `&accept-language=vi`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'vi' } });
        const data = await res.json();
        searchResults = data;
        renderDropdown(data, q);
    } catch { renderDropdownError(); }
}

function renderDropdown(items, q) {
    const dd = document.getElementById('searchDropdown');
    activeIndex = -1;
    if (!items.length) {
        dd.innerHTML = `<div class="sd-empty">❌ Không tìm thấy "${q}" – thử nhập đầy đủ hơn</div>
            <div class="sd-powered">Dữ liệu từ <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a></div>`;
        dd.classList.add('open'); return;
    }
    dd.innerHTML = items.map((item, i) => {
        const { main, secondary } = buildDisplayName(item);
        const icon = getIcon(item);
        const label = getTypeLabel(item);
        return `<div class="sd-item" onclick="selectResult(${i})" onmouseenter="activeIndex=${i}">
            <div class="sd-icon">${icon}</div>
            <div class="sd-text">
                <div class="sd-name">${main}</div>
                ${secondary ? `<div class="sd-addr">${secondary}</div>` : ''}
            </div>
            ${label ? `<span class="sd-type">${label}</span>` : ''}
        </div>`;
    }).join('') +
        `<div class="sd-powered">Dữ liệu từ <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> · Nominatim</div>`;
    dd.classList.add('open');
}

function renderDropdownError() {
    document.getElementById('searchDropdown').innerHTML =
        `<div class="sd-empty">⚠️ Lỗi kết nối. Kiểm tra mạng.</div>`;
    document.getElementById('searchDropdown').classList.add('open');
}

function showSearchLoading() {
    document.getElementById('searchDropdown').innerHTML =
        `<div class="sd-loading"><div class="sd-spinner"></div>Đang tìm kiếm...</div>`;
    document.getElementById('searchDropdown').classList.add('open');
}

function selectResult(index) {
    const item = searchResults[index];
    if (!item) return;
    const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
    const { main, secondary } = buildDisplayName(item);

    map.flyTo({ center: [lon, lat], zoom: 17, essential: true, speed: 1.4 });

    if (searchMarker) searchMarker.remove();
    searchMarker = new mapboxgl.Marker({ color: '#2563EB' })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup({ closeButton: false, offset: 12 })
            .setHTML(`<div style="padding:8px 10px;font-family:'Be Vietnam Pro',sans-serif;min-width:160px">
                <div style="font-weight:700;font-size:13px;color:#0A1628;margin-bottom:2px">${main}</div>
                ${secondary ? `<div style="font-size:11px;color:#64748B">${secondary}</div>` : ''}
            </div>`))
        .addTo(map);
    searchMarker.getPopup().addTo(map);

    document.getElementById('searchInput').value = main;
    document.getElementById('searchClear').style.display = 'flex';
    closeDropdown();
}

function closeDropdown() {
    document.getElementById('searchDropdown').classList.remove('open');
    activeIndex = -1;
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').style.display = 'none';
    closeDropdown();
    if (searchMarker) { searchMarker.remove(); searchMarker = null; }
    document.getElementById('searchInput').focus();
}

function onSearchKey(e) {
    const dd = document.getElementById('searchDropdown');
    const items = dd.querySelectorAll('.sd-item');
    if (!items.length) {
        if (e.key === 'Enter') nominatimSearch(document.getElementById('searchInput').value.trim());
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        items.forEach((el, i) => el.style.background = i === activeIndex ? '#f0f6ff' : '');
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        items.forEach((el, i) => el.style.background = i === activeIndex ? '#f0f6ff' : '');
    } else if (e.key === 'Enter') {
        if (activeIndex >= 0) selectResult(activeIndex);
        else if (searchResults.length) selectResult(0);
    } else if (e.key === 'Escape') { closeDropdown(); }
}

document.addEventListener('click', e => {
    const sw = document.getElementById('searchWrap');
    if (sw && !sw.contains(e.target)) closeDropdown();
});

// ─── 4. GPS LOCATE ───────────────────────────────────────────
let userMarker = null;

function locateMe() {
    if (!navigator.geolocation) { showToast('Trình duyệt không hỗ trợ định vị', 'red'); return; }
    const btn = document.getElementById('btnLocate');
    btn.textContent = '⏳ Đang định vị...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        pos => {
            const { longitude: lng, latitude: lat } = pos.coords;
            map.flyTo({ center: [lng, lat], zoom: 16, essential: true });
            if (userMarker) userMarker.remove();
            userMarker = new mapboxgl.Marker({ color: '#2563EB' })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup({ closeButton: false })
                    .setHTML('<div style="padding:8px;font-size:13px;font-weight:600;color:#0A1628">📍 Bạn đang ở đây</div>'))
                .addTo(map);
            btn.textContent = '📍 Vị trí của tôi';
            btn.disabled = false;
            showToast('Đã tìm thấy vị trí của bạn!', 'green');
        },
        err => {
            const msgs = {
                1: 'Bạn chưa cho phép truy cập vị trí',
                2: 'Vị trí hiện không khả dụng',
                3: 'Quá thời gian chờ, vui lòng thử lại'
            };
            showToast(msgs[err.code] || 'Không thể lấy vị trí', 'red');
            btn.textContent = '📍 Vị trí của tôi';
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// ─── 5. ML PREDICTION API ────────────────────────────────────
async function getPrediction(parkingId) {
    try {
        const res = await fetch(`http://localhost:8080/api/parking/predict/${parkingId}`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return { full_probability: 0, recommendation: 'Chưa có đủ dữ liệu lịch sử' };
    }
}

// ─── 6. LOAD MARKERS ─────────────────────────────────────────
let allMarkers = [];

function loadUserMarkers() {
    const showOnlyAvailable = document.getElementById('filterAvailable').checked;
    allMarkers.forEach(m => m.remove());
    allMarkers = [];

    fetch('http://localhost:8080/api/parking/all')
        .then(res => res.json())
        .then(parkings => {
            parkings.forEach(async park => {
                if (showOnlyAvailable && park.status !== 'available') return;

                const isAvail = park.status === 'available';
                const color = isAvail ? '#10B981' : '#EF4444';

                const pred = await getPrediction(park.id);
                const probPercent = Math.round(pred.full_probability * 100);
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${park.latitude},${park.longitude}`;

                const popupHTML = `
                <div class="pk-popup-header">
                    <h4>${park.name}</h4>
                    <div class="pk-status ${isAvail ? 'pk-available' : 'pk-full'}">
                        ${isAvail ? 'Còn chỗ' : 'Hết chỗ'}
                    </div>
                </div>
                <div class="pk-popup-body">
                    <div class="pk-pred">🔮 Dự báo 30p tới: ${probPercent}% đầy</div>
                    <div class="pk-rec">${pred.recommendation}</div>
                    <div class="pk-actions">
                        <button class="pk-btn-dir" onclick="window.open('${googleMapsUrl}','_blank')">🗺️ Chỉ đường</button>
                        ${isAvail
                        ? `<button class="pk-btn-book" onclick="openBookingModal(${park.id},'${park.name.replace(/'/g, "\\'")}')">💳 Đặt & Thanh toán</button>`
                        : `<div class="pk-btn-disabled">❌ Hết chỗ</div>`
                    }
                    </div>
                </div>`;

                const marker = new mapboxgl.Marker({ color })
                    .setLngLat([park.longitude, park.latitude])
                    .setPopup(new mapboxgl.Popup({ offset: 12, maxWidth: '260px' }).setHTML(popupHTML))
                    .addTo(map);

                allMarkers.push(marker);
            });
        })
        .catch(err => { console.error(err); showToast('Không thể tải dữ liệu bãi xe', 'red'); });
}

// ─── 7. BOOKING MODAL ────────────────────────────────────────
let bookingParkId = null;
let bookingDuration = 1;
const PRICE_PER_HOUR = 20000;

function changeDuration(delta) {
    bookingDuration = Math.max(1, Math.min(24, bookingDuration + delta));
    const el = document.getElementById('durValue');
    el.style.transform = 'scale(1.3)';
    el.style.opacity = '0.5';
    setTimeout(() => {
        el.textContent = bookingDuration;
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
    }, 120);
    updateAmountDisplay();
}

function updateAmountDisplay() {
    const total = bookingDuration * PRICE_PER_HOUR;
    document.getElementById('totalAmount').textContent = total.toLocaleString('vi-VN') + ' VNĐ';
}

function openBookingModal(parkId, parkName) {
    bookingParkId = parkId;
    bookingDuration = 1;
    document.getElementById('durValue').textContent = '1';
    updateAmountDisplay();
    document.getElementById('modalParkName').textContent = parkName;
    document.getElementById('modalParkId').textContent = '#' + parkId;
    document.getElementById('modalUserName').value = CURRENT_USER !== 'Khách' ? CURRENT_USER : '';
    document.getElementById('modalPhone').value = '';
    document.getElementById('modalErr').classList.remove('show');
    document.getElementById('bookingModal').classList.add('show');
    setTimeout(() => document.getElementById('modalUserName').focus(), 300);
    allMarkers.forEach(m => { if (m.getPopup && m.getPopup().isOpen()) m.getPopup().remove(); });
}

function closeModal() {
    document.getElementById('bookingModal').classList.remove('show');
    bookingParkId = null;
}

// Close booking modal on overlay click
document.getElementById('bookingModal').addEventListener('click', e => {
    if (e.target === document.getElementById('bookingModal')) closeModal();
});

// Validate & move to payment step
function goToPayment() {
    const name = document.getElementById('modalUserName').value.trim();
    if (!name) {
        document.getElementById('modalErr').classList.add('show');
        document.getElementById('modalUserName').focus();
        return;
    }
    document.getElementById('modalErr').classList.remove('show');
    openPaymentModal();
}

// ─── 8. PAYMENT MODAL ────────────────────────────────────────
let selectedPayMethod = 'vnpay-qr';

function openPaymentModal() {
    const parkName = document.getElementById('modalParkName').textContent;
    const total = bookingDuration * PRICE_PER_HOUR;
    const totalStr = total.toLocaleString('vi-VN') + ' VNĐ';

    document.getElementById('paySubtitle').textContent = `${parkName} · ${bookingDuration} giờ`;
    document.getElementById('payAmountDisplay').textContent = totalStr;
    document.getElementById('payAmountDesc').textContent =
        `${PRICE_PER_HOUR.toLocaleString('vi-VN')} VNĐ × ${bookingDuration} giờ`;
    document.getElementById('payFooterAmount').textContent = totalStr;

    // Reset selection
    selectedPayMethod = 'vnpay-qr';
    document.querySelectorAll('.pay-method-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('method-vnpay-qr').classList.add('selected');
    updatePayButton();

    document.getElementById('paymentModal').classList.add('show');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('show');
}

function backToBooking() {
    closePaymentModal();
    document.getElementById('bookingModal').classList.add('show');
}

document.getElementById('paymentModal').addEventListener('click', e => {
    if (e.target === document.getElementById('paymentModal')) closePaymentModal();
});

function selectMethod(method) {
    selectedPayMethod = method;
    document.querySelectorAll('.pay-method-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('method-' + method).classList.add('selected');

    // Show test card info for VNPay methods
    const isVnpay = method.startsWith('vnpay');
    document.getElementById('vnpayTestInfo').classList.toggle('show', isVnpay);
    document.getElementById('vnpaySecurityInfo').style.display = isVnpay ? 'flex' : 'none';
    updatePayButton();
}

function updatePayButton() {
    const btn = document.getElementById('paySubmitBtn');
    const btnText = document.getElementById('payBtnText');
    if (selectedPayMethod === 'cash') {
        btn.classList.add('cash-mode');
        btnText.textContent = '✅ Đặt chỗ – Trả tiền mặt';
    } else {
        btn.classList.remove('cash-mode');
        btnText.textContent = '💳 Thanh toán qua VNPay';
    }
}

// ─── 9. PROCESS PAYMENT ──────────────────────────────────────
async function processPayment() {
    const name = document.getElementById('modalUserName').value.trim();
    const phone = document.getElementById('modalPhone').value.trim();
    const total = bookingDuration * PRICE_PER_HOUR;

    const btn = document.getElementById('paySubmitBtn');
    btn.classList.add('loading');

    if (selectedPayMethod === 'cash') {
        // ── CASH: call booking API directly ──
        try {
            const url = `http://localhost:8080/api/booking/create/${bookingParkId}?userName=${encodeURIComponent(name)}${phone ? '&phone=' + encodeURIComponent(phone) : ''}&duration=${bookingDuration}`;
            const res = await fetch(url, { method: 'POST' });
            const msg = await res.text();
            closePaymentModal();
            showToast('🎉 Đặt chỗ thành công! Vui lòng thanh toán tại quầy.', 'green');
            loadUserMarkers();
            loadHistory();
        } catch {
            showToast('Lỗi kết nối máy chủ', 'red');
        } finally {
            btn.classList.remove('loading');
        }
        return;
    }

    // ── VNPay: try backend first, fallback to sandbox demo ──
    btn.classList.remove('loading');
    closePaymentModal();
    showProcessing();

    // Try backend VNPay endpoint
    try {
        const payload = {
            parkingLotId: bookingParkId,
            userName: name,
            phone: phone || '',
            duration: bookingDuration,
            amount: total,
            orderInfo: `Dat cho bai xe #${bookingParkId} - ${name} - ${bookingDuration} gio`,
            returnUrl: window.location.origin + window.location.pathname.replace('user.html', '') + 'payment-return.html'
        };

        const res = await fetch('http://localhost:8080/api/payment/vnpay/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.paymentUrl) {
                // Save pending booking info
                sessionStorage.setItem('pendingBooking', JSON.stringify({
                    parkId: bookingParkId,
                    parkName: document.getElementById('modalParkName').textContent,
                    name, phone, duration: bookingDuration, total
                }));
                window.location.href = data.paymentUrl;
                return;
            }
        }
    } catch (e) {
        // Backend not available – use sandbox demo
    }

    // Fallback: redirect to VNPay sandbox demo
    hideProcessing();
    launchVNPaySandbox(name, total);
}

function launchVNPaySandbox(name, total) {
    // Save pending booking info for return page
    sessionStorage.setItem('pendingBooking', JSON.stringify({
        parkId: bookingParkId,
        parkName: document.getElementById('modalParkName').textContent,
        name,
        phone: document.getElementById('modalPhone').value.trim(),
        duration: bookingDuration,
        total,
        method: selectedPayMethod,
        txnRef: 'PKF' + Date.now()
    }));

    const returnUrl = encodeURIComponent(
        window.location.origin +
        window.location.pathname.replace('user.html', '') +
        'payment-return.html?demo=1'
    );

    // Open VNPay sandbox demo in current tab
    const vnpayDemoUrl = `http://sandbox.vnpayment.vn/tryitnow/Home/CreateOrder`;
    showToast('Đang chuyển đến cổng VNPay...', 'green');

    setTimeout(() => {
        window.open(vnpayDemoUrl, '_blank');
        hideProcessing();
        // Also show local payment-return in demo mode after short delay
        setTimeout(() => {
            window.location.href = 'payment-return.html?demo=1&vnp_ResponseCode=00&vnp_TxnRef=PKF' + Date.now();
        }, 1500);
    }, 1800);
}

function showProcessing() {
    const overlay = document.getElementById('processingOverlay');
    overlay.classList.add('show');
    // Reset progress bar animation
    const bar = overlay.querySelector('.pp-bar');
    bar.style.animation = 'none';
    bar.offsetHeight; // reflow
    bar.style.animation = '';
}

function hideProcessing() {
    document.getElementById('processingOverlay').classList.remove('show');
}

// ─── 10. HISTORY SIDEBAR ─────────────────────────────────────
function toggleHistory() {
    const sidebar = document.getElementById('historySidebar');
    const overlay = document.getElementById('historyOverlay');
    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    overlay.classList.toggle('show', !isOpen);
    if (!isOpen) loadHistory();
}

function loadHistory() {
    const userName = sessionStorage.getItem('userName');
    if (!userName) return;

    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="history-empty">Đang tải...</div>';

    fetch(`http://localhost:8080/api/booking/history?userName=${encodeURIComponent(userName)}`)
        .then(res => res.json())
        .then(data => {
            if (!data.length) {
                list.innerHTML = '<div class="history-empty">🅿️ Chưa có lịch sử đặt chỗ nào</div>';
                return;
            }
            list.innerHTML = data.map((item, i) => `
            <div class="history-item" style="animation-delay:${i * 0.05}s">
                <div class="history-lot">🅿️ ${item.parkingLotName || 'Bãi xe #' + item.parkingLotId}</div>
                <div class="history-time">🕐 ${item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</div>
                <span class="history-price">💰 ${item.totalPrice ? item.totalPrice.toLocaleString('vi-VN') + ' VNĐ' : '20.000 VNĐ'}</span>
            </div>`).join('');
        })
        .catch(() => {
            list.innerHTML = '<div class="history-empty">Không thể tải lịch sử</div>';
        });
}

// ─── 11. TOAST ──────────────────────────────────────────────
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── 12. INIT ────────────────────────────────────────────────
map.on('load', () => {
    loadUserMarkers();
    setInterval(loadUserMarkers, 30000);
    setInterval(updateViewportStats, 5000);
    map.on('moveend', updateViewportStats);
});

// ─── 13. RADIUS FILTER ───────────────────────────────────────
let currentRadius = 0;
let userLatLng = null;

function setRadius(r) {
    currentRadius = r;
    document.querySelectorAll('.rbtn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.r) === r);
    });
    loadUserMarkers();
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Patch loadUserMarkers to support radius filter
const _origLoadUserMarkers = loadUserMarkers;
// Override in place below

// ─── 14. FIND NEAREST ───────────────────────────────────────
function findNearest() {
    if (!navigator.geolocation) { showToast('Trình duyệt không hỗ trợ định vị', 'red'); return; }
    const btn = document.getElementById('btnNearest');
    btn.textContent = '⏳ Đang tìm...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(pos => {
        const { longitude: lng, latitude: lat } = pos.coords;
        userLatLng = { lat, lng };

        fetch('http://localhost:8080/api/parking/all')
            .then(r => r.json())
            .then(lots => {
                const available = lots.filter(p => p.status === 'available');
                if (!available.length) { showToast('Không có bãi xe nào còn chỗ', 'red'); return; }
                let nearest = null, minDist = Infinity;
                available.forEach(p => {
                    const d = getDistanceKm(lat, lng, p.latitude, p.longitude);
                    if (d < minDist) { minDist = d; nearest = p; }
                });
                if (nearest) {
                    map.flyTo({ center: [nearest.longitude, nearest.latitude], zoom: 17, speed: 1.6 });
                    showToast(`🎯 Bãi gần nhất: ${nearest.name} (${(minDist*1000).toFixed(0)}m)`, 'green');
                    allMarkers.forEach(m => {
                        if (m._parkId === nearest.id) {
                            setTimeout(() => m.getPopup() && m.togglePopup(), 800);
                        }
                    });
                }
            })
            .catch(() => showToast('Không thể tải dữ liệu', 'red'))
            .finally(() => { btn.textContent = '🎯 Gần nhất'; btn.disabled = false; });
    }, () => { showToast('Không thể lấy vị trí', 'red'); btn.textContent = '🎯 Gần nhất'; btn.disabled = false; });
}

// ─── 15. FAVORITES ───────────────────────────────────────────
function getFavorites() {
    try { return JSON.parse(localStorage.getItem('pkf_favorites') || '[]'); } catch { return []; }
}
function saveFavorites(favs) {
    localStorage.setItem('pkf_favorites', JSON.stringify(favs));
    const hasFavs = favs.length > 0;
    document.getElementById('btnFavorites').classList.toggle('has-favs', hasFavs);
}
function isFavorite(id) { return getFavorites().some(f => f.id === id); }

function toggleFavorite(park) {
    let favs = getFavorites();
    if (isFavorite(park.id)) {
        favs = favs.filter(f => f.id !== park.id);
        showToast('Đã xóa khỏi yêu thích', '');
    } else {
        favs.push({ id: park.id, name: park.name, latitude: park.latitude, longitude: park.longitude, status: park.status });
        showToast('⭐ Đã thêm vào yêu thích!', 'green');
    }
    saveFavorites(favs);
    updateFavBtns(park.id);
}

function updateFavBtns(id) {
    const fav = isFavorite(id);
    document.querySelectorAll(`.pk-btn-fav[data-id="${id}"]`).forEach(b => {
        b.classList.toggle('is-fav', fav);
        b.title = fav ? 'Bỏ yêu thích' : 'Thêm yêu thích';
        b.textContent = fav ? '⭐' : '☆';
    });
    const mfb = document.getElementById('modalFavBtn');
    if (mfb && bookingParkId === id) {
        mfb.classList.toggle('is-fav', fav);
        document.getElementById('modalFavIcon').textContent = fav ? '⭐' : '☆';
        mfb.childNodes[1].textContent = fav ? ' Đã yêu thích' : ' Thêm vào yêu thích';
    }
}

function toggleFavorites() {
    const sb = document.getElementById('favoritesSidebar');
    const ov = document.getElementById('favoritesOverlay');
    const isOpen = sb.classList.contains('open');
    sb.classList.toggle('open', !isOpen);
    ov.classList.toggle('show', !isOpen);
    if (!isOpen) renderFavorites();
}

function renderFavorites() {
    const favs = getFavorites();
    const list = document.getElementById('favoritesList');
    if (!favs.length) { list.innerHTML = '<div class="history-empty">⭐ Chưa có bãi xe yêu thích</div>'; return; }
    list.innerHTML = favs.map((f, i) => `
    <div class="fav-item" style="animation-delay:${i*0.05}s">
        <div class="fav-icon">🅿️</div>
        <div class="fav-info">
            <div class="fav-name">${f.name}</div>
            <div class="fav-status ${f.status === 'available' ? 'available' : 'full'}">
                ${f.status === 'available' ? '✅ Còn chỗ' : '❌ Hết chỗ'}
            </div>
        </div>
        <div class="fav-actions">
            <button class="fav-btn-go" onclick="flyToFav(${f.longitude},${f.latitude},'${f.name.replace(/'/g,"\\'")}')">🗺️ Đến</button>
            <button class="fav-btn-remove" onclick="removeFav(${f.id})">🗑️ Xóa</button>
        </div>
    </div>`).join('');
}

function flyToFav(lng, lat, name) {
    toggleFavorites();
    map.flyTo({ center: [lng, lat], zoom: 17, speed: 1.5 });
    showToast(`📍 Đang đến ${name}`, 'green');
}
function removeFav(id) {
    saveFavorites(getFavorites().filter(f => f.id !== id));
    renderFavorites();
    updateFavBtns(id);
}

function toggleFavoriteFromModal() {
    if (!bookingParkId) return;
    const park = allParkings.find(p => p.id === bookingParkId);
    if (park) toggleFavorite(park);
}

// ─── 16. COMPARE ─────────────────────────────────────────────
let compareList = [];

function addToCompare(park) {
    if (compareList.find(p => p.id === park.id)) {
        compareList = compareList.filter(p => p.id !== park.id);
        showToast('Đã xóa khỏi so sánh', '');
    } else if (compareList.length >= 3) {
        showToast('Chỉ so sánh tối đa 3 bãi xe', 'red'); return;
    } else {
        compareList.push(park);
        showToast(`➕ Đã thêm "${park.name}" vào so sánh`, 'green');
    }
    updateCompareUI();
}

function updateCompareUI() {
    const n = compareList.length;
    document.getElementById('compareCount').textContent = `So sánh: ${n}/3`;
    const btn = document.getElementById('btnCompare');
    btn.disabled = n < 2;
    document.getElementById('btnClearCompare').style.display = n > 0 ? 'inline-block' : 'none';
    document.querySelectorAll('.pk-btn-compare').forEach(b => {
        const id = parseInt(b.dataset.id);
        b.classList.toggle('in-compare', compareList.some(p => p.id === id));
    });
}

function clearCompare() { compareList = []; updateCompareUI(); }

function openCompare() {
    if (compareList.length < 2) return;
    const drawer = document.getElementById('compareDrawer');
    const ov = document.getElementById('compareOverlay');
    drawer.classList.add('open');
    ov.classList.add('show');
    renderCompare();
}
function closeCompare() {
    document.getElementById('compareDrawer').classList.remove('open');
    document.getElementById('compareOverlay').classList.remove('show');
}

function renderCompare() {
    const colors = ['#2563EB','#10B981','#F97316'];
    document.getElementById('compareContent').innerHTML = compareList.map((p, i) => {
        let dist = '—';
        if (userLatLng) {
            const d = getDistanceKm(userLatLng.lat, userLatLng.lng, p.latitude, p.longitude);
            dist = d < 1 ? `${(d*1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
        }
        const pred = p._pred || {};
        const probPct = Math.round((pred.full_probability || 0) * 100);
        const isAvail = p.status === 'available';
        return `<div class="compare-card">
            <div class="cc-name"><span class="compare-pick-indicator" style="background:${colors[i]}"></span>${p.name}</div>
            <div class="cc-row"><span class="cc-key">Trạng thái</span><span class="cc-val ${isAvail?'green':'red'}">${isAvail?'✅ Còn chỗ':'❌ Hết chỗ'}</span></div>
            <div class="cc-row"><span class="cc-key">Khoảng cách</span><span class="cc-val orange">${dist}</span></div>
            <div class="cc-row"><span class="cc-key">Giá/giờ</span><span class="cc-val">20.000 VNĐ</span></div>
            <div class="cc-row"><span class="cc-key">AI dự báo đầy</span><span class="cc-val ${probPct>70?'red':probPct>40?'orange':'green'}">${probPct}%</span></div>
            <div class="cc-row"><span class="cc-key">Tọa độ</span><span class="cc-val" style="font-size:11px">${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</span></div>
        </div>`;
    }).join('');
}

// ─── 17. SHARE ───────────────────────────────────────────────
function shareParking() {
    if (!bookingParkId) return;
    const park = allParkings.find(p => p.id === bookingParkId);
    if (!park) return;
    const url = `https://www.google.com/maps?q=${park.latitude},${park.longitude}`;
    const text = `🅿️ ${park.name}\n📍 ${url}`;
    if (navigator.share) {
        navigator.share({ title: park.name, text: `ParkFinder – ${park.name}`, url });
    } else {
        navigator.clipboard.writeText(text).then(() => showToast('📋 Đã copy link chia sẻ!', 'green'));
    }
}

// ─── 18. VIEWPORT STATS ──────────────────────────────────────
function updateViewportStats() {
    if (!map || !allParkings.length) return;
    const bounds = map.getBounds();
    let avail = 0, full = 0;
    allParkings.forEach(p => {
        if (bounds.contains([p.longitude, p.latitude])) {
            p.status === 'available' ? avail++ : full++;
        }
    });
    document.getElementById('vsAvail').textContent = avail;
    document.getElementById('vsFull').textContent = full;
}

// ─── 19. HEATMAP ─────────────────────────────────────────────
function toggleHeatmapLayer() {
    const on = document.getElementById('toggleHeatmap').checked;
    if (on) {
        if (!map.getSource('heatmap-src')) {
            const features = allParkings.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: { weight: p.status === 'full' ? 1 : 0.4 }
            }));
            map.addSource('heatmap-src', { type: 'geojson', data: { type: 'FeatureCollection', features } });
            map.addLayer({
                id: 'heatmap-layer', type: 'heatmap', source: 'heatmap-src',
                paint: {
                    'heatmap-weight': ['get','weight'],
                    'heatmap-intensity': 1.2,
                    'heatmap-color': ['interpolate',['linear'],['heatmap-density'],
                        0,'rgba(16,185,129,0)', 0.3,'rgba(16,185,129,0.5)', 0.7,'rgba(249,115,22,0.8)', 1,'rgba(239,68,68,1)'],
                    'heatmap-radius': 40,
                    'heatmap-opacity': 0.75
                }
            });
        } else {
            map.setLayoutProperty('heatmap-layer', 'visibility', 'visible');
        }
        showToast('🔥 Heatmap đã bật', 'green');
    } else {
        if (map.getLayer('heatmap-layer')) map.setLayoutProperty('heatmap-layer', 'visibility', 'none');
        showToast('Heatmap đã tắt', '');
    }
}

// ─── 20. PATCH loadUserMarkers (radius + store allParkings) ──
let allParkings = [];

function loadUserMarkers() {
    const showOnlyAvailable = document.getElementById('filterAvailable').checked;
    allMarkers.forEach(m => m.remove());
    allMarkers = [];

    fetch('http://localhost:8080/api/parking/all')
        .then(res => res.json())
        .then(parkings => {
            allParkings = parkings;
            updateViewportStats();
            saveFavorites(getFavorites().map(f => {
                const live = parkings.find(p => p.id === f.id);
                return live ? { ...f, status: live.status } : f;
            }));

            parkings.forEach(async park => {
                if (showOnlyAvailable && park.status !== 'available') return;
                if (currentRadius > 0 && userLatLng) {
                    const d = getDistanceKm(userLatLng.lat, userLatLng.lng, park.latitude, park.longitude);
                    if (d * 1000 > currentRadius) return;
                }

                const isAvail = park.status === 'available';
                const color = isAvail ? '#10B981' : '#EF4444';
                const pred = await getPrediction(park.id);
                park._pred = pred;
                const probPercent = Math.round(pred.full_probability * 100);
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${park.latitude},${park.longitude}`;
                const fav = isFavorite(park.id);
                const inCmp = compareList.some(p => p.id === park.id);

                const popupHTML = `
                <div class="pk-popup-header">
                    <h4>${park.name}</h4>
                    <div class="pk-status ${isAvail ? 'pk-available' : 'pk-full'}">${isAvail ? 'Còn chỗ' : 'Hết chỗ'}</div>
                </div>
                <div class="pk-popup-body">
                    <div class="pk-pred">🔮 Dự báo 30p tới: ${probPercent}% đầy</div>
                    <div class="pk-rec">${pred.recommendation}</div>
                    <div class="pk-actions">
                        <button class="pk-btn-dir" onclick="window.open('${googleMapsUrl}','_blank')">🗺️ Chỉ đường</button>
                        <button class="pk-btn-fav ${fav?'is-fav':''}" data-id="${park.id}" onclick="toggleFavorite({id:${park.id},name:'${park.name.replace(/'/g,"\\'")}',latitude:${park.latitude},longitude:${park.longitude},status:'${park.status}'})" title="${fav?'Bỏ yêu thích':'Thêm yêu thích'}">${fav?'⭐':'☆'}</button>
                        <button class="pk-btn-compare ${inCmp?'in-compare':''}" data-id="${park.id}" onclick="addToCompare({id:${park.id},name:'${park.name.replace(/'/g,"\\'")}',latitude:${park.latitude},longitude:${park.longitude},status:'${park.status}',_pred:${JSON.stringify(pred)}})">⚖️</button>
                        ${isAvail
                            ? `<button class="pk-btn-book" onclick="openBookingModal(${park.id},'${park.name.replace(/'/g,"\\'")}')">💳 Đặt</button>`
                            : `<div class="pk-btn-disabled">❌ Hết</div>`
                        }
                    </div>
                </div>`;

                const marker = new mapboxgl.Marker({ color })
                    .setLngLat([park.longitude, park.latitude])
                    .setPopup(new mapboxgl.Popup({ offset: 12, maxWidth: '280px' }).setHTML(popupHTML))
                    .addTo(map);

                marker._parkId = park.id;
                allMarkers.push(marker);
            });
            // Update heatmap source if active
            if (map.getSource('heatmap-src')) {
                const features = parkings.map(p => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                    properties: { weight: p.status === 'full' ? 1 : 0.4 }
                }));
                map.getSource('heatmap-src').setData({ type: 'FeatureCollection', features });
            }
        })
        .catch(err => { console.error(err); showToast('Không thể tải dữ liệu bãi xe', 'red'); });
}

// Init favorites badge
(function initFavBadge() {
    const favs = getFavorites();
    if (favs.length) document.getElementById('btnFavorites').classList.add('has-favs');
    document.querySelectorAll('.rbtn')[0]?.classList.add('active');
})();
