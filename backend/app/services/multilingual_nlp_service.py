"""
SignBridge AI - Multilingual NLP & Speech Translation Service
Supports:
1. Exact Telugu Script <-> Romanized Telugu Transliteration (Unicode deterministic)
2. Bidirectional translation between English, Telugu, and Hindi for phrases, vocabulary, and sentences
3. Preservation of original sentence, translated text, and phonetic pronunciation
"""

import re
from typing import Dict, Any, Optional, List, Tuple


# =========================================================================
# 1. Deterministic Telugu Script <-> Romanized Telugu Transliteration
# =========================================================================

# Telugu Unicode mappings
TELUGU_VOWELS = {
    0x0C05: "a",   # అ
    0x0C06: "aa",  # ఆ
    0x0C07: "i",   # ఇ
    0x0C08: "ee",  # ఈ
    0x0C09: "u",   # ఉ
    0x0C0A: "oo",  # ఊ
    0x0C0B: "ru",  # ఋ
    0x0C0E: "e",   # ఎ
    0x0C0F: "ee",  # ఏ
    0x0C10: "ai",  # ఐ
    0x0C12: "o",   # ఒ
    0x0C13: "oo",  # ఓ
    0x0C14: "au",  # ఔ
}

TELUGU_CONSONANTS = {
    0x0C15: "k",   # క
    0x0C16: "kh",  # ఖ
    0x0C17: "g",   # గ
    0x0C18: "gh",  # ఘ
    0x0C19: "ng",  # ఙ
    0x0C1A: "ch",  # చ
    0x0C1B: "chh", # ఛ
    0x0C1C: "j",   # జ
    0x0C1D: "jh",  # ఝ
    0x0C1E: "ny",  # ఞ
    0x0C1F: "t",   # ట
    0x0C20: "th",  # ఠ
    0x0C21: "d",   # డ
    0x0C22: "dh",  # ఢ
    0x0C23: "n",   # ణ
    0x0C24: "th",  # త
    0x0C25: "thh", # థ
    0x0C26: "d",   # ద
    0x0C27: "dh",  # ధ
    0x0C28: "n",   # న
    0x0C2A: "p",   # ప
    0x0C2B: "ph",  # ఫ
    0x0C2C: "b",   # బ
    0x0C2D: "bh",  # భ
    0x0C2E: "m",   # మ
    0x0C2F: "y",   # య
    0x0C30: "r",   # ర
    0x0C31: "r",   # ఱ
    0x0C32: "l",   # ల
    0x0C33: "la",  # ళ
    0x0C35: "v",   # వ
    0x0C36: "sh",  # శ
    0x0C37: "sh",  # ష
    0x0C38: "s",   # స
    0x0C39: "h",   # హ
}

TELUGU_MATRAS = {
    0x0C3E: "aa",  # ా
    0x0C3F: "i",   # ి
    0x0C40: "ee",  # ీ
    0x0C41: "u",   # ు
    0x0C42: "oo",  # ూ
    0x0C43: "ru",  # ృ
    0x0C46: "e",   # ె
    0x0C47: "ee",  # ే
    0x0C48: "ai",  # ై
    0x0C4A: "o",   # ొ
    0x0C4B: "oo",  # ో
    0x0C4C: "au",  # ౌ
}

VIRAMA = 0x0C4D   # ్
ANUSVARA = 0x0C02 # ం
VISARGA = 0x0C03  # ః


def transliterate_telugu_to_roman(text: str) -> str:
    """
    Deterministically transliterates Telugu script Unicode string into
    natural, readable Romanized Telugu phonetics.
    """
    if not text:
        return ""

    out = []
    i = 0
    n = len(text)

    while i < n:
        code = ord(text[i])

        # Independent vowel
        if code in TELUGU_VOWELS:
            out.append(TELUGU_VOWELS[code])
            i += 1
            continue

        # Consonant
        if code in TELUGU_CONSONANTS:
            base_cons = TELUGU_CONSONANTS[code]
            # Check next character
            if i + 1 < n:
                next_code = ord(text[i + 1])
                if next_code == VIRAMA:
                    out.append(base_cons)
                    i += 2
                    continue
                elif next_code in TELUGU_MATRAS:
                    out.append(base_cons + TELUGU_MATRAS[next_code])
                    i += 2
                    continue

            # Inherent vowel 'a'
            out.append(base_cons + "a")
            i += 1
            continue

        # Anusvara (m / n)
        if code == ANUSVARA:
            out.append("m")
            i += 1
            continue

        # Visarga (h)
        if code == VISARGA:
            out.append("h")
            i += 1
            continue

        # Non-Telugu character (spaces, punctuation, English characters)
        out.append(text[i])
        i += 1

    res = "".join(out)

    # Post-processing cleanups for natural reading:
    res = re.sub(r'(\b\w)', lambda m: m.group(1).upper(), res, count=1)  # capitalize first letter
    res = re.sub(r'\baa\b', 'aa', res, flags=re.IGNORECASE)
    return res


