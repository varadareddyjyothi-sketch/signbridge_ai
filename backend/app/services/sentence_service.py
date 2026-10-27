"""
SignBridge AI - Smart Sentence Formation & Grammar Engine
Translates sequential gesture/sign streams into coherent, grammatically structured
English, Telugu script, and Romanized Telugu sentences.

Architectural Separation:
1. Sign-to-Meaning Mapper (lexical role, gloss, canonical labels)
2. Grammar Engine (intent recognition, punctuation, agreement, disambiguation)
3. Sentence Translation Service (composite sentence generation and review)
"""

from typing import List, Dict, Any, Optional
from backend.app.services.vocabulary_service import vocabulary_service


# Grammatical token roles and lexical metadata
SIGN_LEXICAL_METADATA: Dict[str, Dict[str, Any]] = {
    "ISL_1": {
        "gloss": "ONE",
        "role": "numeral",
        "count": 1,
        "en": "one",
        "te": "ఒకటి",
        "ro": "okati"
    },
    "ISL_2": {
        "gloss": "TWO",
        "role": "numeral",
        "count": 2,
        "en": "two",
        "te": "రెండు",
        "ro": "rendu"
    },
    "ISL_3": {
        "gloss": "THREE",
        "role": "numeral",
        "count": 3,
        "en": "three",
        "te": "మూడు",
        "ro": "moodu"
    },
    "ISL_4": {
        "gloss": "FOUR",
        "role": "numeral",
        "count": 4,
        "en": "four",
        "te": "నాలుగు",
        "ro": "naalugu"
    },
    "ISL_5": {
        "gloss": "FIVE_OR_HELLO",
        "role": "greeting_or_numeral",
        "count": 5,
        "en": "hello",
        "te": "నమస్కారం",
        "ro": "namaskaram"
    },
    "ISL_OK": {
        "gloss": "OK_FINE",
        "role": "affirmation",
        "en": "everything is fine and understood",
        "te": "అంతా బాగానే ఉంది, అర్థమైంది",
        "ro": "anthaa baagane undi, arthamaindi"
    },
    "ISL_YES_THUMBS_UP": {
        "gloss": "YES_AGREE",
        "role": "affirmation",
        "en": "yes, I agree",
        "te": "అవును, నేను ఏకీభవిస్తున్నాను",
        "ro": "avunu, nenu ekeebhavisthunnanu"
    },
    "ISL_NO_INDEX": {
        "gloss": "NO_DISAGREE",
        "role": "negation",
        "en": "no, I disagree",
        "te": "కాదు / వద్దు",
        "ro": "kaadu / vaddu"
    },
    "ISL_PEACE_VICTORY": {
        "gloss": "PEACE_VICTORY",
        "role": "sentiment",
        "en": "peace and victory",
        "te": "శాంతి మరియు విజయం",
        "ro": "shanthi mariyu vijayam"
    },
    "ISL_FIST": {
        "gloss": "STRENGTH",
        "role": "sentiment",
        "en": "stay strong and firm",
        "te": "బలంగా స్థిరంగా ఉండండి",
        "ro": "balangaa sthirangaa undandi"
    },
    "ISL_NAMASTE_2HAND": {
        "gloss": "NAMASTE",
        "role": "greeting",
        "en": "respectful greetings",
        "te": "హృదయపూర్వక నమస్కారాలు",
        "ro": "hrudayapoorvaka namaskaaraalu"
    },
    "ISL_HELP_2HAND": {
        "gloss": "HELP",
        "role": "request",
        "en": "please help me",
        "te": "దయచేసి నాకు సహాయం చేయండి",
        "ro": "dayachesi naaku sahaayam cheyandi"
    },
    "ISL_BOOK": {
        "gloss": "BOOK_STUDY",
        "role": "noun",
        "en": "study book",
        "te": "అధ్యయన పుస్తకం",
        "ro": "adhyayana pusthakam"
    },
    "ISL_HOUSE": {
        "gloss": "HOUSE_HOME",
        "role": "noun",
        "en": "home",
        "te": "ఇల్లు / నివాసం",
        "ro": "illu / nivaasam"
    },
    "ISL_CLAP": {
        "gloss": "APPLAUSE",
        "role": "sentiment",
        "en": "warm applause and appreciation",
        "te": "ప్రశంసా చప్పట్లు మరియు అభినందనలు",
        "ro": "prashamsa chappatlu mariyu abhinandanalu"
    },
    "ISL_THANK_YOU_DYNAMIC": {
        "gloss": "THANK_YOU",
        "role": "politeness",
        "en": "thank you very much",
        "te": "చాలా ధన్యవాదాలు",
        "ro": "chaala dhanyavaadaalu"
    },
    "ISL_PLEASE_DYNAMIC": {
        "gloss": "PLEASE",
        "role": "politeness",
        "en": "please",
        "te": "దయచేసి",
        "ro": "dayachesi"
    },
    # General pretrained gestures
    "Open_Palm": {
        "gloss": "HELLO",
        "role": "greeting",
        "en": "hello",
        "te": "నమస్కారం",
        "ro": "namaskaram"
    },
    "Thumb_Up": {
        "gloss": "APPROVE",
        "role": "affirmation",
        "en": "yes, approved and good",
        "te": "అవును, ఆమోదించబడింది",
        "ro": "avunu, aamodinchabadindi"
    },
    "Thumb_Down": {
        "gloss": "DISAPPROVE",
        "role": "negation",
        "en": "no, I disagree",
        "te": "కాదు, నేను విభేదిస్తున్నాను",
        "ro": "kaadu, nenu vibhedisthunnanu"
    },
    "Victory": {
        "gloss": "VICTORY",
        "role": "sentiment",
        "en": "victory and peace",
        "te": "విజయం మరియు శాంతి",
        "ro": "vijayam mariyu shanthi"
    },
    "Pointing_Up": {
        "gloss": "POINT_UP",
        "role": "directional",
        "en": "please look here",
        "te": "దయచేసి ఇక్కడ చూడండి",
        "ro": "dayachesi ikkada choodandi"
    },
    "Closed_Fist": {
        "gloss": "FIST",
        "role": "sentiment",
        "en": "holding firm with strength",
        "te": "శక్తితో స్థిరంగా నిలబడండి",
        "ro": "shakthitho sthirangaa nilabadandi"
    },
    "ILoveYou": {
        "gloss": "LOVE",
        "role": "sentiment",
        "en": "sending love and care",
        "te": "ప్రేమ మరియు ఆప్యాయత",
        "ro": "prema mariyu aapyayatha"
    },
    # Common conversational tokens and standard sign labels
    "HELLO": {
        "gloss": "HELLO",
        "role": "greeting",
        "en": "hello",
        "te": "హలో / నమస్కారం",
        "ro": "halo / namaskaram"
    },
    "HI": {
        "gloss": "HI",
        "role": "greeting",
        "en": "hi",
        "te": "హాయ్",
        "ro": "haay"
    },
    "ISL_NAMASTE": {
        "gloss": "NAMASTE",
        "role": "greeting",
        "en": "namaste, respectful greetings",
        "te": "నమస్కారం, గౌరవపూర్వక వందనాలు",
        "ro": "namaskaram, gowravapoorvaka vandanaalu"
    },
    "NAMASTE": {
        "gloss": "NAMASTE",
        "role": "greeting",
        "en": "namaste",
        "te": "నమస్కారం",
        "ro": "namaskaram"
    },
    "YES": {
        "gloss": "YES",
        "role": "affirmation",
        "en": "yes",
        "te": "అవును",
        "ro": "avunu"
    },
    "NO": {
        "gloss": "NO",
        "role": "negation",
        "en": "no",
        "te": "కాదు / లేదు",
        "ro": "kaadu / ledu"
    },
    "NOT": {
        "gloss": "NOT",
        "role": "negation",
        "en": "not",
        "te": "కాదు",
        "ro": "kaadu"
    },
    "PLEASE": {
        "gloss": "PLEASE",
        "role": "request",
        "en": "please",
        "te": "దయచేసి",
        "ro": "dayachesi"
    },
    "HELP": {
        "gloss": "HELP",
        "role": "request",
        "en": "help",
        "te": "సహాయం",
        "ro": "sahaayam"
    },
    "THANK_YOU": {
        "gloss": "THANK_YOU",
        "role": "politeness",
        "en": "thank you",
        "te": "ధన్యవాదాలు",
        "ro": "dhanyavaadaalu"
    },
    "WATER": {
        "gloss": "WATER",
        "role": "noun",
        "en": "water",
        "te": "నీరు / మంచినీరు",
        "ro": "neeru / manchineeru"
    },
    "FOOD": {
        "gloss": "FOOD",
        "role": "noun",
        "en": "food",
        "te": "ఆహారం",
        "ro": "aahaaram"
    },
    "WHERE": {
        "gloss": "WHERE",
        "role": "question",
        "en": "where",
        "te": "ఎక్కడ",
        "ro": "ekkada"
    },
    "WHAT": {
        "gloss": "WHAT",
        "role": "question",
        "en": "what",
        "te": "ఏమిటి",
        "ro": "emiti"
    },
    "WHO": {
        "gloss": "WHO",
        "role": "question",
        "en": "who",
        "te": "ఎవరు",
        "ro": "evaru"
    },
    "HOW": {
        "gloss": "HOW",
        "role": "question",
        "en": "how",
        "te": "ఎలా",
        "ro": "elaa"
    },
    "WHEN": {
        "gloss": "WHEN",
        "role": "question",
        "en": "when",
        "te": "ఎప్పుడు",
        "ro": "eppudu"
    },
    "WHY": {
        "gloss": "WHY",
        "role": "question",
        "en": "why",
        "te": "ఎందుకు",
        "ro": "enduku"
    },
    "BUS": {
        "gloss": "BUS",
        "role": "noun",
        "en": "bus",
        "te": "బస్సు",
        "ro": "bassu"
    },
    "STOP": {
        "gloss": "STOP",
        "role": "noun",
        "en": "stop",
        "te": "స్టాప్",
        "ro": "staap"
    },
    "YOU": {
        "gloss": "YOU",
        "role": "pronoun",
        "en": "you",
        "te": "మీరు",
        "ro": "meeru"
    },
    "I": {
        "gloss": "I",
        "role": "pronoun",
        "en": "I",
        "te": "నేను",
        "ro": "nenu"
    },
    "ME": {
        "gloss": "ME",
        "role": "pronoun",
        "en": "me",
        "te": "నాకు / నన్ను",
        "ro": "naaku / nannu"
    },
    "NAME": {
        "gloss": "NAME",
        "role": "noun",
        "en": "name",
        "te": "పేరు",
        "ro": "peru"
    },
    "FINE": {
        "gloss": "FINE",
        "role": "statement",
        "en": "fine and good",
        "te": "బాగున్నాను",
        "ro": "baagunnaanu"
    }
}


