import psycopg2
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType

# --- CẤU HÌNH ---
DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}
PEAK_HOURS = [7, 8, 11, 12, 13, 18, 19, 20] # Khung giờ cao điểm

def train_and_export():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        query = "SELECT parking_lot_id, hour_of_day, day_of_week, status FROM parking_history;"
        df = pd.read_sql(query, conn)
        conn.close()

        if df.empty:
            print("❌ Dữ liệu trống!")
            return

        # 1. TIỀN XỬ LÝ & FEATURE ENGINEERING
        # Chuyển status thành nhãn số (1: full, 0: available)
        df['status_label'] = df['status'].apply(lambda x: 1 if x == 'full' else 0)
        
        # THÊM ĐẶC TRƯNG MỚI: is_peak_hour
        # Nếu khung giờ nằm trong PEAK_HOURS thì gán là 1, ngược lại là 0
        df['is_peak_hour'] = df['hour_of_day'].apply(lambda x: 1 if x in PEAK_HOURS else 0)

        # 2. CHỌN ĐẶC TRƯNG ĐỂ HUẤN LUYỆN
        # Bây giờ chúng ta có 4 đặc trưng thay vì 3
        features = ['parking_lot_id', 'hour_of_day', 'day_of_week', 'is_peak_hour']
        X = df[features].astype(np.float32)
        y = df['status_label']

        # Chia tập dữ liệu để kiểm tra độ chính xác ngay trong Python
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        # 3. HUẤN LUYỆN
        model = LogisticRegression(solver='liblinear', max_iter=1000)
        model.fit(X_train, y_train)

        # Kiểm tra độ chính xác
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred) * 100
        print(f"📊 Độ chính xác mới của Logistic Regression: {acc:.2f}%")

        # 4. XUẤT MÔ HÌNH ONNX (Dùng cho Java)
        # Lưu ý: initial_type phải khai báo 4 cột đầu vào
        initial_type = [('input', FloatTensorType([None, 4]))]
        onnx_model = to_onnx(model, X_train[:1], initial_types=initial_type, target_opset=12)

        with open("parking_model.onnx", "wb") as f:
            f.write(onnx_model.SerializeToString())

        print("✅ Đã cập nhật bộ não mới: parking_model.onnx thành công!")

    except Exception as e:
        print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    train_and_export()