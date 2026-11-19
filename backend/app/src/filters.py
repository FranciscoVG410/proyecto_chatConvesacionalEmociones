import re

SHORT_RESPONSE_WORDS = {
    "si", "sí", "no", "ya", "ok", "oka", "okay", "ajá", "aja", "nop", "sip",
    "y", "o", "pero", "mas", "que", "qué", "como", "cómo", "tan",
    "bueno", "vale", "asi", "así", "claro", "entonces", "luego", "bien", "mal"
}

def is_short_single_word_response(text: str) -> bool:
    cleaned = re.sub(r'[^\w\s]', '', text.lower()).strip()
    words = cleaned.split()
    if len(words) <= 2 and all(w in SHORT_RESPONSE_WORDS for w in words):
        return True
    return False