# Idiomatic multi-sign phrase mappings from verified ISL and multi-gesture combinations
IDIOMATIC_SEQUENCES: Dict[str, Dict[str, Any]] = {
    # Target conversational questions and requests
    "WHERE+BUS+STOP": {
        "english": "Where is the bus stop?",
        "telugu": "బస్సు స్టాప్ ఎక్కడ ఉంది?",
        "telugu_romanized": "Bassu staap ekkada undi?",
        "intent": "question",
        "punctuation": "?"
    },
    "WHO+YOU": {
        "english": "Who are you?",
        "telugu": "మీరు ఎవరు?",
        "telugu_romanized": "Meeru evaru?",
        "intent": "question",
        "punctuation": "?"
    },
    "HOW+YOU": {
        "english": "How are you?",
        "telugu": "మీరు ఎలా ఉన్నారు?",
        "telugu_romanized": "Meeru elaa unnaaru?",
        "intent": "question",
        "punctuation": "?"
    },
    "HELLO+HOW+YOU": {
        "english": "Hello, how are you?",
        "telugu": "హలో, మీరు ఎలా ఉన్నారు?",
        "telugu_romanized": "Halo, meeru elaa unnaaru?",
        "intent": "question",
        "punctuation": "?"
    },
    "PLEASE+HELP": {
        "english": "Please help me.",
        "telugu": "దయచేసి నాకు సహాయం చేయండి.",
        "telugu_romanized": "Dayachesi naaku sahaayam cheyandi.",
        "intent": "request",
        "punctuation": "."
    },
    "PLEASE+WATER": {
        "english": "Please give me water.",
        "telugu": "దయచేసి నాకు మంచి నీరు ఇవ్వండి.",
        "telugu_romanized": "Dayachesi naaku manchi neeru ivvandi.",
        "intent": "request",
        "punctuation": "."
    },
    "HELLO+THANK_YOU": {
        "english": "Hello, thank you!",
        "telugu": "నమస్కారం, ధన్యవాదాలు!",
        "telugu_romanized": "Namaskaram, dhanyavaadaalu!",
        "intent": "greeting",
        "punctuation": "!"
    },
    "WHAT+NAME": {
        "english": "What is your name?",
        "telugu": "మీ పేరు ఏమిటి?",
        "telugu_romanized": "Mee peru emiti?",
        "intent": "question",
        "punctuation": "?"
    },
    "WHAT+YOUR+NAME": {
        "english": "What is your name?",
        "telugu": "మీ పేరు ఏమిటి?",
        "telugu_romanized": "Mee peru emiti?",
        "intent": "question",
        "punctuation": "?"
    },
    # Greetings & Check-ins
    "ISL_5+ISL_OK": {
        "english": "Hello! Everything is fine and going well.",
        "telugu": "నమస్కారం! అంతా సవ్యంగా, బాగుంది.",
        "telugu_romanized": "Namaskaram! Anthaa savyangaa, baagundi.",
        "intent": "greeting",
        "punctuation": "."
    },
    "ISL_5+ISL_YES_THUMBS_UP": {
        "english": "Hello, yes I am ready and agree.",
        "telugu": "నమస్కారం, అవును నేను సిద్ధంగా ఉన్నాను.",
        "telugu_romanized": "Namaskaram, avunu nenu siddhangaa unnaanu.",
        "intent": "affirmation",
        "punctuation": "."
    },
    "ISL_5+ISL_NO_INDEX": {
        "english": "Hello, but no, I disagree.",
        "telugu": "నమస్కారం, కానీ కాదు, నేను విభేదిస్తున్నాను.",
        "telugu_romanized": "Namaskaram, kaanee kaadu, nenu vibhedisthunnanu.",
        "intent": "negation",
        "punctuation": "."
    },
    "ISL_5+ISL_HELP_2HAND": {
        "english": "Hello, can you please help me?",
        "telugu": "నమస్కారం, మీరు నాకు సహాయం చేయగలరా?",
        "telugu_romanized": "Namaskaram, meeru naaku sahaayam cheyagalaraa?",
        "intent": "question",
        "punctuation": "?"
    },
    "ISL_NAMASTE_2HAND+ISL_HELP_2HAND": {
        "english": "Respectful greetings! Could you please help me?",
        "telugu": "హృదయపూర్వక నమస్కారాలు! మీరు నాకు దయచేసి సహాయం చేయగలరా?",
        "telugu_romanized": "Hrudayapoorvaka namaskaaraalu! Meeru naaku dayachesi sahaayam cheyagalaraa?",
        "intent": "request",
        "punctuation": "?"
    },
    "ISL_NAMASTE_2HAND+ISL_BOOK": {
        "english": "Greetings, let us open the study book together.",
        "telugu": "నమస్కారం, మనం కలిసి అధ్యయన పుస్తకాన్ని చదువుకుందాం.",
        "telugu_romanized": "Namaskaram, manam kalisi adhyayana pusthakaanni chaduvukundaam.",
        "intent": "statement",
        "punctuation": "."
    },
    "ISL_NAMASTE_2HAND+ISL_HOUSE": {
        "english": "Respectful greetings and welcome to our home.",
        "telugu": "హృదయపూర్వక నమస్కారాలు, మా ఇంటికి స్వాగతం.",
        "telugu_romanized": "Hrudayapoorvaka namaskaaraalu, maa intiki swagatham.",
        "intent": "greeting",
        "punctuation": "."
    },

    # Requests & Actions
    "ISL_PLEASE_DYNAMIC+ISL_HELP_2HAND": {
        "english": "Please help me.",
        "telugu": "దయచేసి నాకు సహాయం చేయండి.",
        "telugu_romanized": "Dayachesi naaku sahaayam cheyandi.",
        "intent": "request",
        "punctuation": "."
    },
    "ISL_HELP_2HAND+ISL_HOUSE": {
        "english": "Please help me reach my home safely.",
        "telugu": "దయచేసి నేను సురక్షితంగా ఇంటికి చేరుకోవడానికి సహాయం చేయండి.",
        "telugu_romanized": "Dayachesi nenu surakshitangaa intiki cherukovaadaniki sahaayam cheyandi.",
        "intent": "request",
        "punctuation": "."
    },
    "ISL_HELP_2HAND+ISL_BOOK": {
        "english": "Could you please help me with this study book?",
        "telugu": "ఈ అధ్యయన పుస్తకం విషయంలో మీరు నాకు సహాయం చేయగలరా?",
        "telugu_romanized": "Ee adhyayana pusthakam vishayamlo meeru naaku sahaayam cheyagalaraa?",
        "intent": "question",
        "punctuation": "?"
    },

    # Counts & Objects
    "ISL_1+ISL_BOOK": {
        "english": "I need one study book.",
        "telugu": "నాకు ఒక అధ్యయన పుస్తకం కావాలి.",
        "telugu_romanized": "Naaku oka adhyayana pusthakam kaavaali.",
        "intent": "statement",
        "punctuation": "."
    },
    "ISL_2+ISL_BOOK": {
        "english": "I need two study books.",
        "telugu": "నాకు రెండు అధ్యయన పుస్తకాలు కావాలి.",
        "telugu_romanized": "Naaku rendu adhyayana pusthakaalu kaavaali.",
        "intent": "statement",
        "punctuation": "."
    },
    "ISL_3+ISL_BOOK": {
        "english": "I need three study books.",
        "telugu": "నాకు మూడు అధ్యయన పుస్తకాలు కావాలి.",
        "telugu_romanized": "Naaku moodu adhyayana pusthakaalu kaavaali.",
        "intent": "statement",
        "punctuation": "."
    },
    "ISL_1+ISL_HOUSE": {
        "english": "One house is located here.",
        "telugu": "ఒక ఇల్లు ఇక్కడ ఉంది.",
        "telugu_romanized": "Oka illu ikkada undi.",
        "intent": "statement",
        "punctuation": "."
    },
    "ISL_1+ISL_OK": {
        "english": "Number one is confirmed and good.",
        "telugu": "మొదటిది ఖరారైంది, అంతా బాగుంది.",
        "telugu_romanized": "Modatidi kharaaraindi, anthaa baagundi.",
        "intent": "statement",
        "punctuation": "."
    },

    # Affirmation & Negation
    "ISL_OK+ISL_YES_THUMBS_UP": {
        "english": "Yes, everything is understood and confirmed.",
        "telugu": "అవును, అంతా అర్థమైంది మరియు ఖరారైంది.",
        "telugu_romanized": "Avunu, anthaa arthamaindi mariyu kharaaraindi.",
        "intent": "affirmation",
        "punctuation": "."
    },
    "ISL_YES_THUMBS_UP+ISL_PEACE_VICTORY": {
        "english": "Yes, we have achieved peace and victory!",
        "telugu": "అవును, మనం శాంతిని మరియు విజయాన్ని సాధించాము!",
        "telugu_romanized": "Avunu, manam shanthini mariyu vijayaanni saadhinchaamu!",
        "intent": "affirmation",
        "punctuation": "!"
    },
    "ISL_NO_INDEX+ISL_FIST": {
        "english": "No, please stop. Stay firm.",
        "telugu": "వద్దు, దయచేసి ఆగండి. స్థిరంగా ఉండండి.",
        "telugu_romanized": "Vaddu, dayachesi aagandi. Sthirangaa undandi.",
        "intent": "negation",
        "punctuation": "."
    },
    "ISL_NO_INDEX+ISL_OK": {
        "english": "No, that is not acceptable.",
        "telugu": "కాదు, అది ఆమోదయోగ్యం కాదు.",
        "telugu_romanized": "Kaadu, adi aamodayogyam kaadu.",
        "intent": "negation",
        "punctuation": "."
    },

    # Celebrations & Appreciation
    "ISL_CLAP+ISL_PEACE_VICTORY": {
        "english": "Warm applause and congratulations for our great victory!",
        "telugu": "మన గొప్ప విజయానికి ప్రశంసా చప్పట్లు మరియు అభినందనలు!",
        "telugu_romanized": "Mana goppa vijayaaniki prashamsa chappatlu mariyu abhinandanalu!",
        "intent": "statement",
        "punctuation": "!"
    },
    "ISL_CLAP+ISL_OK": {
        "english": "Great job, well done and applause!",
        "telugu": "చాలా మంచి పని, అభినందనలు మరియు చప్పట్లు!",
        "telugu_romanized": "Chaala manchi pani, abhinandanalu mariyu chappatlu!",
        "intent": "statement",
        "punctuation": "!"
    },
    "Open_Palm+Thumb_Up": {
        "english": "Hello! Yes, that is approved.",
        "telugu": "నమస్కారం! అవును, అది ఆమోదించబడింది.",
        "telugu_romanized": "Namaskaram! Avunu, adi aamodinchabadindi.",
        "intent": "affirmation",
        "punctuation": "."
    },
    "Thumb_Up+Victory": {
        "english": "Great job, we won with victory!",
        "telugu": "చాలా బాగుంది, మనం విజయం సాధించాము!",
        "telugu_romanized": "Chaala baagundi, manam vijayam saadhinchaamu!",
        "intent": "affirmation",
        "punctuation": "!"
    }
}


