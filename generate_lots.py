import psycopg2
import random

# Tọa độ trung tâm Thủ Dầu Một (TDMU)
CENTER_LAT = 10.9830
CENTER_LON = 106.6740

DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}

def generate_mass_lots(number_of_lots=50):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        for i in range(1, number_of_lots + 1):
            name = f"Bãi xe vệ tinh số {i:03d}"
            # Tạo tọa độ ngẫu nhiên trong bán kính ~2km quanh TDMU
            lat = CENTER_LAT + random.uniform(-0.015, 0.015)
            lon = CENTER_LON + random.uniform(-0.015, 0.015)
            status = random.choice(['available', 'full'])
            
            cur.execute(
                "INSERT INTO parking_lots (name, latitude, longitude, status) VALUES (%s, %s, %s, %s)",
                (name, lat, lon, status)
            )
            
        conn.commit()
        print(f"✅ Đã tạo thành công {number_of_lots} bãi xe tại Bình Dương!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    generate_mass_lots(200) # Bạn có thể đổi thành 100 hoặc 200 tùy ý