def select_regulation_tool(v: float, a: float, emotion: str) -> dict:
    """
    Determina la herramienta de regulación adecuada basada en las 
    coordenadas VAD y el nombre de la emoción detectada.
    """
    # 1. Estrés elevado, Ansiedad o Pánico (Alta Activación + Valencia Negativa)
    if a >= 0.5 and v < 0.0:
        if "ira" in emotion.lower() or "enojo" in emotion.lower() or "frustrac" in emotion.lower():
            return {
                "tool_id": "grounding_54321",
                "name": "Técnica de Anclaje 5-4-3-2-1",
                "type": "sensorial",
                "prompt_hint": "Sugiere al usuario nombrar 5 cosas que vea a su alrededor para volver al presente."
            }
        return {
            "tool_id": "breathing_478",
            "name": "Respiración Guiada 4-7-8",
            "type": "fisiologica",
            "prompt_hint": "Invita suavemente al usuario a realizar 3 ciclos de respiración pausada."
        }

    # 2. Tristeza, Melancolía o Desánimo (Baja Activación + Valencia Negativa)
    elif a < 0.0 and v < 0.0:
        return {
            "tool_id": "micro_action",
            "name": "Activación Conductual Suave",
            "type": "cognitiva",
            "prompt_hint": "Valida su sentir y sugiere un movimiento físico mínimo (abrir una ventana, tomar agua)."
        }

    # 3. Sobrecarca mental o Abrumamiento (Activación Media/Alta con Valencia Neutral)
    elif a >= 0.3 and -0.2 <= v <= 0.2:
        return {
            "tool_id": "brain_dump",
            "name": "Desglose de Carga Mental",
            "type": "organizacional",
            "prompt_hint": "Ayuda a enfocar la atención en una sola cosa pequeña que pueda resolver ahora."
        }

    # 4. Estado Estable o Positivo (Sin intervención activa necesaria)
    return {
        "tool_id": "none",
        "name": "Conversación Estándar",
        "type": "conversacional",
        "prompt_hint": "Mantén la conversación fluida sin forzar dinámicas de regulación."
    } 

def get_emotional_guidance(emotion_name: str) -> str:
    """
    Devuelve las pautas de actitud que debe tomar la IA según la emoción detectada.
    """
    emotion = emotion_name.lower()
    
    if any(e in emotion for e in ["ansiedad", "estrés", "abrumado", "miedo", "nervioso"]):
        return "- ACTITUD: Sé un ancla de calma. Usa frases pausadas, transmite tranquilidad y no presiones la conversación. Valida el peso de lo que siente sin sobrecargarlo."
    elif any(e in emotion for e in ["frustración", "enojo", "ira", "molestia", "impaciencia"]):
        return "- ACTITUD: Valida fuertemente su molestia primero. Sé directo, dale la razón en que la situación es injusta/incómoda y evita frases condescendientes o 'positivismo tóxico'."
    elif any(e in emotion for e in ["tristeza", "desánimo", "soledad", "melancolía"]):
        return "- ACTITUD: Muestra calidez y presencia constante. Usa un tono suave y reconfortante. Hazle sentir compañía sin intentar resolverle el problema de golpe."
    elif any(e in emotion for e in ["entusiasmo", "alegría", "orgullo", "felicidad", "motivación"]):
        return "- ACTITUD: Sintoniza con su energía positiva. Muestra genuino gusto por sus logros o buenas noticias con un tono dinámico y cercano."
    elif any(e in emotion for e in ["calma", "serenidad", "paz", "relajado"]):
        return "- ACTITUD: Mantén un tono equilibrado, fluido y reflexivo. Habla con naturalidad como en una buena charla de café."
    else:
        return "- ACTITUD: Mantén un trato amigable, receptivo, empático y natural."