class SignToMeaningMapper:
    """
    Validates tokens against the active vocabulary and maps them to lexical metadata.
    """
    def map_token(self, token: str) -> Dict[str, Any]:
        token_clean = token.strip()
        if token_clean in SIGN_LEXICAL_METADATA:
            meta = SIGN_LEXICAL_METADATA[token_clean]
            return {
                "token": token_clean,
                "supported": True,
                "gloss": meta["gloss"],
                "role": meta["role"],
                "english": meta["en"],
                "telugu": meta["te"],
                "telugu_romanized": meta["ro"]
            }

        # Fallback to vocabulary_service
        v_entry = vocabulary_service.get_gesture_by_id(token_clean)
        if v_entry:
            return {
                "token": token_clean,
                "supported": True,
                "gloss": v_entry.get("canonical_label", token_clean).upper(),
                "role": "general",
                "english": v_entry.get("name", token_clean),
                "telugu": v_entry.get("telugu", token_clean),
                "telugu_romanized": v_entry.get("telugu_romanized", token_clean)
            }

        return {
            "token": token_clean,
            "supported": False,
            "gloss": "UNKNOWN",
            "role": "unsupported",
            "english": f"[Unrecognized: {token_clean}]",
            "telugu": f"[గుర్తించబడని సంజ్ఞ: {token_clean}]",
            "telugu_romanized": f"[Gurtinchabadani: {token_clean}]"
        }


