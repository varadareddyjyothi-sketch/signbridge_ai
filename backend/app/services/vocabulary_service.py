"""
SignBridge AI - Vocabulary Service
Manages dynamic gesture definitions, multilingual mappings (English, Telugu, Romanized Telugu),
sample statistics, and training readiness states.
"""

import os
import json
import csv
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.app.config import settings

VOCABULARY_PATH = os.path.join("ml", "vocabulary", "gesture_vocabulary.json")
DATASET_PATH = settings.DATASET_PATH
MIN_SAMPLES_FOR_TRAINING = 15

# MediaPipe native pretrained class set
PRETRAINED_CLASSES = {
    "Open_Palm", "Closed_Fist", "Pointing_Up", "Thumb_Up", "Thumb_Down", "Victory", "ILoveYou"
}


class VocabularyService:
    def __init__(self, vocab_file: str = VOCABULARY_PATH):
        self.vocab_file = vocab_file
        self._ensure_vocab_file()

    def _ensure_vocab_file(self):
        os.makedirs(os.path.dirname(self.vocab_file), exist_ok=True)
        if not os.path.exists(self.vocab_file):
            with open(self.vocab_file, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2, ensure_ascii=False)

    def _read_raw_entries(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.vocab_file):
            return []
        try:
            with open(self.vocab_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[VocabularyService] Error reading vocabulary file: {e}")
            return []

    def _save_raw_entries(self, entries: List[Dict[str, Any]]):
        os.makedirs(os.path.dirname(self.vocab_file), exist_ok=True)
        with open(self.vocab_file, "w", encoding="utf-8") as f:
            json.dump(entries, f, indent=2, ensure_ascii=False)

    def _get_dataset_sample_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        if not os.path.exists(DATASET_PATH):
            return counts
        try:
            with open(DATASET_PATH, "r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    lbl = row.get("label")
                    if lbl:
                        counts[lbl] = counts.get(lbl, 0) + 1
        except Exception as e:
            print(f"[VocabularyService] Error reading dataset counts: {e}")
        return counts

    def get_all_gestures(self, active_model_classes: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Returns all gesture vocabulary entries enriched with sample counts and training readiness.
        """
        entries = self._read_raw_entries()
        counts = self._get_dataset_sample_counts()
        model_classes_set = set(active_model_classes or [])

        enriched = []
        for item in entries:
            gid = item.get("id", "")
            sample_count = counts.get(gid, 0)
            is_in_model = gid in model_classes_set
            is_pretrained = gid in PRETRAINED_CLASSES

            # Determine training readiness state
            if is_in_model:
                readiness = "active_trained"
                readiness_desc = "Trained and active in custom model."
            elif is_pretrained:
                readiness = "pretrained_supported"
                readiness_desc = "Recognized by client-side MediaPipe engine."
            elif sample_count >= MIN_SAMPLES_FOR_TRAINING:
                readiness = "ready_to_train"
                readiness_desc = f"Has {sample_count} samples. Retrain model to activate."
            else:
                readiness = "needs_data"
                needed = MIN_SAMPLES_FOR_TRAINING - sample_count
                readiness_desc = f"Needs {needed} more sample{'s' if needed != 1 else ''} to enable training."

            enriched.append({
                **item,
                "sample_count": sample_count,
                "is_in_active_model": is_in_model,
                "is_pretrained_supported": is_pretrained,
                "readiness": readiness,
                "readiness_description": readiness_desc,
                "min_samples_required": MIN_SAMPLES_FOR_TRAINING
            })

        return enriched

    def get_gesture_by_id(self, gesture_id: str, active_model_classes: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
        entries = self.get_all_gestures(active_model_classes=active_model_classes)
        for e in entries:
            if e.get("id") == gesture_id:
                return e
        return None

    def get_multilingual_mapping(self, gesture_id: str) -> Dict[str, str]:
        """
        Returns English, Telugu script, and Romanized Telugu for a recognized gesture ID.
        """
        g = self.get_gesture_by_id(gesture_id)
        if g:
            return {
                "english": g.get("name", gesture_id),
                "telugu": g.get("telugu", gesture_id),
                "telugu_romanized": g.get("telugu_romanized", gesture_id),
                "gesture_type": g.get("gesture_type", "static"),
                "is_verified_isl": g.get("gesture_type") == "verified_isl"
            }

        # Fallback for unrecognized classes
        clean_id = gesture_id.replace("ISL_", "").replace("_", " ")
        return {
            "english": clean_id,
            "telugu": clean_id,
            "telugu_romanized": clean_id,
            "gesture_type": "static",
            "is_verified_isl": False
        }

    def add_gesture(self, gesture_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adds a new gesture vocabulary entry.
        """
        raw_id = gesture_data.get("id", "").strip().upper()
        # Sanitize ID: replace spaces with underscores, ensure prefix
        clean_id = raw_id.replace(" ", "_")
        if not clean_id:
            raise ValueError("Gesture ID cannot be empty.")

        entries = self._read_raw_entries()
        for e in entries:
            if e.get("id") == clean_id:
                raise ValueError(f"Gesture with ID '{clean_id}' already exists.")

        now_iso = datetime.now(timezone.utc).isoformat()
        canonical_label = (gesture_data.get("canonical_label") or clean_id).strip().upper()
        english_gloss = (gesture_data.get("english_gloss") or clean_id).strip().upper()
        name = (gesture_data.get("name") or clean_id).strip()
        telugu = (gesture_data.get("telugu") or "").strip() or clean_id
        telugu_ro = (gesture_data.get("telugu_romanized") or "").strip() or clean_id
        gesture_type = gesture_data.get("gesture_type") or "static"
        sign_type = gesture_data.get("sign_type") or gesture_type

        new_entry = {
            "id": clean_id,
            "canonical_label": canonical_label,
            "english_gloss": english_gloss,
            "name": name,
            "telugu": telugu,
            "telugu_romanized": telugu_ro,
            "sign_type": sign_type,
            "gesture_type": gesture_type,
            "required_modalities": gesture_data.get("required_modalities") or ["hands"],
            "verification_status": gesture_data.get("verification_status") or "experimental",
            "dataset_reference": gesture_data.get("dataset_reference") or "custom_collection",
            "model_version": gesture_data.get("model_version") or "pending_training",
            "category": gesture_data.get("category") or "custom_gesture",
            "description": (gesture_data.get("description") or "").strip(),
            "example_sentence_en": (gesture_data.get("example_sentence_en") or "").strip(),
            "example_sentence_te": (gesture_data.get("example_sentence_te") or "").strip(),
            "example_sentence_ro": (gesture_data.get("example_sentence_ro") or "").strip(),
            "is_deletable": True,
            "created_at": now_iso
        }

        entries.append(new_entry)
        self._save_raw_entries(entries)
        return new_entry

    def delete_gesture(self, gesture_id: str) -> bool:
        """
        Deletes a user-added gesture entry (protects core classes).
        """
        entries = self._read_raw_entries()
        target = None
        for e in entries:
            if e.get("id") == gesture_id:
                target = e
                break

        if not target:
            raise ValueError(f"Gesture '{gesture_id}' not found.")

        if not target.get("is_deletable", True):
            raise ValueError(f"Gesture '{gesture_id}' is a core system class and cannot be deleted.")

        remaining = [e for e in entries if e.get("id") != gesture_id]
        self._save_raw_entries(remaining)
        return True


vocabulary_service = VocabularyService()
