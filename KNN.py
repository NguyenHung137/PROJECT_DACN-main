import psycopg2
import pandas as pd
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}

print("👥 ĐANG CHẠY THUẬT TOÁN: K-LÁNG GIỀNG GẦN NHẤT (KNN)...")
conn = psycopg2.connect(**DB_CONFIG)
df = pd.read_sql("SELECT parking_lot_id, hour_of_day, day_of_week, CASE WHEN status = 'full' THEN 1 ELSE 0 END as status_label FROM parking_history;", conn)
conn.close()

X = df[['parking_lot_id', 'hour_of_day', 'day_of_week']]
y = df['status_label']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Sử dụng 5 láng giềng gần nhất
model = KNeighborsClassifier(n_neighbors=5)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(f"✅ Độ chính xác của KNN: {accuracy_score(y_test, y_pred) * 100:.2f}%")