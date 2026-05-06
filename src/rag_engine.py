import json
import chromadb
import re
import unicodedata
from chromadb.utils import embedding_functions

class EmotionRAGEngine:
    def __init__(self, emotions_db_path):
        self.emotions_db = self.load_emotions_db(emotions_db_path)
        self.chroma_client = chromadb.Client()

        self.collection = self.chroma_client.get_or_create_collection(
            name="emotions_collection",
            embedding_function=embedding_functions.DefaultEmbeddingFunction()
        )

    def load_emotions_db(self, path):
        with open(path, 'r', encoding='utf-8') as file:
            return json.load(file)

    def normalize_input(self, text):
        text = text.lower().strip()
        text = ''.join(
            c for c in unicodedata.normalize('NFD', text)
            if unicodedata.category(c) != 'Mn'
        )
        text = re.sub(r'[^\w\s]', '', text)
        return text

    def create_embeddings(self):
        try:
            self.chroma_client.delete_collection("emotions_collection")
        except:
            pass

        self.collection = self.chroma_client.get_or_create_collection(
            name="emotions_collection",
            embedding_function=embedding_functions.DefaultEmbeddingFunction()
        )

        for emotion in self.emotions_db:
            keywords_text = " ".join(emotion['keywords'])

            text = f"""
            Una persona puede decir:
            {keywords_text}

            Se siente así cuando:
            {emotion.get('description', '')}

            Ejemplos:
            me siento {emotion['emotion'].lower()}
            estoy {emotion['emotion'].lower()}
            siento {emotion['emotion'].lower()}

            Esta emoción es {emotion['emotion']}
            """

            self.collection.add(
                documents=[text],
                metadatas=[{
                    "category": emotion['category'],
                    "emotion": emotion['emotion'],
                    "v": emotion['v'],
                    "a": emotion['a']
                }],
                ids=[emotion['emotion']]
            )

    def query_emotion(self, user_input):
        user_input = self.normalize_input(user_input)

        results = self.collection.query(
            query_texts=[user_input],
            n_results=5,
            include=["metadatas", "distances"]
        )

        if not results['metadatas'] or not results['metadatas'][0]:
            return None

        emotions = results['metadatas'][0]
        distances = results['distances'][0]

        sorted_pairs = sorted(zip(emotions, distances), key=lambda x: x[1])

        pairs = [(e, d) for e, d in sorted_pairs if d < 0.8]

        if not pairs:
            best_emotion, best_distance = sorted_pairs[0]

            return {
                "emotion": best_emotion['emotion'],
                "v": best_emotion['v'],
                "a": best_emotion['a'],
                "all": [best_emotion],
                "fallback": True  # 👈 útil para debug
            }
        
        weights = [1 - d for _, d in pairs]
        total_w = sum(weights)

        avg_v = sum(e['v'] * w for (e, _), w in zip(pairs, weights)) / total_w
        avg_a = sum(e['a'] * w for (e, _), w in zip(pairs, weights)) / total_w

        return {
            "emotion": pairs[0][0]['emotion'],
            "v": avg_v,
            "a": avg_a,
            "all": [e for e, _ in pairs],
            "fallback": False
        }