import streamlit as st
import google.generativeai as genai
from src.rag_engine import EmotionRAGEngine
from src.vad_processor import VADTracker
import os
from dotenv import load_dotenv

# Configuration
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('models/gemini-2.5-flash')

# Initialize components
if 'rag_engine' not in st.session_state:
    st.session_state.rag_engine = EmotionRAGEngine('data/emotions_db.json')
    st.session_state.rag_engine.create_embeddings()
    st.session_state.vad_tracker = VADTracker()
    st.session_state.messages = []

st.title("Emotional Alignment Assistant")
st.markdown("Based in Plutchik's Wheel of Emotions, this assistant helps you understand and manage your emotions through a conversational interface.")

# Chat interface
for message in st.session_state.messages:
    with st.chat_message(message['role']):
        st.markdown(message['content'])

if prompt := st.chat_input("How are you feeling today?"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Query RAG engine for emotion analysis
    emotion_context = st.session_state.rag_engine.query_emotion(prompt)
    
    if emotion_context:
        v, a = emotion_context['v'], emotion_context['a']
        distancia = st.session_state.vad_tracker.calculate_distance(v, a)
        emotion_name = emotion_context.get('emotion', 'unknown')
    else:
        v, a, distancia, emotion_name = 0, 0, 0, "neutral"

# GENERACIÓN CON GEMINI
    instruccion_sistema = f"""
    Eres un agente conversacional experto en inteligencia emocional.
    Contexto detectado: El usuario siente '{emotion_name}' (V:{v}, A:{a}).
    Tu objetivo es llevar al usuario hacia la 'Serenidad' (V:0.6, A:-0.4).
    Distancia actual al objetivo: {distancia:.2f}.
    Responde de forma empática y breve, usando técnicas de validación emocional.
    """

    with st.chat_message("assistant"):
        response = model.generate_content([instruccion_sistema, prompt])
        st.markdown(response.text)
        st.session_state.messages.append({"role": "assistant", "content": response.text})

    # 5. Visualización técnica (Para tu Tesis)
    with st.sidebar:
        st.subheader("Métricas en Tiempo Real")
        st.write(f"**Emoción detectada:** {emotion_name}")
        st.write(f"**Valencia:** {v}")
        st.write(f"**Arousal:** {a}")
        st.write(f"**Distancia al Safe Space:** {distancia:.2f}")