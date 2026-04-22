import psycopg2
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# --- CẤU HÌNH (Giữ nguyên như auto_train.py) ---
DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}
PEAK_HOURS = [7, 8, 11, 12, 13, 18, 19, 20] # Khung giờ cao điểm

def compare_models():
    try:
        # 1. KẾT NỐI VÀ LẤY DỮ LIỆU
        conn = psycopg2.connect(**DB_CONFIG)
        query = "SELECT parking_lot_id, hour_of_day, day_of_week, status FROM parking_history;"
        df = pd.read_sql(query, conn)
        conn.close()

        if df.empty:
            print("❌ Dữ liệu trống!")
            return

        # 2. TIỀN XỬ LÝ (Giữ nguyên logic của Hùng)
        df['status_label'] = df['status'].apply(lambda x: 1 if x == 'full' else 0)
        df['is_peak_hour'] = df['hour_of_day'].apply(lambda x: 1 if x in PEAK_HOURS else 0)

        # 3. CHỌN ĐẶC TRƯNG
        features = ['parking_lot_id', 'hour_of_day', 'day_of_week', 'is_peak_hour']
        X = df[features].astype(np.float32)
        y = df['status_label']

        # Chia tập dữ liệu 80/20
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        print(f"✅ Đã tải {len(df)} bản ghi.")
        print("-" * 30)

        # 4. HUẤN LUYỆN LOGISTIC REGRESSION (Mô hình hiện tại của dự án)
        model_lr = LogisticRegression(solver='liblinear', max_iter=1000)
        model_lr.fit(X_train, y_train)
        acc_lr = accuracy_score(y_test, model_lr.predict(X_test)) * 100

        # 5. HUẤN LUYỆN DECISION TREE (Mô hình đối chứng mới)
        # max_depth=5 để cây không quá phức tạp, dễ giải thích
        model_dt = DecisionTreeClassifier(max_depth=5, random_state=42)
        model_dt.fit(X_train, y_train)
        acc_dt = accuracy_score(y_test, model_dt.predict(X_test)) * 100

        # 6. IN KẾT QUẢ SO SÁNH
        print(f"📊 KẾT QUẢ SO SÁNH HIỆU NĂNG:")
        print(f"1. Logistic Regression (Dự án dùng): {acc_lr:.2f}%")
        print(f"2. Decision Tree (Đối chứng):        {acc_dt:.2f}%")
        print("-" * 30)
        
        if acc_lr >= acc_dt:
            print(f"👉 Kết luận: Logistic Regression vẫn cho độ chính xác tốt hơn hoặc tương đương.")
        else:
            print(f"👉 Kết luận: Decision Tree có độ chính xác nhỉnh hơn trên tập dữ liệu này.")

    except Exception as e:
        print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    compare_models()