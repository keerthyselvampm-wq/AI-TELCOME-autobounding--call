import re


class LanguageDetector:
    SUPPORTED_LANGUAGES = ["tamil", "english"]

    TAMIL_UNICODE_RANGE = re.compile(r'[\u0B80-\u0BFF\u0BE6-\u0BEF]')
    TAMIL_NUMERALS = re.compile(r'[\u0BE6-\u0BEF]')

    TAMIL_PATTERNS = [
        re.compile(r'\b(வணக்கம்|வாங்க|எப்படி|என்ன|யாரு|எங்க|ஏன்|எப்ப|எதுக்கு)\b'),
        re.compile(r'\b(சொல்லுங்க|கேளுங்க|பாருங்க|சொல்லு|கேளு)\b'),
        re.compile(r'\b(நான்|நாங்க|உங்க|உனக்கு|அவங்க|இவங்க|எனக்கு|உங்களுக்கு)\b'),
        re.compile(r'\b(வேணும்|வேண்டாம்|முடியும்|முடியாது|சரி|சரியா|ஆமா|இல்ல|இல்லை)\b'),
        re.compile(r'\b(தேதி|நேரம்|காலை|மதியம்|மாலை|மணி|நாள்|வாரம்|மாதம்)\b'),
        re.compile(r'\b(பேர்|பெயர்|கல்லூரி|ஊர்|முகவரி|படிப்பு|வேலை|பயிற்சி)\b'),
        re.compile(r'\b(இன்டர்ன்ஷிப்|இன்டர்ன்|டொமைன்|பேட்ச்|டிப்ளமோ|சான்றிதழ்)\b'),
        re.compile(r'\b(தொடர்பு|எண்|போன்|போன|மொபைல்|கால்|அழைப்பு)\b'),
    ]

    ENGLISH_PATTERNS = [
        re.compile(r'\b(hello|hi|hey|yes|yeah|no|nope|help|thanks|thank|please)\b', re.IGNORECASE),
        re.compile(r'\b(internship|intern|registration|register|joining|join|domain|college)\b', re.IGNORECASE),
        re.compile(r'\b(what|when|how|which|who|where|why|can|could|would|will|is|are|do|does)\b', re.IGNORECASE),
        re.compile(r'\b(available|duration|fees|fee|certificate|certification|batch|timing)\b', re.IGNORECASE),
        re.compile(r'\b(morning|afternoon|evening|months|weeks|contact|number|phone|mobile)\b', re.IGNORECASE),
        re.compile(r'\b(yes|no|okay|ok|sure|alright|fine|good|great|perfect|thanks|thank you)\b', re.IGNORECASE),
    ]

    def detect(self, text: str) -> str:
        if not text or not text.strip():
            return "english"

        has_tamil_chars = bool(self.TAMIL_UNICODE_RANGE.search(text))
        text_lower = text.lower()

        tamil_score = sum(
            bool(p.search(text))
            for p in self.TAMIL_PATTERNS
        )
        tamil_score *= 3

        if has_tamil_chars:
            tamil_score += 5

        english_score = sum(
            bool(p.search(text_lower))
            for p in self.ENGLISH_PATTERNS
        )

        tamil_numerals = len(self.TAMIL_NUMERALS.findall(text))
        tamil_score += tamil_numerals * 2

        if tamil_score > english_score:
            return "tamil"
        return "english"

    def get_greeting(self, lang: str) -> str:
        if lang == "tamil":
            return (
                "வணக்கம், VDart அகாடமிக்கு வரவேற்கிறோம். "
                "நான் மெய்நிகர் இன்டர்ன்ஷிப் உதவியாளர். "
                "உங்களுக்கு எப்படி உதவ முடியும்?"
            )
        return (
            "Hello, welcome to VDart Academy. I am the virtual internship assistant. "
            "How may I help you today?"
        )

    def get_language_label(self, lang: str) -> str:
        if lang == "tamil":
            return "தமிழ் (Tamil)"
        return "English"

    def get_voice_for_language(self, lang: str) -> str:
        if lang == "tamil":
            return "nPczCzjI2devNBz1zQrb"
        return "hpp4J3VqNfWAUOO0d1Us"
