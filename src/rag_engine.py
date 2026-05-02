import json
import chromadb
import google.generativeai as genai
from chromadb.utils import embedding_functions

# API configure with API Key from GEMINI
genai.configure(api_key="AIzaSyC9mXo2n8s1a3v5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0")

class EmotionRAGEngine:
    def __init__(self, emotions_db_path):
        self.emotions_db = self.load_emotions_db(emotions_db_path)
        self.chroma_client = chromadb.Client()
        self.collection = self.chroma_client.create_collection(name="emotions_collection", embedding_function=embedding_functions.DefaultEmbeddingFunction())

    def load_emotions_db(self, path):
        with open(path, 'r') as file:
            return json.load(file)

    def create_embeddings(self):
        for emotion in self.emotions_db:
            self.collection.add(
                documents=[emotion['emotion']],
                metadatas=[{
                    "category": emotion['category'],
                    "emotion": emotion['emotion'],
                    "v": emotion['v'],
                    "a": emotion['a']
                }],
                ids=[emotion['emotion']]
            )

    def query_emotion(self, user_input):
        results = self.collection.query(
            query_texts=[user_input],
            n_results=1
        )
        if results['ids']:
            return results['metadatas'][0][0]
        else:
            return None