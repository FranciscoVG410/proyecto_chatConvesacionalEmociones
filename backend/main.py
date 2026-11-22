import os
import json
import sys
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import traceback
from groq import Groq
from dotenv import load_dotenv

# CONFIGURACIÓN DE RUTAS DINÁMICAS Y ENTORNO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

current_active_pseudonym: str = ""

if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

env_path = os.path.join(BASE_DIR, ".env")
if not os.path.exists(env_path):
    env_path = os.path.join(BASE_DIR, "..", ".env")

load_dotenv(env_path)

groq_key = os.getenv("GROQ_API_KEY")
if not groq_key:
    raise RuntimeError(
        f"API Key no encontrada..."
    )

client = Groq(api_key=groq_key)
MODELO_GROQ = "openai/gpt-oss-120b"

# IMPORTACIONES LOCALES FLEXIBLES

try:
    from src.rag_engine import EmotionRAGEngine
    from src.vad_processor import VADTracker
    from src.regulation_rules import get_emotional_guidance
    from src.filters import is_short_single_word_response
    from src.prompt_builder import build_continuous_vad_prompt
    from src.connectionManager import manager
    from src.risk_detector import analyze_risk_and_shifts
except ModuleNotFoundError:
    from backend.app.src.rag_engine import EmotionRAGEngine
    from backend.app.src.vad_processor import VADTracker
    from backend.app.src.regulation_rules import get_emotional_guidance
    from backend.app.src.filters import is_short_single_word_response
    from backend.app.src.prompt_builder import build_continuous_vad_prompt
    from backend.app.src.connectionManager import manager
    from backend.risk_detector import analyze_risk_and_shifts

def calculate_lexicon_baseline(text: str) -> tuple[float, float, float]:
    text_lower = text.lower()
    
    low_dominance_keywords = ["no puedo", "supera", "no sé qué hacer", "atascado", "perdido", "impotente", "miedo"]
    high_dominance_keywords = ["resolveré", "tengo el control", "puedo", "avanzar", "haré algo", "seguro"]

    d_score = 0.0  
    if any(kw in text_lower for kw in low_dominance_keywords):
        d_score = -0.6
    elif any(kw in text_lower for kw in high_dominance_keywords):
        d_score = 0.6

    return (0.0, 0.0, d_score)

STUDY_DATA_FILE = os.getenv("STUDY_DATA_PATH") or os.path.join(BASE_DIR, "study_data.json")