class GrammarEngine:
    """
    Analyzes lexical sequences, detects sentence intent, applies punctuation,
    and constructs coherent English, Telugu script, and Romanized Telugu sentences.
    """
    def __init__(self, mapper: SignToMeaningMapper):
        self.mapper = mapper

    def analyze_sequence(self, tokens: List[str]) -> Dict[str, Any]:
        if not tokens:
            return {
                "intent": "statement",
                "punctuation": ".",
                "english": "",
                "telugu": "",
                "telugu_romanized": "",
                "is_idiomatic": False,
                "breakdown": []
            }

        # 1. Check exact multi-token idiomatic match
        seq_key = "+".join(tokens)
        if seq_key in IDIOMATIC_SEQUENCES:
            match = IDIOMATIC_SEQUENCES[seq_key]
            breakdown = [self.mapper.map_token(t) for t in tokens]
            return {
                "intent": match.get("intent", "statement"),
                "punctuation": match.get("punctuation", "."),
                "english": match["english"],
                "telugu": match["telugu"],
                "telugu_romanized": match["telugu_romanized"],
                "is_idiomatic": True,
                "breakdown": breakdown
            }

        # 2. Map all tokens
        breakdown = [self.mapper.map_token(t) for t in tokens]
        roles = [item["role"] for item in breakdown]

        # 3. Detect intent and determine punctuation
        intent = "statement"
        punctuation = "."

        has_question = any(r == "question" for r in roles) or any(t.upper() in ("WHERE", "WHAT", "WHO", "HOW", "WHEN", "WHY") for t in tokens)
        has_request = any(r == "request" for r in roles) or any(t.upper() in ("PLEASE", "HELP") for t in tokens)
        has_negation = any(r == "negation" for r in roles) or any(t.upper() in ("NO", "NOT") for t in tokens)
        has_affirmation = any(r == "affirmation" for r in roles) or any(t.upper() in ("YES", "OK") for t in tokens)
        has_greeting = any("greeting" in r for r in roles) or any(t.upper() in ("HELLO", "HI", "NAMASTE") for t in tokens)

        if has_question:
            intent = "question"
            punctuation = "?"
        elif has_request:
            intent = "request"
            punctuation = "."
        elif has_negation:
            intent = "negation"
            punctuation = "."
        elif has_affirmation:
            intent = "affirmation"
            punctuation = "."
        elif has_greeting:
            intent = "greeting"
            punctuation = "!"
        elif any(r == "sentiment" for r in roles):
            intent = "statement"
            punctuation = "!"

        # 4. Single token handling with full example sentence
        if len(tokens) == 1:
            token = tokens[0]
            if token.upper() in ("YES", "NO", "NOT", "HELLO", "HI", "ISL_NAMASTE", "NAMASTE", "PLEASE", "HELP"):
                en_w = breakdown[0]["english"].capitalize()
                if not en_w.endswith((".", "?", "!")):
                    en_w += punctuation
                te_w = breakdown[0]["telugu"]
                if not te_w.endswith((".", "?", "!")):
                    te_w += punctuation
                ro_w = breakdown[0]["telugu_romanized"].capitalize()
                if not ro_w.endswith((".", "?", "!")):
                    ro_w += punctuation
                return {
                    "intent": intent,
                    "punctuation": punctuation,
                    "english": en_w,
                    "telugu": te_w,
                    "telugu_romanized": ro_w,
                    "is_idiomatic": True,
                    "breakdown": breakdown
                }

            v_entry = vocabulary_service.get_gesture_by_id(token)
            if v_entry and v_entry.get("example_sentence_en"):
                return {
                    "intent": intent,
                    "punctuation": punctuation,
                    "english": v_entry["example_sentence_en"],
                    "telugu": v_entry.get("example_sentence_te", breakdown[0]["telugu"]),
                    "telugu_romanized": v_entry.get("example_sentence_ro", breakdown[0]["telugu_romanized"]),
                    "is_idiomatic": True,
                    "breakdown": breakdown
                }

        # 5. Rule-based composite generation
        # Check numeral + noun pattern (e.g. ISL_1 + ISL_BOOK -> "I need one study book")
        if len(tokens) == 2 and breakdown[0]["role"] in ("numeral", "greeting_or_numeral") and breakdown[1]["role"] == "noun":
            count_num = breakdown[0].get("count", 1)
            count_word_en = breakdown[0]["english"]
            count_word_te = breakdown[0]["telugu"]
            count_word_ro = breakdown[0]["telugu_romanized"]
            noun_en = breakdown[1]["english"]
            noun_te = breakdown[1]["telugu"]
            noun_ro = breakdown[1]["telugu_romanized"]

            # Pluralization for count > 1
            if count_num > 1 and "book" in noun_en:
                noun_en = "study books"
                noun_te = "అధ్యయన పుస్తకాలు"
                noun_ro = "adhyayana pusthakaalu"

            return {
                "intent": "statement",
                "punctuation": ".",
                "english": f"I need {count_word_en} {noun_en}.",
                "telugu": f"నాకు {count_word_te} {noun_te} కావాలి.",
                "telugu_romanized": f"Naaku {count_word_ro} {noun_ro} kaavaali.",
                "is_idiomatic": True,
                "breakdown": breakdown
            }

        # General assembly with capitalization and proper spacing
        en_words = [item["english"] for item in breakdown]
        te_words = [item["telugu"] for item in breakdown]
        ro_words = [item["telugu_romanized"] for item in breakdown]

        en_str = " ".join(en_words).strip()
        if en_str:
            en_str = en_str[0].upper() + en_str[1:]
            if not en_str.endswith((".", "?", "!")):
                en_str += punctuation

        te_str = " ".join(te_words).strip()
        if te_str and not te_str.endswith((".", "?", "!")):
            te_str += punctuation

        ro_str = " ".join(ro_words).strip()
        if ro_str:
            ro_str = ro_str[0].upper() + ro_str[1:]
            if not ro_str.endswith((".", "?", "!")):
                ro_str += punctuation

        return {
            "intent": intent,
            "punctuation": punctuation,
            "english": en_str,
            "telugu": te_str,
            "telugu_romanized": ro_str,
            "is_idiomatic": False,
            "breakdown": breakdown
        }


