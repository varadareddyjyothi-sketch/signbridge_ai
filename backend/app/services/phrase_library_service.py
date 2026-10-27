"""
SignBridge AI - Quick Phrase Library Service
Provides curated, reviewed multilingual phrases across 8 categories:
A. Greetings and introductions
B. Questions
C. Everyday conversation
D. Directions and travel
E. Food, water, and basic needs
F. Education and work
G. Health and emergency communication
H. Answers and short responses

All Telugu script and Romanized Telugu translations have been reviewed for authentic grammar.
"""

from typing import List, Dict, Any, Optional

QUICK_PHRASE_CATEGORIES = [
    {"id": "greetings", "name": "Greetings & Introductions", "icon": "👋", "count": 10},
    {"id": "questions", "name": "Questions", "icon": "❓", "count": 10},
    {"id": "conversation", "name": "Everyday Conversation", "icon": "💬", "count": 11},
    {"id": "travel", "name": "Directions & Travel", "icon": "🧭", "count": 7},
    {"id": "needs", "name": "Food, Water & Needs", "icon": "🍲", "count": 6},
    {"id": "education", "name": "Education & Work", "icon": "📚", "count": 6},
    {"id": "health_emergency", "name": "Health & Emergency", "icon": "🚨", "count": 5},
    {"id": "responses", "name": "Answers & Responses", "icon": "✅", "count": 8},
]