def load_study_data() -> Dict[str, Any]:
    if os.path.exists(STUDY_DATA_FILE):
        try:
            with open(STUDY_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    data.setdefault("participants", [])
                    data.setdefault("records", [])
                    return data
        except Exception as e:
            print(f"Error leyendo {STUDY_DATA_FILE}: {e}")
    return {"participants": [], "records": []}

def save_study_data(data: Dict[str, Any]) -> None:
    parent_dir = os.path.dirname(os.path.abspath(STUDY_DATA_FILE))
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)
    with open(STUDY_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# Inicializar historial en memoria desde el archivo persistente
_initial_data = load_study_data()
chat_history_records: List[Dict[str, Any]] = list(_initial_data.get("records", []))
if chat_history_records:
    last_pseudo = chat_history_records[-1].get("pseudonym", "").strip().upper()
    if last_pseudo and last_pseudo != "ANÓNIMO":
        current_active_pseudonym = last_pseudo

# INICIALIZACIÓN DE FASTAPI Y RECURSOS

app = FastAPI(title="SOCIUS")

app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "..", "frontend", "css")), name="css")
app.mount("/imgs", StaticFiles(directory=os.path.join(BASE_DIR, "..", "frontend", "imgs")), name="imgs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMPLATES_DIR = os.path.join(BASE_DIR, "app", "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

emotions_json_path = os.path.join(BASE_DIR, "data", "emotions_db.json")
if not os.path.exists(emotions_json_path):
    emotions_json_path = os.path.join(BASE_DIR, "..", "data", "emotions_db.json")

rag_engine = EmotionRAGEngine(emotions_json_path)
rag_engine.create_embeddings()
vad_tracker = VADTracker()

class ChatRequest(BaseModel):
    message: str
    pseudonym: str

class ParticipantRegister(BaseModel):
    pseudonym: str
    age: int
    gender: str

class ParticipantLogin(BaseModel):
    pseudonym: str

# ENDPOINTS Y WEBSOCKETS

@app.get("/api/generate-pseudonym")
def generate_unique_pseudonym():
    animals = ["Lobo", "Águila", "Zorro", "Delfín", "Tigre", "Oso", "Halcón", "Pantera", "Búho", "León", "Cóndor", "Jaguar"]
    colors = ["Azul", "Verde", "Rojo", "Plateado", "Dorado", "Violeta", "Turquesa", "Ámbar", "Índigo", "Esmeralda"]
    
    data = load_study_data()
    taken_pseudonyms = {p["pseudonym"] for p in data["participants"]}
    
    all_combinations = [f"{a} {c}".upper() for a in animals for c in colors]
    available = [c for c in all_combinations if c not in taken_pseudonyms]
    
    if not available:
        raise HTTPException(status_code=400, detail="Se han agotado todos los pseudónimos únicos disponibles.")
    
    return {"pseudonym": random.choice(available)}

@app.post("/api/register-participant")
def register_participant(payload: ParticipantRegister):
    global current_active_pseudonym
    data = load_study_data()
    clean_pseudo = payload.pseudonym.strip().upper()
    
    if any(p["pseudonym"].upper() == clean_pseudo for p in data["participants"]):
        raise HTTPException(status_code=400, detail="Este pseudónimo ya está registrado.")
    
    new_participant = {
        "pseudonym": clean_pseudo,
        "age": payload.age,
        "gender": payload.gender,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    data["participants"].append(new_participant)
    save_study_data(data)
    current_active_pseudonym = clean_pseudo
    return {"status": "success", "message": "Participante registrado correctamente."}

@app.post("/api/login-participant")
def login_participant(payload: ParticipantLogin):
    global current_active_pseudonym
    data = load_study_data()
    pseudonym_upper = payload.pseudonym.strip().upper()
    
    found = next((p for p in data["participants"] if p["pseudonym"].upper() == pseudonym_upper), None)
    if not found:
        raise HTTPException(status_code=404, detail="El pseudónimo ingresado no existe en el registro del estudio.")
    
    current_active_pseudonym = pseudonym_upper
    return {"status": "success", "participant": found}

@app.get("/api/report", response_class=HTMLResponse)
async def generate_report(request: Request, pseudonym: str = ""):
    try:
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        global chat_history_records, current_active_pseudonym
        
        target_pseudo = pseudonym.strip().upper()
        if not target_pseudo:
            if current_active_pseudonym:
                target_pseudo = current_active_pseudonym
            elif chat_history_records:
                target_pseudo = chat_history_records[-1].get("pseudonym", "").upper()

        study_data = load_study_data()
        participants_list = study_data.get("participants", [])
        
        participant_info = next(
            (p for p in participants_list if p.get("pseudonym", "").upper() == target_pseudo),
            None
        )

        user_profile = {
            "pseudonym": target_pseudo if target_pseudo else "GENERAL (Todos los participantes)",
            "age": participant_info.get("age", "N/A") if participant_info else "N/A",
            "gender": participant_info.get("gender", "N/A") if participant_info else "N/A",
            "created_at": participant_info.get("created_at", "N/A") if participant_info else "N/A"
        }

        all_records = chat_history_records if chat_history_records else study_data.get("records", [])
        
        if target_pseudo:
            records_source = [
                r for r in all_records 
                if r.get("pseudonym", "").upper() == target_pseudo
            ]
        else:
            records_source = all_records

        vad_data_js = []
        report_records = []

        for idx, item in enumerate(records_source):
            msg_num = idx + 1
            v_val = float(item.get("v", 0.0))
            a_val = float(item.get("a", 0.0))
            d_val = float(item.get("d", 0.0))
            is_crit = bool(item.get("is_critical", False))

            vad_data_js.append({
                "v": v_val, 
                "a": a_val, 
                "d": d_val, 
                "label": f"#{msg_num}",
                "is_critical": is_crit
            })

            report_records.append({
                "msg_number": msg_num,
                "pseudonym": item.get('pseudonym', target_pseudo if target_pseudo else "ANÓNIMO"),
                "date": item.get("date", datetime.now().strftime("%Y-%m-%d")),
                "timestamp": item.get("timestamp", datetime.now().strftime("%H:%M:%S")),
                "user_msg": item.get('user_msg', ''),
                "bot_msg": item.get('bot_msg', ''),
                "emotion": item.get('emotion', 'Neutral'),
                "v": v_val,
                "a": a_val,
                "d": d_val,
                "is_critical": is_crit
            })

        critical_records = [r for r in report_records if r.get("is_critical")]

        return templates.TemplateResponse(
            request=request,
            name="report_template.html",
            context={
                "date_str": date_str,
                "pseudonym_filter": user_profile["pseudonym"],
                "user_profile": user_profile,
                "total_records": len(report_records),
                "critical_count": len(critical_records),
                "critical_records": critical_records,
                "records": report_records,
                "vad_data_js": vad_data_js
            }
        )
    except Exception as e:
        print(f"Error generando reporte: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno al generar el reporte: {str(e)}")
    
@app.websocket("/ws/analytics")
async def websocket_analytics(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/chat")
async def handle_chat(payload: ChatRequest):
    try:
        global current_active_pseudonym, chat_history_records

        user_message = payload.message.strip()
        pseudonym = payload.pseudonym.strip().upper() if payload.pseudonym else "ANÓNIMO"
        
        if pseudonym != "ANÓNIMO":
            current_active_pseudonym = pseudonym

        if not user_message:
            raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")

        lex_v, lex_a, lex_d = calculate_lexicon_baseline(user_message)
        v_weighted, a_weighted, distance, dominant_emotion = rag_engine.process_long_text(user_message, vad_tracker)
        
        final_v = v_weighted if v_weighted != 0.0 else lex_v
        final_a = a_weighted if a_weighted != 0.0 else lex_a
        final_d = lex_d  

        guia_actitud = get_emotional_guidance(dominant_emotion)
        is_checkin = False 

        prompt_content = build_continuous_vad_prompt(
            lexicon_v=final_v, 
            lexicon_a=final_a, 
            lexicon_d=final_d, 
            guia_actitud=guia_actitud, 
            is_checkin=is_checkin
        )

        completion = client.chat.completions.create(
            model=MODELO_GROQ,
            messages=[
                {
                    "role": "system",
                    "content": "Eres Socius, un asistente empático de apoyo emocional. Devuelve siempre la respuesta estrictamente en formato JSON tal como se solicita, sin usar emojis."
                },
                {
                    "role": "user",
                    "content": f"{user_message}\n\n{prompt_content}"
                }
            ],
            temperature=0.7,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        
        raw_response = completion.choices[0].message.content.strip()

        bot_text = raw_response
        exact_emotion = dominant_emotion
        exact_v, exact_a, exact_d = final_v, final_a, final_d

        try:
            if "```json" in raw_response:
                raw_response = raw_response.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_response:
                raw_response = raw_response.split("```")[1].split("```")[0].strip()
                
            parsed_json = json.loads(raw_response)
            bot_text = parsed_json.get("bot_response", raw_response)
            exact_emotion = parsed_json.get("emotion", dominant_emotion)
            exact_v = float(parsed_json.get("v", final_v))
            exact_a = float(parsed_json.get("a", final_a))
            exact_d = float(parsed_json.get("d", final_d))
        except Exception:
            pass

        is_critical_flag = (exact_a > 0.7 and exact_v < -0.5) or (exact_d < -0.7)

        now = datetime.now()
        record = {
            "pseudonym": pseudonym,
            "date": now.strftime("%Y-%m-%d"),
            "timestamp": now.strftime("%H:%M:%S"),
            "user_msg": user_message,
            "bot_msg": bot_text,
            "v": exact_v,
            "a": exact_a,
            "d": exact_d,
            "emotion": exact_emotion,
            "is_critical": is_critical_flag
        }
        chat_history_records.append(record)

        # Persistir registro en study_data.json
        study_data = load_study_data()
        study_data.setdefault("records", []).append(record)
        save_study_data(study_data)

        ws_payload = {
            "event": "new_point",
            "point": {
                "x": exact_v, "y": exact_a, "z": exact_d,
                "v": exact_v, "a": exact_a, "d": exact_d,
                "emotion": exact_emotion,
                "user_msg": user_message,
                "is_critical": is_critical_flag,
                "pseudonym": pseudonym
            }
        }
        await manager.broadcast_metrics(ws_payload)

        return {
            "status": "success",
            "response": bot_text,
            "vad": {
                "v": exact_v, 
                "a": exact_a, 
                "d": exact_d, 
                "emotion": exact_emotion
            }
        }

    except Exception as e:
        print(f"Error en chat: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/history")
async def get_history():
    return {"history": chat_history_records}

# RUTAS PARA SERVIR LAS VISTAS HTML
@app.get("/", response_class=HTMLResponse)
def serve_welcome(request: Request):
    return templates.TemplateResponse(request=request, name="welcome.html", context={})

@app.get("/chat-app")
def serve_chat():
    return FileResponse(os.path.join(BASE_DIR, "..", "frontend", "index.html"))

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse(os.path.join(BASE_DIR, "..", "frontend", "dashboard.html"))

@app.get("/thanks", response_class=HTMLResponse)
def serve_thanks(request: Request):
    return templates.TemplateResponse(request=request, name="thanks.html", context={})

app.mount("/js", StaticFiles(directory="js"), name="js")