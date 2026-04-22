import matplotlib.pyplot as plt

# --- DỮ LIỆU ĐÃ CẬP NHẬT ---
models = ['KNN', 'Logistic Reg', 'Decision Tree', 'Random Forest']

# Hùng thay số liệu Decision Tree vào đây (ví dụ 79.50)
dt_acc = 79.50 
accuracies = [100.00, 80.69, dt_acc, 25.00]

# --- VẼ BIỂU ĐỒ ---
plt.figure(figsize=(10, 6))
colors = ['#64b5f6', '#81c784', '#ffb74d', '#ef9a9a'] # Màu xanh dương, xanh lá, cam, đỏ nhạt

bars = plt.bar(models, accuracies, color=colors)

# Thêm tiêu đề và nhãn
plt.title('So sánh Độ chính xác của các Mô hình (Sau Feature Engineering)', fontsize=14, fontweight='bold', pad=20)
plt.ylabel('Độ chính xác (Accuracy %)', fontsize=12)
plt.ylim(0, 115) # Tạo khoảng trống phía trên để ghi số %

# Hiển thị con số % trên đầu mỗi cột
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 1, f'{yval:.2f}%', ha='center', va='bottom', fontweight='bold')

plt.grid(axis='y', linestyle='--', alpha=0.7)

# Lưu file ảnh để dán vào Word
plt.tight_layout()
plt.savefig('2.5.4_model_comparison_updated.png', dpi=300)
print("✅ Đã tạo file: 2.5.4_model_comparison_updated.png thành công!")
plt.show()