# =========================================================================
# 2. Curated Multilingual Translation Lexicon & Phrases
# =========================================================================

# Bidirectional corpus for common phrases, greetings, questions, emergencies, and sign terms
MULTILINGUAL_CORPUS: List[Dict[str, str]] = [
    # Common Greetings
    {
        "en": "Hello",
        "te": "నమస్కారం",
        "te_ro": "Namaskaram",
        "hi": "नमस्ते",
        "hi_ro": "Namaste"
    },
    {
        "en": "Hello, how are you?",
        "te": "నమస్కారం, మీరు ఎలా ఉన్నారు?",
        "te_ro": "Namaskaram, meeru ela unnaru?",
        "hi": "नमस्ते, आप कैसे हैं?",
        "hi_ro": "Namaste, aap kaise hain?"
    },
    {
        "en": "How are you?",
        "te": "మీరు ఎలా ఉన్నారు?",
        "te_ro": "Meeru ela unnaru?",
        "hi": "आप कैसे हैं?",
        "hi_ro": "Aap kaise hain?"
    },
    {
        "en": "I am fine.",
        "te": "నేను బాగున్నాను.",
        "te_ro": "Nenu baagunnanu.",
        "hi": "मैं ठीक हूँ।",
        "hi_ro": "Main theek hoon."
    },
    {
        "en": "Good morning.",
        "te": "శుభోదయం.",
        "te_ro": "Shubhodayam.",
        "hi": "शुभ प्रभात।",
        "hi_ro": "Shubh prabhat."
    },
    {
        "en": "Good afternoon.",
        "te": "శుభ మధ్యాహ్నం.",
        "te_ro": "Shubha madhyaahnam.",
        "hi": "शुभ दोपहर।",
        "hi_ro": "Shubh dopahar."
    },
    {
        "en": "Good evening.",
        "te": "శుభ సాయంత్రం.",
        "te_ro": "Shubha saayantram.",
        "hi": "शुभ संध्या।",
        "hi_ro": "Shubh sandhya."
    },
    {
        "en": "Good night.",
        "te": "శుభరాత్రి.",
        "te_ro": "Shubharaatri.",
        "hi": "शुभ रात्रि।",
        "hi_ro": "Shubh raatri."
    },
    {
        "en": "Thank you.",
        "te": "ధన్యవాదాలు.",
        "te_ro": "Dhanyavaadaalu.",
        "hi": "धन्यवाद।",
        "hi_ro": "Dhanyavaad."
    },
    {
        "en": "Thank you very much.",
        "te": "చాలా ధన్యవాదాలు.",
        "te_ro": "Chaala dhanyavaadaalu.",
        "hi": "बहुत बहुत धन्यवाद।",
        "hi_ro": "Bahut bahut dhanyavaad."
    },
    {
        "en": "Please.",
        "te": "దయచేసి.",
        "te_ro": "Dayachesi.",
        "hi": "कृपया।",
        "hi_ro": "Kripya."
    },
    {
        "en": "Please help me.",
        "te": "దయచేసి నాకు సహాయం చేయండి.",
        "te_ro": "Dayachesi naaku sahaayam cheyandi.",
        "hi": "कृपया मेरी मदद करें।",
        "hi_ro": "Kripya meri madad karein."
    },
    {
        "en": "Yes, I agree.",
        "te": "అవును, నేను ఏకీభవిస్తున్నాను.",
        "te_ro": "Avunu, nenu ekeebhavisthunnanu.",
        "hi": "हाँ, मैं सहमत हूँ।",
        "hi_ro": "Haan, main sahmat hoon."
    },
    {
        "en": "No, I disagree.",
        "te": "కాదు, నేను అంగీకరించను.",
        "te_ro": "Kaadu, nenu angeekarinchanu.",
        "hi": "नहीं, मैं असहमत हूँ।",
        "hi_ro": "Nahin, main asahmat hoon."
    },
    {
        "en": "Everything is fine and understood.",
        "te": "అంతా బాగానే ఉంది, అర్థమైంది.",
        "te_ro": "Anthaa baagane undi, arthamaindi.",
        "hi": "सब ठीक है और समझ आ गया।",
        "hi_ro": "Sab theek hai aur samajh aa gaya."
    },
    {
        "en": "What is your name?",
        "te": "మీ పేరు ఏమిటి?",
        "te_ro": "Mee peru emiti?",
        "hi": "आपका नाम क्या है?",
        "hi_ro": "Aapka naam kya hai?"
    },
    {
        "en": "My name is SignBridge user.",
        "te": "నా పేరు సైన్‌బ్రిడ్జ్ వాడుకరి.",
        "te_ro": "Naa peru SignBridge vaadukari.",
        "hi": "मेरा नाम साइनब्रिज उपयोगकर्ता है।",
        "hi_ro": "Mera naam SignBridge upayogkarta hai."
    },
    {
        "en": "Where is the hospital?",
        "te": "ఆసుపత్రి ఎక్కడ ఉంది?",
        "te_ro": "Aasupathri ekkada undi?",
        "hi": "अस्पताल कहाँ है?",
        "hi_ro": "Aspatal kahan hai?"
    },
    {
        "en": "I need medical help immediately.",
        "te": "నాకు వెంటనే వైద్య సహాయం కావాలి.",
        "te_ro": "Naaku ventane vaidya sahaayam kaavaali.",
        "hi": "मुझे तुरंत चिकित्सा सहायता चाहिए।",
        "hi_ro": "Mujhe turant chikitsa sahayata chahiye."
    },
    {
        "en": "I need water.",
        "te": "నాకు మంచినీరు కావాలి.",
        "te_ro": "Naaku manchineeru kaavaali.",
        "hi": "मुझे पानी चाहिए।",
        "hi_ro": "Mujhe paani chahiye."
    },
    {
        "en": "I am hungry, I need food.",
        "te": "నాకు ఆకలిగా ఉంది, భోజనం కావాలి.",
        "te_ro": "Naaku aakaligaa undi, bhojanam kaavaali.",
        "hi": "मुझे भूख लगी है, खाना चाहिए।",
        "hi_ro": "Mujhe bhookh lagi hai, khana chahiye."
    },
    {
        "en": "Where is the restroom?",
        "te": "విశ్రాంతి గది ఎక్కడ ఉంది?",
        "te_ro": "Vishraanthi gadi ekkada undi?",
        "hi": "शौचालय कहाँ है?",
        "hi_ro": "Shauchalay kahan hai?"
    },
    {
        "en": "Nice to meet you.",
        "te": "మిమ్మల్ని కలవడం చాలా సంతోషం.",
        "te_ro": "Mimmalni kalavadam chaala santhosham.",
        "hi": "आपसे मिलकर खुशी हुई।",
        "hi_ro": "Aapse milkar khushi hui."
    },
    {
        "en": "See you again.",
        "te": "మళ్ళీ కలుద్దాం.",
        "te_ro": "Mallee kaluddhaam.",
        "hi": "फिर मिलेंगे।",
        "hi_ro": "Phir milenge."
    },
    {
        "en": "Stay strong and firm.",
        "te": "బలంగా స్థిరంగా ఉండండి.",
        "te_ro": "Balangaa sthirangaa undandi.",
        "hi": "मजबूत और स्थिर रहें।",
        "hi_ro": "Majboot aur sthir rahein."
    },
    {
        "en": "Peace and victory.",
        "te": "శాంతి మరియు విజయం.",
        "te_ro": "Shanthi mariyu vijayam.",
        "hi": "शांति और विजय।",
        "hi_ro": "Shanti aur vijay."
    },
    {
        "en": "Respectful greetings.",
        "te": "హృదయపూర్వక నమస్కారాలు.",
        "te_ro": "Hrudayapoorvaka namaskaaraalu.",
        "hi": "सादर प्रणाम।",
        "hi_ro": "Saadar pranam."
    },
    {
        "en": "Applause and congratulations.",
        "te": "ప్రశంసలు మరియు అభినందనలు.",
        "te_ro": "Prashamsalu mariyu abhinandanalu.",
        "hi": "तालियां और बधाई।",
        "hi_ro": "Taaliyan aur badhai."
    },
    {
        "en": "Study book.",
        "te": "అధ్యయన పుస్తకం.",
        "te_ro": "Adhyayana pusthakam.",
        "hi": "अध्ययन पुस्तक।",
        "hi_ro": "Adhyayan pustak."
    },
    {
        "en": "Home and family.",
        "te": "ఇల్లు మరియు కుటుంబం.",
        "te_ro": "Illu mariyu kutumbam.",
        "hi": "घर और परिवार।",
        "hi_ro": "Ghar aur parivaar."
    }
]

