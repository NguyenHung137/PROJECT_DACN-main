import psycopg2
import random
from datetime import datetime, timedelta

# --- CẤU HÌNH DATABASE ---
DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}

def generate_smart_history(days_back=14):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # 1. Lấy tất cả ID bãi xe đang có trong hệ thống
        cur.execute("SELECT id FROM parking_lots")
        lot_ids = [row[0] for row in cur.fetchall()]
        
        if not lot_ids:
            print("❌ Không tìm thấy bãi xe nào. Hãy chạy script thêm bãi xe trước!")
            return

        print(f"🔄 Đang tạo dữ liệu cho {len(lot_ids)} bãi xe trong {days_back} ngày qua...")

        # Xóa bớt lịch sử cũ nếu muốn làm lại từ đầu (tùy chọn)
        # cur.execute("TRUNCATE TABLE parking_history CASCADE")

        # 2. Định nghĩa các khung giờ "nóng" (Peak Hours)
        peak_hours = [7, 8, 11, 12, 13, 18, 19, 20]

        records_count = 0
        now = datetime.now()

        for day in range(days_back):
            current_date = now - timedelta(days=day)
            day_of_week = current_date.weekday() # 0: Thứ 2, 6: Chủ nhật (PostgreSQL có thể lệch 1 chút nhưng ko sao)

            for lot_id in lot_ids:
                # Mỗi bãi xe tạo khoảng 5-8 bản ghi mỗi ngày để tránh làm nặng DB quá mức
                sample_hours = random.sample(range(24), 8) 
                
                for hour in sample_hours:
                    # LOGIC THÔNG MINH: 
                    # Nếu rơi vào khung giờ cao điểm, tỉ lệ 'full' là 80%
                    # Nếu giờ bình thường, tỉ lệ 'full' chỉ 20%
                    if hour in peak_hours:
                        status = 'full' if random.random() < 0.8 else 'available'
                    else:
                        status = 'full' if random.random() < 0.2 else 'available'

                    cur.execute(
                        """INSERT INTO parking_history (parking_lot_id, status, day_of_week, hour_of_day, recorded_at) 
                           VALUES (%s, %s, %s, %s, %s)""",
                        (lot_id, status, day_of_week, hour, current_date.replace(hour=hour))
                    )
                    records_count += 1

        conn.commit()
        print(f"✅ THÀNH CÔNG: Đã nạp {records_count} dòng lịch sử vào bảng parking_history!")
        
        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    generate_smart_history(14) # Tạo dữ liệu cho 2 tuần gần nhất