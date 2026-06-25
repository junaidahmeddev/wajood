"""Face recognition service utilizing DeepFace and OpenCV."""

import os
import logging
from typing import List
import numpy as np

logger = logging.getLogger("wajood_biometrics")

# Check if we should run in Mock/Dummy AI mode for fast development
MOCK_AI = os.getenv("MOCK_AI", "false").lower() == "true"

try:
    if not MOCK_AI:
        import cv2
        from deepface import DeepFace
        HAS_BIOMETRICS = True
    else:
        HAS_BIOMETRICS = False
        logger.info("ℹ️ Running in MOCK_AI mode as configured in environment.")
except ImportError:
    HAS_BIOMETRICS = False
    logger.warning("⚠️ DeepFace or OpenCV libraries are missing. Face recognition running in fallback mode.")


def match_face(source_image_path: str, candidate_image_path: str) -> dict:
    """
    Compare two face images using DeepFace VGG-Face model.
    Returns:
        dict: containing confidence score, matching status, and metrics details.
    """
    if not source_image_path or not candidate_image_path:
        return {"confidence": 0, "match": False, "details": "Missing image paths"}

    if MOCK_AI or not HAS_BIOMETRICS:
        # Fallback simulation if libraries are not installed locally or MOCK_AI is enabled
        import hashlib
        h1 = int(hashlib.md5(source_image_path.encode()).hexdigest()[:6], 16) % 100
        h2 = int(hashlib.md5(candidate_image_path.encode()).hexdigest()[:6], 16) % 100
        sim = 100 - abs(h1 - h2)
        return {
            "confidence": sim,
            "match": sim >= 70,
            "details": f"Mock/Fallback Mode: Biometric similarity calculated: {sim}%",
        }

    try:
        # Use DeepFace verify to calculate similarity distance
        # We specify VGG-Face model (standard light-weight default face model)
        result = DeepFace.verify(
            img1_path=source_image_path,
            img2_path=candidate_image_path,
            model_name="VGG-Face",
            distance_metric="cosine",
            enforce_detection=False,
        )

        distance = result.get("distance", 1.0)
        # Cosine distance ranges from 0 (identical) to 2 (completely opposite).
        # We normalize this distance into a 0-100 percentage confidence score.
        confidence = int((1.0 - min(distance, 1.0)) * 100)
        is_match = bool(result.get("verified", False))

        return {
            "confidence": confidence,
            "match": is_match or confidence >= 65,
            "details": f"Cosine distance: {distance:.4f} (Model: VGG-Face)",
        }
    except Exception as e:
        logger.error(f"Failed to execute DeepFace verification: {e}")
        return {
            "confidence": 0,
            "match": False,
            "details": f"Biometric matcher error: {str(e)}",
        }


def extract_embedding(image_path: str) -> list:
    """
    Extract a 512-dimensional face embedding using DeepFace (Facenet512 model)
    with enforce_detection=False for robustness.
    """
    if not image_path:
        return []

    if MOCK_AI or not HAS_BIOMETRICS:
        # Fallback simulation: return a 512-dimensional pseudo-random but deterministic float array
        import hashlib
        import random
        h = hashlib.md5(image_path.encode()).hexdigest()
        random.seed(int(h[:8], 16))
        return [random.random() for _ in range(512)]

    try:
        results = DeepFace.represent(
            img_path=image_path,
            model_name="Facenet512",
            enforce_detection=False,
        )
        if results and len(results) > 0:
            embedding = results[0].get("embedding", [])
            return [float(x) for x in embedding]
        return []
    except Exception as e:
        logger.error(f"Facenet512 representation extraction failed: {e}")
        return []


def compare_faces(embedding1: list, embedding2: list) -> float:
    """
    Compare two embeddings and return a cosine similarity score (0.0 to 1.0).
    """
    if not embedding1 or not embedding2:
        return 0.0
    try:
        a = np.array(embedding1)
        b = np.array(embedding2)
        min_len = min(len(a), len(b))
        if min_len == 0:
            return 0.0
        a = a[:min_len]
        b = b[:min_len]
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        similarity = float(dot / (norm_a * norm_b))
        return float(max(0.0, similarity))
    except Exception as e:
        logger.error(f"Error comparing face embeddings: {e}")
        return 0.0


def batch_compare(embedding: list, all_embeddings: List[dict]) -> List[dict]:
    """
    Compare query embedding against a list of candidates.
    Each candidate in 'all_embeddings' is a dict: {'id': identifier, 'embedding': list_of_floats}.
    Returns a ranked list of candidates sorted by similarity descending.
    """
    ranked_list = []
    for candidate in all_embeddings:
        score = compare_faces(embedding, candidate.get("embedding", []))
        ranked_list.append({
            "id": candidate.get("id"),
            "score": score,
            "person_data": candidate.get("person_data")
        })
    ranked_list.sort(key=lambda x: x["score"], reverse=True)
    return ranked_list


# Backward compatibility alias
def extract_face_embedding(image_path: str) -> list:
    return extract_embedding(image_path)
