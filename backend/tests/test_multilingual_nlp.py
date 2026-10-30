"""
Unit tests for SignBridge AI Multilingual NLP & Speech Translation
Tests:
- Telugu to Romanized transliteration (Unicode deterministic)
- Bidirectional phrase translation (English <-> Telugu <-> Hindi)
- Token-level dictionary translation
- Preservation of original sentence and separation from translated text
"""

import pytest
from backend.app.services.multilingual_nlp_service import (
    multilingual_nlp_service,
    transliterate_telugu_to_roman
)


def test_telugu_to_roman_transliteration_namaskaram():
    telugu = "నమస్కారం"
    roman = transliterate_telugu_to_roman(telugu)
    assert "namaskaram" in roman.lower() or "namaskaaram" in roman.lower()


def test_telugu_to_roman_transliteration_sentence():
    telugu = "మీరు ఎలా ఉన్నారు?"
    roman = transliterate_telugu_to_roman(telugu)
    assert "meeru" in roman.lower()
    assert "unnaaru" in roman.lower() or "unnaru" in roman.lower()


def test_english_to_telugu_translation():
    res = multilingual_nlp_service.translate(
        text="Hello, how are you?",
        source_lang="en",
        target_lang="te"
    )
    assert res["original_text"] == "Hello, how are you?"
    assert "నమస్కారం" in res["translated_text"] or "ఎలా" in res["translated_text"]
    assert len(res["romanized_text"]) > 0
    assert res["confidence"] >= 0.7


def test_telugu_to_english_translation():
    res = multilingual_nlp_service.translate(
        text="నమస్కారం, మీరు ఎలా ఉన్నారు?",
        source_lang="te",
        target_lang="en"
    )
    assert res["original_text"] == "నమస్కారం, మీరు ఎలా ఉన్నారు?"
    assert "Hello" in res["translated_text"] or "how are you" in res["translated_text"].lower()
    assert res["confidence"] >= 0.7


def test_english_to_romanized_telugu():
    res = multilingual_nlp_service.translate(
        text="Thank you very much.",
        source_lang="en",
        target_lang="te-ro"
    )
    assert "dhanyavaadaalu" in res["translated_text"].lower() or "dhanya" in res["translated_text"].lower()


def test_empty_string_handling():
    res = multilingual_nlp_service.translate(text="", source_lang="en", target_lang="te")
    assert res["translated_text"] == ""
    assert res["method"] == "empty"