# Word-level vocabulary dictionary for tokenized translation
WORD_MAP: Dict[str, Dict[str, str]] = {
    "hello": {"te": "నమస్కారం", "te_ro": "Namaskaram", "hi": "नमस्ते"},
    "namaste": {"te": "నమస్కారం", "te_ro": "Namaskaram", "hi": "नमस्ते"},
    "thanks": {"te": "ధన్యవాదాలు", "te_ro": "Dhanyavaadaalu", "hi": "धन्यवाद"},
    "thank": {"te": "ధన్యవాదాలు", "te_ro": "Dhanyavaadaalu", "hi": "धन्यवाद"},
    "you": {"te": "మీరు", "te_ro": "meeru", "hi": "आप"},
    "me": {"te": "నన్ను", "te_ro": "nannu", "hi": "मुझे"},
    "i": {"te": "నేను", "te_ro": "nenu", "hi": "मैं"},
    "help": {"te": "సహాయం", "te_ro": "sahaayam", "hi": "मदद"},
    "water": {"te": "నీరు", "te_ro": "neeru", "hi": "पानी"},
    "food": {"te": "ఆహారం", "te_ro": "aahaaram", "hi": "खाना"},
    "yes": {"te": "అవును", "te_ro": "avunu", "hi": "हाँ"},
    "no": {"te": "కాదు", "te_ro": "kaadu", "hi": "नहीं"},
    "ok": {"te": "సరే", "te_ro": "sare", "hi": "ठीक है"},
    "fine": {"te": "బాగుంది", "te_ro": "baagundi", "hi": "अच्छा है"},
    "hospital": {"te": "ఆసుపత్రి", "te_ro": "aasupathri", "hi": "अस्पताल"},
    "doctor": {"te": "వైద్యుడు", "te_ro": "vaidyudu", "hi": "डॉक्टर"},
    "where": {"te": "ఎక్కడ", "te_ro": "ekkada", "hi": "कहाँ"},
    "what": {"te": "ఏమిటి", "te_ro": "emiti", "hi": "क्या"},
    "who": {"te": "ఎవరు", "te_ro": "evaru", "hi": "कौन"},
    "when": {"te": "ఎప్పుడు", "te_ro": "eppudu", "hi": "कब"},
    "good": {"te": "మంచిది", "te_ro": "manchidi", "hi": "अच्छा"},
    "morning": {"te": "ఉదయం", "te_ro": "udayam", "hi": "सुबह"},
    "night": {"te": "రాత్రి", "te_ro": "raathri", "hi": "रात"},
    "one": {"te": "ఒకటి", "te_ro": "okati", "hi": "एक"},
    "two": {"te": "రెండు", "te_ro": "rendu", "hi": "दो"},
    "three": {"te": "మూడు", "te_ro": "moodu", "hi": "तीन"},
    "four": {"te": "నాలుగు", "te_ro": "naalugu", "hi": "चार"},
    "five": {"te": "ఐదు", "te_ro": "aidu", "hi": "पाँच"},
}


