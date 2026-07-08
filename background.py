import cv2
import os

video_path = "ml/assets/backgrounds_video/IMG_5093.MOV"
out_dir = "ml/assets/backgrounds"
os.makedirs(out_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)

frame_idx = 0
save_idx = 1

while True:
    ret, frame = cap.read()
    if not ret:
        break

    if frame_idx % 30 == 0:
        out_path = os.path.join(out_dir, f"bg_{save_idx:03d}.jpg")
        cv2.imwrite(out_path, frame)
        save_idx += 1

    frame_idx += 1

cap.release()
print(f"saved {save_idx - 1} images")