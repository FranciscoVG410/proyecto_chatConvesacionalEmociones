import streamlit as st
from groq import Groq
from src.rag_engine import EmotionRAGEngine
from src.vad_processor import VADTracker
import os
from dotenv import load_dotenv
import matplotlib.pyplot as plt

# ---------------------------
# CONFIG
# ---------------------------
load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODELO_GROQ = "llama-3.3-70b-versatile"

# ---------------------------
# INIT
# ---------------------------
if 'rag_engine' not in st.session_state:
    st.session_state.rag_engine = EmotionRAGEngine('data/emotions_db.json')
    st.session_state.rag_engine.create_embeddings()
    st.session_state.vad_tracker = VADTracker()
    st.session_state.messages = []
    st.session_state.vad_history = []

# ---------------------------
# HEADER
# ---------------------------
st.title("Socius - Emotional Alignment Assistant")
st.markdown("Tu asistente conversacional que detecta tu estado emocional y te guía hacia la serenidad.")

# ---------------------------
# CHAT
# ---------------------------
for message in st.session_state.messages:
    with st.chat_message(message['role']):
        st.markdown(message['content'])

if prompt := st.chat_input("Como te sientes el dia de hoy?"):
    st.session_state.messages.append({"role": "user", "content": prompt})

    with st.chat_message("user"):
        st.markdown(prompt)

    # ---------------------------
    # RAG
    # ---------------------------
    emotion_context = st.session_state.rag_engine.query_emotion(prompt)
    
    if emotion_context:
        v, a = emotion_context['v'], emotion_context['a']
        distancia = st.session_state.vad_tracker.calculate_distance(v, a)
        emotion_name = emotion_context.get('emotion', 'unknown')
    else:
        v, a, distancia, emotion_name = 0, 0, 0, "neutral"

    # guardar estado para UI
    st.session_state.v = v
    st.session_state.a = a
    st.session_state.emotion = emotion_name
    st.session_state.distancia = distancia

    # historial
    st.session_state.vad_history.append((v, a))

    # ---------------------------
    # GROQ
    # ---------------------------
    instruccion_sistema = f"""
    Eres un agente conversacional experto en inteligencia emocional.
    Contexto detectado: El usuario siente '{emotion_name}' (V:{v}, A:{a}).
    Tu objetivo es llevar al usuario hacia la 'Serenidad' (V:0.6, A:-0.4).
    Distancia actual al objetivo: {distancia:.2f}.
    Responde de forma empática y breve sin mencionar tu objetivo.
    """

    with st.chat_message("assistant"):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": instruccion_sistema},
                    {"role": "user", "content": prompt}
                ],
                model=MODELO_GROQ,
                temperature=0.5
            )
            response_text = chat_completion.choices[0].message.content
            st.markdown(response_text)
            st.session_state.messages.append({"role": "assistant", "content": response_text})
        except Exception as e:
            st.error(f"Error en la API de Groq: {e}")

# ---------------------------
# DASHBOARD EMOCIONAL
# ---------------------------
st.divider()

v = st.session_state.get("v", 0)
a = st.session_state.get("a", 0)
emotion_name = st.session_state.get("emotion", "neutral")
distancia = st.session_state.get("distancia", 0)

col1, col2 = st.columns([1, 2])

# color dinámico
if v > 0.3:
    color = "green"
elif v < -0.3:
    color = "red"
else:
    color = "orange"


# ---------------------------
# SIDEBAR
# ---------------------------
with st.sidebar:
    st.header("ESTADO EMOCIONAL")

    v = st.session_state.get("v", 0)
    a = st.session_state.get("a", 0)
    distancia = st.session_state.get("distancia", 0)
    emotion_name = st.session_state.get("emotion", "neutral")

    st.write(f"**{emotion_name}**")
    st.write(f"V: {v:.2f} | A: {a:.2f}")

    # grapho VAD
    fig, ax = plt.subplots(figsize=(3, 3)) 

    history = st.session_state.get("vad_history", [])

    if history:
        xs = [p[0] for p in history]
        ys = [p[1] for p in history]
        ax.plot(xs, ys, marker='o')

    # punto actual
    ax.scatter(v, a)

    # objetivo (Serenidad)
    ax.scatter(0.6, -0.4, marker='x')

    ax.set_xlim(-1, 1)
    ax.set_ylim(-1, 1)
    ax.axhline(0)
    ax.axvline(0)

    ax.set_xticks([])
    ax.set_yticks([])

    st.pyplot(fig, use_container_width=True)