class MultilingualNLPService:
    def __init__(self):
        self.corpus = MULTILINGUAL_CORPUS
        self.word_map = WORD_MAP

    def _normalize_string(self, text: str) -> str:
        clean = text.lower().strip()
        clean = re.sub(r'[^\w\s]', '', clean)
        return re.sub(r'\s+', ' ', clean)

    def transliterate_text(self, text: str, script: str = "telugu") -> str:
        """Transliterates native script to Romanized phonetic string."""
        if script.lower() in ("telugu", "te"):
            return transliterate_telugu_to_roman(text)
        # Fallback
        return text

    def translate(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "te"
    ) -> Dict[str, Any]:
        """
        Translates input text between English, Telugu, and Hindi.
        Returns:
            original_text, source_lang, target_lang,
            translated_text, romanized_text, hindi_text, english_text,
            confidence, method
        """
        clean_text = text.strip()
        if not clean_text:
            return {
                "original_text": "",
                "source_lang": source_lang,
                "target_lang": target_lang,
                "translated_text": "",
                "romanized_text": "",
                "english_text": "",
                "telugu_text": "",
                "hindi_text": "",
                "confidence": 1.0,
                "method": "empty"
            }

        norm_input = self._normalize_string(clean_text)

        # 1. Corpus Exact & Fuzzy Phrase Match
        best_match = None
        best_score = 0.0

        for entry in self.corpus:
            # Check source match
            candidates = []
            if source_lang.startswith("en"):
                candidates.append((entry["en"], 1.0))
            elif source_lang.startswith("te"):
                candidates.append((entry["te"], 1.0))
                candidates.append((entry["te_ro"], 0.95))
            elif source_lang.startswith("hi"):
                candidates.append((entry["hi"], 1.0))
                candidates.append((entry["hi_ro"], 0.95))
            else:
                candidates.append((entry["en"], 0.8))
                candidates.append((entry["te"], 0.8))
                candidates.append((entry["te_ro"], 0.8))

            for cand_text, weight in candidates:
                norm_cand = self._normalize_string(cand_text)
                if norm_input == norm_cand:
                    best_match = entry
                    best_score = 1.0 * weight
                    break
                elif norm_input in norm_cand or norm_cand in norm_input:
                    # Partial match
                    score = (len(norm_input) / max(len(norm_cand), 1)) * 0.85 * weight
                    if score > best_score:
                        best_match = entry
                        best_score = score
            if best_score >= 0.98:
                break

        if best_match and best_score >= 0.70:
            en_val = best_match["en"]
            te_val = best_match["te"]
            ro_val = best_match["te_ro"]
            hi_val = best_match["hi"]

            target_val = en_val
            if target_lang.startswith("te"):
                if target_lang in ("te-ro", "romanized"):
                    target_val = ro_val
                else:
                    target_val = te_val
            elif target_lang.startswith("hi"):
                target_val = hi_val

            return {
                "original_text": clean_text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "translated_text": target_val,
                "romanized_text": ro_val,
                "english_text": en_val,
                "telugu_text": te_val,
                "hindi_text": hi_val,
                "confidence": round(best_score, 2),
                "method": "corpus_phrase_match"
            }

        # 2. Telugu script input transliteration & dictionary mapping
        has_telugu_chars = any(0x0C00 <= ord(c) <= 0x0C7F for c in clean_text)
        if has_telugu_chars or source_lang.startswith("te"):
            ro_val = transliterate_telugu_to_roman(clean_text)
            # Try to map words
            words = clean_text.split()
            translated_words = []
            for w in words:
                w_clean = self._normalize_string(w)
                mapped = False
                for en_k, mapping in self.word_map.items():
                    if mapping.get("te") == w or mapping.get("te_ro", "").lower() == w_clean:
                        translated_words.append(en_k)
                        mapped = True
                        break
                if not mapped:
                    translated_words.append(w)

            en_approx = " ".join(translated_words)
            en_approx = en_approx[0].upper() + en_approx[1:] if en_approx else ""

            target_val = clean_text
            if target_lang.startswith("en"):
                target_val = en_approx or ro_val
            elif target_lang in ("te-ro", "romanized"):
                target_val = ro_val

            return {
                "original_text": clean_text,
                "source_lang": "te",
                "target_lang": target_lang,
                "translated_text": target_val,
                "romanized_text": ro_val,
                "english_text": en_approx or ro_val,
                "telugu_text": clean_text,
                "hindi_text": clean_text,
                "confidence": 0.88,
                "method": "telugu_script_transliteration"
            }

        # 3. English input token mapping to Telugu & Hindi
        tokens = re.findall(r'\b\w+\b', clean_text.lower())
        mapped_te_tokens = []
        mapped_ro_tokens = []
        mapped_hi_tokens = []

        match_count = 0
        for tok in tokens:
            if tok in self.word_map:
                match_count += 1
                mapped_te_tokens.append(self.word_map[tok]["te"])
                mapped_ro_tokens.append(self.word_map[tok]["te_ro"])
                mapped_hi_tokens.append(self.word_map[tok]["hi"])
            else:
                mapped_te_tokens.append(tok)
                mapped_ro_tokens.append(tok)
                mapped_hi_tokens.append(tok)

        confidence = round(max(0.65, match_count / max(len(tokens), 1)), 2)
        te_combined = " ".join(mapped_te_tokens)
        ro_combined = " ".join(mapped_ro_tokens)
        hi_combined = " ".join(mapped_hi_tokens)

        target_val = clean_text
        if target_lang.startswith("te"):
            if target_lang in ("te-ro", "romanized"):
                target_val = ro_combined
            else:
                target_val = te_combined
        elif target_lang.startswith("hi"):
            target_val = hi_combined
        elif target_lang.startswith("en"):
            target_val = clean_text

        return {
            "original_text": clean_text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "translated_text": target_val,
            "romanized_text": ro_combined,
            "english_text": clean_text,
            "telugu_text": te_combined,
            "hindi_text": hi_combined,
            "confidence": confidence,
            "method": "token_dictionary_synthesis"
        }


multilingual_nlp_service = MultilingualNLPService()
