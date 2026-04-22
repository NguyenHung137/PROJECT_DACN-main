import psycopg2
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# Thông tin Database của Hùng
DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}

print("🌲 ĐANG CHẠY THUẬT TOÁN: RỪNG NGẪU NHIÊN (RANDOM FOREST)...")
conn = psycopg2.connect(**DB_CONFIG)
df = pd.read_sql("SELECT parking_lot_id, hour_of_day, day_of_week, CASE WHEN status = 'full' THEN 1 ELSE 0 END as status_label FROM parking_history;", conn)
conn.close()

X = df[['parking_lot_id', 'hour_of_day', 'day_of_week']]
y = df['status_label']

# Chia dữ liệu để kiểm tra độ chính xác
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(f"✅ Độ chính xác của Random Forest: {accuracy_score(y_test, y_pred) * 100:.2f}%")