class SentenceTranslationService:
    def __init__(self):
        self.mapper = SignToMeaningMapper()
        self.grammar = GrammarEngine(self.mapper)

    def translate_signs_sequence(self, sign_tokens: List[str]) -> Dict[str, Any]:
        """
        Translates a sequence of recognized gesture/sign tokens into coherent sentences.
        Mode 1: Live Sign Recognition.
        """
        clean_tokens = [t.strip() for t in sign_tokens if t and t.strip()]
        if not clean_tokens:
            return {
                "tokens": [],
                "english": "",
                "telugu": "",
                "telugu_romanized": "",
                "sentence_intent": "statement",
                "punctuation": ".",
                "confidence_summary": 1.0,
                "is_idiomatic_match": False,
                "meaning_breakdown": [],
                "source_mode": "camera_recognition",
                "disambiguation_options": []
            }

        analysis = self.grammar.analyze_sequence(clean_tokens)

        # Disambiguation options when sequence is brief or ambiguous
        disambiguation_options = []
        if len(clean_tokens) == 1 and clean_tokens[0] in ("ISL_5", "Open_Palm"):
            disambiguation_options = [
                {
                    "label": "Greeting (Hello)",
                    "english": "Hello everyone, welcome.",
                    "telugu": "అందరికీ నమస్కారం, స్వాగతం.",
                    "telugu_romanized": "Andariki namaskaram, swagatham."
                },
                {
                    "label": "Number (Five)",
                    "english": "Count of five items.",
                    "telugu": "ఐదు వస్తువుల లెక్కింపు.",
                    "telugu_romanized": "Aidu vasthuvula lekkimpu."
                }
            ]

        return {
            "tokens": clean_tokens,
            "english": analysis["english"],
            "telugu": analysis["telugu"],
            "telugu_romanized": analysis["telugu_romanized"],
            "sentence_intent": analysis["intent"],
            "punctuation": analysis["punctuation"],
            "is_idiomatic_match": analysis["is_idiomatic"],
            "meaning_breakdown": analysis["breakdown"],
            "source_mode": "camera_recognition",
            "disambiguation_options": disambiguation_options
        }


sentence_translation_service = SentenceTranslationService()
sentence_service = sentence_translation_service
