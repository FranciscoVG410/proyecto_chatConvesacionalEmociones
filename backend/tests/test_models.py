import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("Buscando modelos compatibles...")
try:
    models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    if models:
        print("Copia uno de estos nombres exactos en tu archivo app.py:")
        for m in models:
            print(f" -> {m}")
    else:
        print("No se encontraron modelos. Revisa si tu API Key tiene permisos.")
except Exception as e:
    print(f"Error al listar modelos: {e}")