QUICK_PHRASES: List[Dict[str, Any]] = [
    # -------------------------------------------------------------
    # Category A: Greetings and introductions
    # -------------------------------------------------------------
    {
        "id": "phrase_greet_01",
        "category": "greetings",
        "english": "Hello.",
        "telugu": "నమస్కారం.",
        "telugu_romanized": "Namaskaram.",
        "is_emergency": False,
        "verified": True,
        "notes": "Universal polite greeting."
    },
    {
        "id": "phrase_greet_02",
        "category": "greetings",
        "english": "Good morning.",
        "telugu": "శుభోదయం.",
        "telugu_romanized": "Shubhodayam.",
        "is_emergency": False,
        "verified": True,
        "notes": "Morning greeting."
    },
    {
        "id": "phrase_greet_03",
        "category": "greetings",
        "english": "Good afternoon.",
        "telugu": "శుభ మధ్యాహ్నం.",
        "telugu_romanized": "Shubha madhyaahnam.",
        "is_emergency": False,
        "verified": True,
        "notes": "Afternoon greeting."
    },
    {
        "id": "phrase_greet_04",
        "category": "greetings",
        "english": "Good evening.",
        "telugu": "శుభ సాయంత్రం.",
        "telugu_romanized": "Shubha saayantram.",
        "is_emergency": False,
        "verified": True,
        "notes": "Evening greeting."
    },
    {
        "id": "phrase_greet_05",
        "category": "greetings",
        "english": "How are you?",
        "telugu": "మీరు ఎలా ఉన్నారు?",
        "telugu_romanized": "Meeru elaa unnaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Standard polite inquiry."
    },
    {
        "id": "phrase_greet_06",
        "category": "greetings",
        "english": "I am fine.",
        "telugu": "నేను బాగున్నాను.",
        "telugu_romanized": "Nenu baagunnaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Positive state confirmation."
    },
    {
        "id": "phrase_greet_07",
        "category": "greetings",
        "english": "What is your name?",
        "telugu": "మీ పేరు ఏమిటి?",
        "telugu_romanized": "Mee peru emiti?",
        "is_emergency": False,
        "verified": True,
        "notes": "Name inquiry question."
    },
    {
        "id": "phrase_greet_08",
        "category": "greetings",
        "english": "My name is ___.",
        "telugu": "నా పేరు ___.",
        "telugu_romanized": "Naa peru ___.",
        "is_emergency": False,
        "verified": True,
        "notes": "Self-introduction template."
    },
    {
        "id": "phrase_greet_09",
        "category": "greetings",
        "english": "Nice to meet you.",
        "telugu": "మిమ్మల్ని కలవడం చాలా సంతోషంగా ఉంది.",
        "telugu_romanized": "Mimmalni kalavadam chaala santhoshangaa undi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Pleasant introduction response."
    },
    {
        "id": "phrase_greet_10",
        "category": "greetings",
        "english": "Goodbye.",
        "telugu": "వెళ్లొస్తాను / వీడ్కోలు.",
        "telugu_romanized": "Vellosthaanu / Veedkolu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Parting salutation."
    },

    # -------------------------------------------------------------
    # Category B: Questions
    # -------------------------------------------------------------
    {
        "id": "phrase_quest_01",
        "category": "questions",
        "english": "Who are you?",
        "telugu": "మీరు ఎవరు?",
        "telugu_romanized": "Meeru evaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Polite identity question."
    },
    {
        "id": "phrase_quest_02",
        "category": "questions",
        "english": "What is this?",
        "telugu": "ఇది ఏమిటి?",
        "telugu_romanized": "Idi emiti?",
        "is_emergency": False,
        "verified": True,
        "notes": "Object or context inquiry."
    },
    {
        "id": "phrase_quest_03",
        "category": "questions",
        "english": "Where are you going?",
        "telugu": "మీరు ఎక్కడికి వెళ్తున్నారు?",
        "telugu_romanized": "Meeru ekkadiki velthunnaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Destination inquiry."
    },
    {
        "id": "phrase_quest_04",
        "category": "questions",
        "english": "Where do you live?",
        "telugu": "మీరు ఎక్కడ నివసిస్తున్నారు?",
        "telugu_romanized": "Meeru ekkada nivasisthunnaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Residence inquiry."
    },
    {
        "id": "phrase_quest_05",
        "category": "questions",
        "english": "What are you doing?",
        "telugu": "మీరు ఏమి చేస్తున్నారు?",
        "telugu_romanized": "Meeru emi chesthunnaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Activity inquiry."
    },
    {
        "id": "phrase_quest_06",
        "category": "questions",
        "english": "When will you come?",
        "telugu": "మీరు ఎప్పుడు వస్తారు?",
        "telugu_romanized": "Meeru eppudu vasthaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Timing question."
    },
    {
        "id": "phrase_quest_07",
        "category": "questions",
        "english": "Why are you sad?",
        "telugu": "మీరు ఎందుకు బాధపడుతున్నారు?",
        "telugu_romanized": "Meeru enduku baadhapaduthunnaaru?",
        "is_emergency": False,
        "verified": True,
        "notes": "Empathy inquiry."
    },
    {
        "id": "phrase_quest_08",
        "category": "questions",
        "english": "How can I help you?",
        "telugu": "నేను మీకు ఎలా సహాయం చేయగలను?",
        "telugu_romanized": "Nenu meeku elaa sahaayam cheyagalanu?",
        "is_emergency": False,
        "verified": True,
        "notes": "Assistance offer."
    },
    {
        "id": "phrase_quest_09",
        "category": "questions",
        "english": "Can you help me?",
        "telugu": "మీరు నాకు సహాయం చేయగలరా?",
        "telugu_romanized": "Meeru naaku sahaayam cheyagalaraa?",
        "is_emergency": False,
        "verified": True,
        "notes": "Direct request for help."
    },
    {
        "id": "phrase_quest_10",
        "category": "questions",
        "english": "What happened?",
        "telugu": "ఏమి జరిగింది?",
        "telugu_romanized": "Emi jarigindi?",
        "is_emergency": False,
        "verified": True,
        "notes": "Situational question."
    },

    # -------------------------------------------------------------
    # Category C: Everyday conversation
    # -------------------------------------------------------------
    {
        "id": "phrase_conv_01",
        "category": "conversation",
        "english": "I need help.",
        "telugu": "నాకు సహాయం కావాలి.",
        "telugu_romanized": "Naaku sahaayam kaavaali.",
        "is_emergency": False,
        "verified": True,
        "notes": "General help expression."
    },
    {
        "id": "phrase_conv_02",
        "category": "conversation",
        "english": "Please help me.",
        "telugu": "దయచేసి నాకు సహాయం చేయండి.",
        "telugu_romanized": "Dayachesi naaku sahaayam cheyandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Polite request for support."
    },
    {
        "id": "phrase_conv_03",
        "category": "conversation",
        "english": "Thank you.",
        "telugu": "ధన్యవాదాలు.",
        "telugu_romanized": "Dhanyavaadaalu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Gratitude expression."
    },
    {
        "id": "phrase_conv_04",
        "category": "conversation",
        "english": "You are welcome.",
        "telugu": "స్వాగతం / పర్వాలేదు.",
        "telugu_romanized": "Swagatham / Parvaaledu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Response to thank you."
    },
    {
        "id": "phrase_conv_05",
        "category": "conversation",
        "english": "I understand.",
        "telugu": "నాకు అర్థమైంది.",
        "telugu_romanized": "Naaku arthamaindi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Comprehension affirmation."
    },
    {
        "id": "phrase_conv_06",
        "category": "conversation",
        "english": "I do not understand.",
        "telugu": "నాకు అర్థం కాలేదు.",
        "telugu_romanized": "Naaku artham kaaledu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Need for clarification."
    },
    {
        "id": "phrase_conv_07",
        "category": "conversation",
        "english": "Please repeat that.",
        "telugu": "దయచేసి దాన్ని మళ్ళీ చెప్పండి.",
        "telugu_romanized": "Dayachesi daanni mallee cheppandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Repetition request."
    },
    {
        "id": "phrase_conv_08",
        "category": "conversation",
        "english": "Please speak slowly.",
        "telugu": "దయచేసి నెమ్మదిగా మాట్లాడండి.",
        "telugu_romanized": "Dayachesi nemmadigaa maatlaadandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Pacing adjustment."
    },
    {
        "id": "phrase_conv_09",
        "category": "conversation",
        "english": "I am learning.",
        "telugu": "నేను నేర్చుకుంటున్నాను.",
        "telugu_romanized": "Nenu nerchukuntunnaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Learning state disclosure."
    },
    {
        "id": "phrase_conv_10",
        "category": "conversation",
        "english": "I am happy.",
        "telugu": "నేను సంతోషంగా ఉన్నాను.",
        "telugu_romanized": "Nenu santhoshangaa unnaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Positive emotional state."
    },
    {
        "id": "phrase_conv_11",
        "category": "conversation",
        "english": "I am tired.",
        "telugu": "నేను అలసిపోయాను.",
        "telugu_romanized": "Nenu alasipoyaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Fatigue expression."
    },

    # -------------------------------------------------------------
    # Category D: Directions and travel
    # -------------------------------------------------------------
    {
        "id": "phrase_trav_01",
        "category": "travel",
        "english": "Where is the bus stop?",
        "telugu": "బస్ స్టాప్ ఎక్కడ ఉంది?",
        "telugu_romanized": "Bus stop ekkada undi?",
        "is_emergency": False,
        "verified": True,
        "notes": "Public transit navigation."
    },
    {
        "id": "phrase_trav_02",
        "category": "travel",
        "english": "Where is the railway station?",
        "telugu": "రైల్వే స్టేషన్ ఎక్కడ ఉంది?",
        "telugu_romanized": "Railway station ekkada undi?",
        "is_emergency": False,
        "verified": True,
        "notes": "Train transit navigation."
    },
    {
        "id": "phrase_trav_03",
        "category": "travel",
        "english": "How can I go there?",
        "telugu": "నేను అక్కడికి ఎలా వెళ్ళగలను?",
        "telugu_romanized": "Nenu akkadiki elaa vellagalanu?",
        "is_emergency": False,
        "verified": True,
        "notes": "Route request."
    },
    {
        "id": "phrase_trav_04",
        "category": "travel",
        "english": "I want to go home.",
        "telugu": "నేను ఇంటికి వెళ్ళాలనుకుంటున్నాను.",
        "telugu_romanized": "Nenu intiki vellaalanukuntunnaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Destination intent."
    },
    {
        "id": "phrase_trav_05",
        "category": "travel",
        "english": "Is this the right way?",
        "telugu": "ఇది సరైన దారేనా?",
        "telugu_romanized": "Idi saraina daarenaa?",
        "is_emergency": False,
        "verified": True,
        "notes": "Direction confirmation."
    },
    {
        "id": "phrase_trav_06",
        "category": "travel",
        "english": "Please stop here.",
        "telugu": "దయచేసి ఇక్కడ ఆపండి.",
        "telugu_romanized": "Dayachesi ikkada aapandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Transit stopping command."
    },
    {
        "id": "phrase_trav_07",
        "category": "travel",
        "english": "How far is it?",
        "telugu": "అది ఎంత దూరంలో ఉంది?",
        "telugu_romanized": "Adi entha dooramlo undi?",
        "is_emergency": False,
        "verified": True,
        "notes": "Distance inquiry."
    },

    # -------------------------------------------------------------
    # Category E: Food, water, and basic needs
    # -------------------------------------------------------------
    {
        "id": "phrase_need_01",
        "category": "needs",
        "english": "I want water.",
        "telugu": "నాకు నీళ్లు కావాలి.",
        "telugu_romanized": "Naaku neellu kaavaali.",
        "is_emergency": False,
        "verified": True,
        "notes": "Hydration request."
    },
    {
        "id": "phrase_need_02",
        "category": "needs",
        "english": "I need food.",
        "telugu": "నాకు ఆహారం కావాలి.",
        "telugu_romanized": "Naaku aahaaram kaavaali.",
        "is_emergency": False,
        "verified": True,
        "notes": "Food sustenance request."
    },
    {
        "id": "phrase_need_03",
        "category": "needs",
        "english": "I am hungry.",
        "telugu": "నాకు ఆకలిగా ఉంది.",
        "telugu_romanized": "Naaku aakaligaa undi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Hunger expression."
    },
    {
        "id": "phrase_need_04",
        "category": "needs",
        "english": "I am thirsty.",
        "telugu": "నాకు దాహంగా ఉంది.",
        "telugu_romanized": "Naaku daahangaa undi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Thirst expression."
    },
    {
        "id": "phrase_need_05",
        "category": "needs",
        "english": "Where is the restroom?",
        "telugu": "విశ్రాంతి గది (రెస్ట్‌రూమ్) ఎక్కడ ఉంది?",
        "telugu_romanized": "Vishraanthi gadi (restroom) ekkada undi?",
        "is_emergency": False,
        "verified": True,
        "notes": "Sanitation facility request."
    },
    {
        "id": "phrase_need_06",
        "category": "needs",
        "english": "I need some rest.",
        "telugu": "నాకు కొద్దిగా విశ్రాంతి అవసరం.",
        "telugu_romanized": "Naaku koddigaa vishraanthi avasaram.",
        "is_emergency": False,
        "verified": True,
        "notes": "Rest requirement."
    },

    # -------------------------------------------------------------
    # Category F: Education and work
    # -------------------------------------------------------------
    {
        "id": "phrase_edu_01",
        "category": "education",
        "english": "I am a student.",
        "telugu": "నేను ఒక విద్యార్థిని.",
        "telugu_romanized": "Nenu oka vidyaarthini.",
        "is_emergency": False,
        "verified": True,
        "notes": "Role identification."
    },
    {
        "id": "phrase_edu_02",
        "category": "education",
        "english": "I am going to college.",
        "telugu": "నేను కాలేజీకి వెళ్తున్నాను.",
        "telugu_romanized": "Nenu college ki velthunnaanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Academic transit statement."
    },
    {
        "id": "phrase_edu_03",
        "category": "education",
        "english": "I need a pen.",
        "telugu": "నాకు ఒక పెన్ను కావాలి.",
        "telugu_romanized": "Naaku oka pennu kaavaali.",
        "is_emergency": False,
        "verified": True,
        "notes": "Stationery requirement."
    },
    {
        "id": "phrase_edu_04",
        "category": "education",
        "english": "Please explain this.",
        "telugu": "దయచేసి దీనిని వివరించండి.",
        "telugu_romanized": "Dayachesi deenini vivarinchandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Explanation request."
    },
    {
        "id": "phrase_edu_05",
        "category": "education",
        "english": "I have a question.",
        "telugu": "నాకు ఒక ప్రశ్న ఉంది.",
        "telugu_romanized": "Naaku oka prashna undi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Inquiry declaration."
    },
    {
        "id": "phrase_edu_06",
        "category": "education",
        "english": "I need more time.",
        "telugu": "నాకు మరింత సమయం కావాలి.",
        "telugu_romanized": "Naaku marintha samayam kaavaali.",
        "is_emergency": False,
        "verified": True,
        "notes": "Time extension request."
    },

    # -------------------------------------------------------------
    # Category G: Health and emergency communication
    # (Shows explicit confirmed banner, never inferred from uncertain gesture)
    # -------------------------------------------------------------
    {
        "id": "phrase_emerg_01",
        "category": "health_emergency",
        "english": "I need medical help.",
        "telugu": "నాకు వైద్య సహాయం అవసరం.",
        "telugu_romanized": "Naaku vaidya sahaayam avasaram.",
        "is_emergency": True,
        "verified": True,
        "notes": "Medical emergency statement."
    },
    {
        "id": "phrase_emerg_02",
        "category": "health_emergency",
        "english": "Call an ambulance.",
        "telugu": "అంబులెన్స్‌ని పిలవండి.",
        "telugu_romanized": "Ambulance ni pilavandi.",
        "is_emergency": True,
        "verified": True,
        "notes": "Immediate emergency service call command."
    },
    {
        "id": "phrase_emerg_03",
        "category": "health_emergency",
        "english": "I am not feeling well.",
        "telugu": "నా ఆరోగ్యం బాగాలేదు.",
        "telugu_romanized": "Naa aarogyam baagaaledu.",
        "is_emergency": True,
        "verified": True,
        "notes": "Physical illness disclosure."
    },
    {
        "id": "phrase_emerg_04",
        "category": "health_emergency",
        "english": "I am in pain.",
        "telugu": "నాకు నొప్పిగా ఉంది.",
        "telugu_romanized": "Naaku noppigaa undi.",
        "is_emergency": True,
        "verified": True,
        "notes": "Pain sensation communication."
    },
    {
        "id": "phrase_emerg_05",
        "category": "health_emergency",
        "english": "Please call my family.",
        "telugu": "దయచేసి నా కుటుంబానికి కాల్ చేయండి.",
        "telugu_romanized": "Dayachesi naa kutumbaaniki call cheyandi.",
        "is_emergency": True,
        "verified": True,
        "notes": "Emergency kin contact request."
    },

    # -------------------------------------------------------------
    # Category H: Answers and short responses
    # -------------------------------------------------------------
    {
        "id": "phrase_resp_01",
        "category": "responses",
        "english": "Yes.",
        "telugu": "అవును.",
        "telugu_romanized": "Avunu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Affirmative answer."
    },
    {
        "id": "phrase_resp_02",
        "category": "responses",
        "english": "No.",
        "telugu": "కాదు / వద్దు.",
        "telugu_romanized": "Kaadu / Vaddu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Negative answer."
    },
    {
        "id": "phrase_resp_03",
        "category": "responses",
        "english": "Maybe.",
        "telugu": "బహుశా.",
        "telugu_romanized": "Bahushaa.",
        "is_emergency": False,
        "verified": True,
        "notes": "Possibility response."
    },
    {
        "id": "phrase_resp_04",
        "category": "responses",
        "english": "I do not know.",
        "telugu": "నాకు తెలియదు.",
        "telugu_romanized": "Naaku theliyadu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Uncertainty / lack of info."
    },
    {
        "id": "phrase_resp_05",
        "category": "responses",
        "english": "I agree.",
        "telugu": "నేను ఏకీభవిస్తున్నాను.",
        "telugu_romanized": "Nenu ekeebhavisthunnanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Concurrence statement."
    },
    {
        "id": "phrase_resp_06",
        "category": "responses",
        "english": "I disagree.",
        "telugu": "నేను విభేదిస్తున్నాను.",
        "telugu_romanized": "Nenu vibhedisthunnanu.",
        "is_emergency": False,
        "verified": True,
        "notes": "Dissent statement."
    },
    {
        "id": "phrase_resp_07",
        "category": "responses",
        "english": "Please wait.",
        "telugu": "దయచేసి వేచి ఉండండి.",
        "telugu_romanized": "Dayachesi vechi undandi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Pause request."
    },
    {
        "id": "phrase_resp_08",
        "category": "responses",
        "english": "One moment, please.",
        "telugu": "ఒక్క క్షణం ఆగండి, దయచేసి.",
        "telugu_romanized": "Okka kshanam aagandi, dayachesi.",
        "is_emergency": False,
        "verified": True,
        "notes": "Brief hold request."
    }
]


