import cv2
import os
import numpy as np


# -------- Rule of Thirds Score --------
def rule_of_thirds_score(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)

    h, w = gray.shape

    points = [
        (int(w / 3), int(h / 3)),
        (int(2 * w / 3), int(h / 3)),
        (int(w / 3), int(2 * h / 3)),
        (int(2 * w / 3), int(2 * h / 3))
    ]

    score = 0
    region_size = 50

    for (x, y) in points:
        x1 = max(0, x - region_size)
        x2 = min(w, x + region_size)
        y1 = max(0, y - region_size)
        y2 = min(h, y + region_size)

        region = edges[y1:y2, x1:x2]
        score += np.sum(region)

    return score / 1000


# -------- Frame Evaluation --------
def evaluate_frame(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # 1. Brightness (no hard reject now)
    brightness = np.mean(gray)

    # 2. Color richness
    color_var = np.var(frame)

    # 3. Sharpness
    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()

    # 4. Rule of Thirds
    thirds = rule_of_thirds_score(frame)

    # Final Score
    score = (
        brightness * 0.25 +
        color_var * 0.25 +
        sharpness * 0.25 +
        thirds * 0.25
    )

    return score


# -------- Thumbnail Extraction --------
def extract_thumbnail(video_path, output_path):
    cap = cv2.VideoCapture(video_path)

    best_score = -1  # important change
    best_frame = None
    frame_count = 0

    fps = cap.get(cv2.CAP_PROP_FPS)
    skip_frames = int(fps) if fps > 0 else 30

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Frame skipping
        if frame_count % skip_frames != 0:
            frame_count += 1
            continue

        score = evaluate_frame(frame)

        # Always pick best available
        if score > best_score:
            best_score = score
            best_frame = frame

        frame_count += 1

    cap.release()

    # GUARANTEED OUTPUT
    if best_frame is not None:
        cv2.imwrite(output_path, best_frame)
        print(f"✅ Saved: {output_path}")
    else:
        print(f"⚠️ Could not process video: {video_path}")


# -------- Main Program --------
def main():
    folder = input("Enter folder path containing videos: ").strip()

    if not os.path.exists(folder):
        print("❌ Invalid folder path!")
        return

    output_folder = os.path.join(folder, "output")
    os.makedirs(output_folder, exist_ok=True)

    video_extensions = ('.mp4', '.avi', '.mov', '.mkv')

    for file in os.listdir(folder):
        if file.lower().endswith(video_extensions):
            video_path = os.path.join(folder, file)

            name = os.path.splitext(file)[0]
            output_path = os.path.join(output_folder, name + ".jpg")

            print(f"🎬 Processing: {file}")
            extract_thumbnail(video_path, output_path)


if __name__ == "__main__":
    main()