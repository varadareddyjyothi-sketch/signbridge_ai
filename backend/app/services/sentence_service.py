"""
SignBridge AI - Sentence Translation Service
Translates sequential gesture/sign streams into coherent, grammatically structured
English, Telugu script, and Romanized Telugu sentences.
"""

from typing import List, Dict, Any
from backend.app.services.vocabulary_service import vocabulary_service

# Phrase templates for common sign combinations
IDIOMATIC_SEQUENCES: Dict[str, Dict[str, str]] = {
    "ISL_5+ISL_OK": {
        "english": "Hello! Everything is fine and going well.",
        "telugu": "నమస్కారం! అంతా సవ్యంగా, బాగుంది.",
        "telugu_romanized": "Namaskaram! Anthaa savyangaa, baagundi."
    },
    "ISL_5+ISL_YES_THUMBS_UP": {
        "english": "Hello, yes I am ready and agree.",
        "telugu": "నమస్కారం, అవును నేను సిద్ధంగా ఉన్నాను.",
        "telugu_romanized": "Namaskaram, avunu nenu siddhangaa unnaanu."
    },
    "ISL_YES_THUMBS_UP+ISL_PEACE_VICTORY": {
        "english": "Yes, we have achieved peace and victory!",
        "telugu": "అవును, మనం శాంతిని మరియు విజయాన్ని సాధించాము!",
        "telugu_romanized": "Avunu, manam shanthini mariyu vijayaanni saadhinchaamu!"
    },
    "ISL_NO_INDEX+ISL_FIST": {
        "english": "No, please stop. Stay firm.",
        "telugu": "వద్దు, దయచేసి ఆగండి. స్థిరంగా ఉండండి.",
        "telugu_romanized": "Vaddu, dayachesi aagandi. Sthirangaa undandi."
    },
    "ISL_1+ISL_OK": {
        "english": "Number one is confirmed and good.",
        "telugu": "మొదటిది ఖరారైంది, అంతా బాగుంది.",
        "telugu_romanized": "Modatidi kharaaraindi, anthaa baagundi."
    },
    "Open_Palm+Thumb_Up": {
        "english": "Hello! Yes, that is approved.",
        "telugu": "నమస్కారం! అవును, అది ఆమోదించబడింది.",
        "telugu_romanized": "Namaskaram! Avunu, adi aamodinchabadindi."
    },
    "Thumb_Up+Victory": {
        "english": "Great job, we won with victory!",
        "telugu": "చాలా బాగుంది, మనం విజయం సాధించాము!",
        "telugu_romanized": "Chaala baagundi, manam vijayam saadhinchaamu!"
    },
    "ISL_NAMASTE_2HAND+ISL_HELP_2HAND": {
        "english": "Respectful greetings! Could you please help me?",
        "telugu": "హృదయపూర్వక నమస్కారాలు! మీరు నాకు దయచేసి సహాయం చేయగలరా?",
        "telugu_romanized": "Hrudayapoorvaka namaskaaraalu! Meeru naaku dayachesi sahaayam cheyagalaraa?"
    },
    "ISL_NAMASTE_2HAND+ISL_BOOK": {
        "english": "Greetings, let us open the study book together.",
        "telugu": "నమస్కారం, మనం కలిసి అధ్యయన పుస్తకాన్ని చదువుకుందాం.",
        "telugu_romanized": "Namaskaram, manam kalisi adhyayana pusthakaanni chaduvukundaam."
    },
    "ISL_CLAP+ISL_PEACE_VICTORY": {
        "english": "Warm applause and congratulations for our great victory!",
        "telugu": "మన గొప్ప విజయానికి ప్రశంసా చప్పట్లు మరియు అభినందనలు!",
        "telugu_romanized": "Mana goppa vijayaaniki prashamsa chappatlu mariyu abhinandanalu!"
    }
}


class SentenceTranslationService:
    def translate_signs_sequence(self, sign_tokens: List[str]) -> Dict[str, Any]:
        """
        Translates a sequence of recognized gesture/sign tokens into full sentences.
        """
        # 1. Filter and clean tokens
        clean_tokens = [t.strip() for t in sign_tokens if t and t.strip()]
        if not clean_tokens:
            return {
                "tokens": [],
                "english": "",
                "telugu": "",
                "telugu_romanized": "",
                "confidence_summary": 1.0,
                "is_idiomatic_match": False
            }

        # 2. Check for idiomatic multi-sign phrase matches (e.g. "ISL_5+ISL_OK")
        seq_key = "+".join(clean_tokens)
        if seq_key in IDIOMATIC_SEQUENCES:
            match = IDIOMATIC_SEQUENCES[seq_key]
            return {
                "tokens": clean_tokens,
                "english": match["english"],
                "telugu": match["telugu"],
                "telugu_romanized": match["telugu_romanized"],
                "is_idiomatic_match": True
            }

        # 3. Assemble composite sentence token-by-token
        en_words = []
        te_words = []
        ro_words = []

        for token in clean_tokens:
            meta = vocabulary_service.get_multilingual_mapping(token)
            # Use example sentence if single token, otherwise word translation
            if len(clean_tokens) == 1:
                g = vocabulary_service.get_gesture_by_id(token)
                if g and g.get("example_sentence_en"):
                    return {
                        "tokens": clean_tokens,
                        "english": g["example_sentence_en"],
                        "telugu": g["example_sentence_te"],
                        "telugu_romanized": g["example_sentence_ro"],
                        "is_idiomatic_match": True
                    }

            en_words.append(meta["english"])
            te_words.append(meta["telugu"])
            ro_words.append(meta["telugu_romanized"])

        # Format with proper punctuation
        en_sentence = " ".join(en_words).strip() + "."
        te_sentence = " ".join(te_words).strip() + "."
        ro_sentence = " ".join(ro_words).strip() + "."

        return {
            "tokens": clean_tokens,
            "english": en_sentence,
            "telugu": te_sentence,
            "telugu_romanized": ro_sentence,
            "is_idiomatic_match": False
        }


sentence_translation_service = SentenceTranslationService()
sentence_service = sentence_translation_service