CATEGORY_ALIASES: Dict[str, str] = {
    "everyday": "conversation",
    "conversation": "conversation",
    "directions": "travel",
    "travel": "travel",
    "basic_needs": "needs",
    "needs": "needs",
    "food_water": "needs",
    "emergency": "health_emergency",
    "health": "health_emergency",
    "health_emergency": "health_emergency",
    "answers": "responses",
    "responses": "responses",
    "greetings": "greetings",
    "questions": "questions",
    "education": "education",
    "work": "education"
}


class PhraseLibraryService:
    def __init__(self):
        self._phrases = QUICK_PHRASES
        self._categories = QUICK_PHRASE_CATEGORIES

    def get_categories(self) -> List[Dict[str, Any]]:
        return self._categories

    def get_all_phrases(
        self,
        category: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        results = self._phrases
        if category and category.lower() != "all":
            cat_norm = CATEGORY_ALIASES.get(category.lower().strip(), category.lower().strip())
            results = [p for p in results if p["category"].lower() == cat_norm]
        if search_query:
            q = search_query.strip().lower()
            results = [
                p for p in results
                if q in p["english"].lower()
                or q in p["telugu"].lower()
                or q in p["telugu_romanized"].lower()
                or q in p.get("notes", "").lower()
            ]
        return results

    def get_phrases(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Convenient alias for get_all_phrases supporting search or search_query."""
        return self.get_all_phrases(
            category=category,
            search_query=search or search_query
        )

    def get_phrase_by_id(self, phrase_id: str) -> Optional[Dict[str, Any]]:
        for p in self._phrases:
            if p["id"] == phrase_id:
                return p
        return None


phrase_library_service = PhraseLibraryService()
