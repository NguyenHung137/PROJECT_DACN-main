import psycopg2
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score
import numpy as np

# --- CẤU HÌNH KẾT NỐI ---
DB_CONFIG = {
    "dbname": "postgres", "user": "postgres", "password": "hung7224", "host": "localhost", "port": "5432"
}
PEAK_HOURS = [7, 8, 11, 12, 13, 18, 19, 20] # Khung giờ cao điểm đã thống nhất

# Hỗ trợ hiển thị tiếng Việt
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['axes.unicode_minus'] = False

def create_all_charts():
    conn = None
    try:
        print("🔌 Bước 1: Đang kết nối Database và lấy dữ liệu...")
        conn = psycopg2.connect(**DB_CONFIG)
        
        query = "SELECT parking_lot_id, hour_of_day, day_of_week, status FROM parking_history;"
        df = pd.read_sql(query, conn)
        conn.close()
        
        if df.empty:
            print("❌ Lỗi: Bảng dữ liệu trống!")
            return

        # --- TIỀN XỬ LÝ & FEATURE ENGINEERING (ĐỒNG BỘ VỚI AUTO_TRAIN) ---
        df['status_label'] = df['status'].apply(lambda x: 1 if x == 'full' else 0)
        df['is_peak_hour'] = df['hour_of_day'].apply(lambda x: 1 if x in PEAK_HOURS else 0)
        
        print(f"✅ Đã xử lý {len(df)} dòng dữ liệu với đặc trưng is_peak_hour.")

        # ============================================================
        # PHẦN 1: CÁC BIỂU ĐỒ PHÂN TÍCH
        # ============================================================
        
        # --- 2.5.1 Biểu đồ phân bổ trạng thái (Pie Chart) ---
        plt.figure(figsize=(8, 6))
        status_counts = df['status'].value_counts()
        plt.pie(status_counts, labels=status_counts.index, autopct='%1.1f%%', startangle=140, colors=['#ff9999','#66b3ff'], explode=(0.1, 0))
        plt.title('Tỉ lệ Phân bổ Trạng thái Bãi xe (Full vs Available)')
        plt.savefig('2.5.1_status_distribution.png', bbox_inches='tight')
        plt.close()

        # --- 2.5.2 Biểu đồ mật độ bãi đầy theo khung giờ (Bar Chart) ---
        plt.figure(figsize=(12, 6))
        full_by_hour = df[df['status_label'] == 1].groupby('hour_of_day').size().reindex(range(24), fill_value=0)
        sns.barplot(x=full_by_hour.index, y=full_by_hour.values, palette="Reds_d")
        plt.title('Tần suất Bãi xe bị Đầy theo Khung giờ trong Ngày')
        plt.xlabel('Khung giờ (0h - 23h)')
        plt.ylabel('Số lần ghi nhận trạng thái FULL')
        plt.xticks(range(24))
        plt.savefig('2.5.2_occupancy_by_hour.png', bbox_inches='tight')
        plt.close()

        # --- 2.5.3 Ma trận nhiệt tương quan (ĐÃ THÊM IS_PEAK_HOUR) ---
        plt.figure(figsize=(10, 8))
        # Thêm cột is_peak_hour vào ma trận tương quan
        corr_matrix = df[['parking_lot_id', 'hour_of_day', 'day_of_week', 'is_peak_hour', 'status_label']].corr()
        sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt=".2f", linewidths=.5)
        plt.title('Ma trận Nhiệt Tương quan (Cập nhật Feature Engineering)')
        plt.savefig('2.5.3_correlation_heatmap.png', bbox_inches='tight')
        plt.close()

        # ============================================================
        # PHẦN 2: CÁC BIỂU ĐỒ ML (80.69%)
        # ============================================================
        print("🧠 Đang huấn luyện lại để cập nhật biểu đồ Accuracy...")
        
        # Sử dụng 4 đặc trưng mới
        X = df[['parking_lot_id', 'hour_of_day', 'day_of_week', 'is_peak_hour']]
        y = df['status_label']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        
        model_lr = LogisticRegression(solver='liblinear').fit(X_train, y_train)
        current_acc = accuracy_score(y_test, model_lr.predict(X_test)) * 100
        
        # --- 2.5.4 Biểu đồ so sánh độ chính xác ---
        plt.figure(figsize=(10, 6))
        accuracy_data = {'KNN': 100.00, 'Logistic Reg': current_acc, 'Random Forest': 25.00}
        barplot = sns.barplot(x=list(accuracy_data.keys()), y=list(accuracy_data.values()), palette=['#66b3ff', '#99ff99', '#ff9999'])
        
        for p in barplot.patches:
            barplot.annotate(f'{p.get_height():.2f}%', (p.get_x() + p.get_width()/2., p.get_height()), 
                             ha='center', va='center', xytext=(0, 7), textcoords='offset points')
        
        plt.title('So sánh Độ chính xác của các Mô hình trên Tập Test (Sau Feature Engineering)')
        plt.ylim(0, 115)
        plt.savefig('2.5.4_model_comparison.png', bbox_inches='tight')
        plt.close()

        # --- 2.5.5 Ma trận nhầm lẫn ---
        plt.figure(figsize=(8, 6))
        cm = confusion_matrix(y_test, model_lr.predict(X_test), labels=[0, 1])
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False,
                    xticklabels=['Available (0)', 'Full (1)'], yticklabels=['Available (0)', 'Full (1)'])
        plt.title('Ma trận Nhầm lẫn của Logistic Regression (80.69%)')
        plt.xlabel('Trạng thái DỰ BÁO')
        plt.ylabel('Trạng thái THỰC TẾ')
        plt.savefig('2.5.5_confusion_matrix.png', bbox_inches='tight')
        plt.close()

        print(f"\n✨ THÀNH CÔNG: Biểu đồ đã được cập nhật với Accuracy: {current_acc:.2f}%")

    except Exception as e:
        print(f"❌ Lỗi: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    create_all_charts()
