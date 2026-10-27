"""
SignBridge AI - Model Registry & Versioning Service
Manages trained model versions, evaluation checkpoints, safe activation, and rollback.
"""

import os
import json
import shutil
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.app.config import settings

REGISTRY_DIR = os.path.join("ml", "models", "registry")
INDEX_FILE = os.path.join(REGISTRY_DIR, "versions_index.json")


class ModelRegistryService:
    def __init__(self, registry_dir: str = REGISTRY_DIR):
        self.registry_dir = registry_dir
        self.index_file = os.path.join(self.registry_dir, "versions_index.json")
        self._ensure_registry()

    def _ensure_registry(self):
        os.makedirs(self.registry_dir, exist_ok=True)
        if not os.path.exists(self.index_file):
            # Seed initial version if active model exists
            initial_versions = []
            if os.path.exists(settings.model_path):
                now_iso = datetime.now(timezone.utc).isoformat()
                v1_model_name = "signbridge_rf_v1.0.0.joblib"
                v1_meta_name = "metadata_v1.0.0.json"
                v1_model_dest = os.path.join(self.registry_dir, v1_model_name)
                v1_meta_dest = os.path.join(self.registry_dir, v1_meta_name)

                try:
                    shutil.copy2(settings.model_path, v1_model_dest)
                    if os.path.exists(settings.metadata_path):
                        shutil.copy2(settings.metadata_path, v1_meta_dest)
                        with open(settings.metadata_path, "r", encoding="utf-8") as f:
                            meta = json.load(f)
                    else:
                        meta = {}

                    initial_versions.append({
                        "version": "v1.0.0",
                        "model_filename": v1_model_name,
                        "metadata_filename": v1_meta_name,
                        "test_accuracy": meta.get("test_accuracy", 0.9893),
                        "total_samples": meta.get("total_samples", 607),
                        "classes": meta.get("classes", []),
                        "classes_count": len(meta.get("classes", [])),
                        "created_at": now_iso,
                        "is_active": True,
                        "note": "Initial baseline model trained on verified ISL dataset."
                    })
                except Exception as e:
                    print(f"[ModelRegistryService] Error initializing baseline registry: {e}")

            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(initial_versions, f, indent=2)

    def list_versions(self) -> List[Dict[str, Any]]:
        self._ensure_registry()
        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ModelRegistryService] Error loading versions index: {e}")
            return []

    def register_new_version(
        self,
        trained_model_path: str,
        metadata_path: str,
        test_accuracy: float,
        classes: List[str],
        total_samples: int,
        note: str = "Trained via Dataset Studio"
    ) -> Dict[str, Any]:
        """
        Registers a newly trained model version, archiving files and updating the index.
        """
        versions = self.list_versions()
        version_num = len(versions) + 1
        new_version_id = f"v1.{version_num}.0"
        now_iso = datetime.now(timezone.utc).isoformat()

        model_dest_name = f"signbridge_rf_{new_version_id}.joblib"
        meta_dest_name = f"metadata_{new_version_id}.json"
        model_dest_path = os.path.join(self.registry_dir, model_dest_name)
        meta_dest_path = os.path.join(self.registry_dir, meta_dest_name)

        # Copy files into registry archive
        shutil.copy2(trained_model_path, model_dest_path)
        shutil.copy2(metadata_path, meta_dest_path)

        # Mark previous versions as inactive
        for v in versions:
            v["is_active"] = False

        new_entry = {
            "version": new_version_id,
            "model_filename": model_dest_name,
            "metadata_filename": meta_dest_name,
            "test_accuracy": round(test_accuracy, 4),
            "total_samples": total_samples,
            "classes": classes,
            "classes_count": len(classes),
            "created_at": now_iso,
            "is_active": True,
            "note": note
        }
        versions.append(new_entry)

        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(versions, f, indent=2)

        return new_entry

    def activate_version(self, target_version: str) -> Dict[str, Any]:
        """
        Rolls back or activates a specific historical model version.
        """
        versions = self.list_versions()
        target = None
        for v in versions:
            if v.get("version") == target_version:
                target = v
                break

        if not target:
            raise ValueError(f"Version '{target_version}' not found in registry.")

        model_src = os.path.join(self.registry_dir, target["model_filename"])
        meta_src = os.path.join(self.registry_dir, target["metadata_filename"])

        if not os.path.exists(model_src):
            raise FileNotFoundError(f"Archived model file not found: {model_src}")

        # Deploy to primary model paths
        shutil.copy2(model_src, settings.model_path)
        if os.path.exists(meta_src):
            shutil.copy2(meta_src, settings.metadata_path)

        # Update active flags
        for v in versions:
            v["is_active"] = (v.get("version") == target_version)

        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(versions, f, indent=2)

        return {
            "success": True,
            "activated_version": target_version,
            "classes_count": target.get("classes_count", 0),
            "test_accuracy": target.get("test_accuracy")
        }


model_registry_service = ModelRegistryService()
