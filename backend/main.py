from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
from PIL import Image
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://digit-classifier-hazel.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model
model = joblib.load("digit_classifier.joblib")


@app.get("/")
def home():
    return {"message": "Digit Classifier API is running!"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Read uploaded image
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to grayscale
    image = image.convert("L")

    # Convert image to NumPy array
    image_array = np.array(image, dtype=np.uint8)

    # Find the white digit
    # The canvas background is dark and the digit is white
    mask = image_array > 50

    # Find bounding box of the digit
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]

    # If no digit was drawn
    if len(rows) == 0 or len(cols) == 0:
        return {
            "prediction": -1,
            "confidence": 0.0
        }

    # Crop tightly around the digit
    top = rows[0]
    bottom = rows[-1] + 1
    left = cols[0]
    right = cols[-1] + 1

    cropped = image.crop((left, top, right, bottom))

    # Make the cropped digit square
    width, height = cropped.size
    size = max(width, height)

    square = Image.new("L", (size, size), 0)

    paste_x = (size - width) // 2
    paste_y = (size - height) // 2

    square.paste(cropped, (paste_x, paste_y))

    # Leave some margin around the digit
    # Resize digit to 6x6 and place it in the center of an 8x8 image
    digit = square.resize((6, 6), Image.Resampling.LANCZOS)

    final_image = Image.new("L", (8, 8), 0)
    final_image.paste(digit, (1, 1))

    # Convert to NumPy array
    final_array = np.array(final_image, dtype=np.float32)

    # Convert 0-255 range to the 0-16 range used by sklearn digits
    final_array = final_array / 255.0 * 16.0

    # Flatten 8x8 image into 64 values
    final_array = final_array.reshape(1, 64)

    # Predict
    prediction = model.predict(final_array)[0]

    # Get class probabilities
    probabilities = model.predict_proba(final_array)[0]
    confidence = float(np.max(probabilities))

    return {
        "prediction": int(prediction),
        "confidence": confidence
    }
