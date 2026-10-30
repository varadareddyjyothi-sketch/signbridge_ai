import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  X,
  Camera,
  CheckCircle,
  HelpCircle,
  ArrowLeft,
  Volume2,
  Globe
} from 'lucide-react';
import { ttsService } from '../services/speech';

export type GuideCategory = 'all' | 'greetings' | 'everyday' | 'numbers' | 'general';
export type GuideLanguage = 'en' | 'te' | 'ro';

export interface GuideSign {
  id: string;
  name: string;
  category: 'greetings' | 'everyday' | 'numbers' | 'general';
  categoryLabel: string;
  englishMeaning: string;
  teluguMeaning: string;
  teluguRomanized: string;
  instructions: string;
  exampleEn?: string;
  exampleTe?: string;
  exampleRo?: string;
  isVerifiedISL: boolean;
}

export const VERIFIED_SIGNS_DATA: GuideSign[] = [
  // Greetings
  {
    id: 'ISL_NAMASTE_2HAND',
    name: 'Namaste',
    category: 'greetings',
    categoryLabel: 'Greetings',
    englishMeaning: 'Respectful greeting / Hello',
    teluguMeaning: 'నమస్కారం',
    teluguRomanized: 'Namaskaram',
    instructions: 'Join both palms flat together at chest level with fingers pointing upright in a respectful posture.',
    exampleEn: 'Respectful greetings to everyone.',
    exampleTe: 'అందరికీ నా హృదయపూర్వక నమస్కారాలు.',
    exampleRo: 'Andariki naa hrudayapoorvaka namaskaaraalu.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_5',
    name: 'Hello / Open Palm',
    category: 'greetings',
    categoryLabel: 'Greetings',
    englishMeaning: 'Open greeting / Wave / Numeral 5',
    teluguMeaning: 'నమస్కారం / ఐదు',
    teluguRomanized: 'Namaskaram / Aidu',
    instructions: 'Hold your hand upright facing forward with all five fingers open and spread naturally.',
    exampleEn: 'Hello everyone, welcome.',
    exampleTe: 'అందరికీ నమస్కారం, స్వాగతం.',
    exampleRo: 'Andariki namaskaram, swagatham.',
    isVerifiedISL: true
  },

  // Everyday Words & Communication
  {
    id: 'ISL_OK',
    name: 'OK / Good',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Affirmation / Everything is fine',
    teluguMeaning: 'సరే / అంతా బాగుంది',
    teluguRomanized: 'Sare / Anthaa Baagundi',
    instructions: 'Touch thumb tip and index fingertip together to form a circle, while keeping the other three fingers extended.',
    exampleEn: 'Everything is fine and understood.',
    exampleTe: 'అంతా బాగానే ఉంది, అర్థమైంది.',
    exampleRo: 'Anthaa baagane undi, arthamaindi.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_YES_THUMBS_UP',
    name: 'Yes / Affirmative',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Yes / Agreement / Approval',
    teluguMeaning: 'అవును / సమ్మతం',
    teluguRomanized: 'Avunu / Sammatham',
    instructions: 'Form a closed fist with the thumb extended straight upward in an affirmative stance.',
    exampleEn: 'Yes, I agree with this proposal.',
    exampleTe: 'అవును, నేను దీనితో ఏకీభవిస్తున్నాను.',
    exampleRo: 'Avunu, nenu deenitho ekeebhavisthunnanu.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_NO_INDEX',
    name: 'No / Stop',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'No / Disagreement / Stop',
    teluguMeaning: 'వద్దు / కాదు (ఆగండి)',
    teluguRomanized: 'Vaddu / Kaadu (Aagandi)',
    instructions: 'Hold index finger upright in a firm stance, signaling negation or pause.',
    exampleEn: 'No, please do not continue.',
    exampleTe: 'వద్దు, దయచేసి కొనసాగించవద్దు.',
    exampleRo: 'Vaddu, dayachesi konasaaginchavaddhu.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_PEACE_VICTORY',
    name: 'Peace / Victory',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Peace / Victory / Celebration',
    teluguMeaning: 'శాంతి / విజయం',
    teluguRomanized: 'Shanthi / Vijayam',
    instructions: 'Extend index and middle fingers in a wide V with palm facing forward, thumb folded over ring finger.',
    exampleEn: 'We achieved peace and success.',
    exampleTe: 'మనం శాంతిని, విజయాన్ని సాధించాము.',
    exampleRo: 'Manam shanthini, vijayaanni saadhinchaamu.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_FIST',
    name: 'Closed Fist (Letter S)',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Letter S / Firm stance',
    teluguMeaning: 'పిడికిలి (అక్షరం S)',
    teluguRomanized: 'Pidikili (Aksharam S)',
    instructions: 'Curl all fingers tightly into a closed compact fist with the thumb folded across the fingers.',
    exampleEn: 'Stay strong and resolute.',
    exampleTe: 'బలంగా, ధైర్యంగా ఉండండి.',
    exampleRo: 'Balangaa, dhairyangaa undandi.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_THANK_YOU_DYNAMIC',
    name: 'Thank You',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Gratitude / Thanks',
    teluguMeaning: 'ధన్యవాదాలు',
    teluguRomanized: 'Dhanyavaadaalu',
    instructions: 'Touch fingers of an open flat hand to your chin, then smoothly move the hand outward toward the viewer.',
    exampleEn: 'Thank you very much for your kind support.',
    exampleTe: 'మీ అమూల్యమైన సహాయానికి చాలా ధన్యవాదాలు.',
    exampleRo: 'Mee amoolyamaina sahaayaaniki chaala dhanyavaadaalu.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_PLEASE_DYNAMIC',
    name: 'Please / Request',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Polite request / Please',
    teluguMeaning: 'దయచేసి / అభ్యర్థన',
    teluguRomanized: 'Dayachesi / Abhyarthana',
    instructions: 'Place flat open palm over the center of your chest and rub in a gentle circular motion.',
    exampleEn: 'Please assist me with this task.',
    exampleTe: 'దయచేసి నాకు ఈ పనిలో సహాయం చేయండి.',
    exampleRo: 'Dayachesi naaku ee panilo sahaayam cheyandi.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_HELP_2HAND',
    name: 'Help (Support)',
    category: 'everyday',
    categoryLabel: 'Everyday Words',
    englishMeaning: 'Assistance / Support request',
    teluguMeaning: 'సహాయం',
    teluguRomanized: 'Sahaayam',
    instructions: 'Rest dominant closed fist with thumb upright on top of the flat open non-dominant palm, lifting both hands gently.',
    exampleEn: 'Can you please help me?',
    exampleTe: 'మీరు నాకు సహాయం చేయగలరా?',
    exampleRo: 'Meeru naaku sahaayam cheyagalaraa?',
    isVerifiedISL: true
  },

  // Numbers
  {
    id: 'ISL_1',
    name: 'Number 1',
    category: 'numbers',
    categoryLabel: 'Numbers',
    englishMeaning: 'Counting numeral 1 / Single',
    teluguMeaning: 'సంఖ్య 1 / ఒకటి',
    teluguRomanized: 'Sankhya 1 / Okati',
    instructions: 'Extend index finger straight upright, keeping thumb and other three fingers curled into the palm.',
    exampleEn: 'Please give me one item.',
    exampleTe: 'దయచేసి నాకు ఒక వస్తువు ఇవ్వండి.',
    exampleRo: 'Dayachesi naaku oka vasthuvu ivvandi.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_2',
    name: 'Number 2',
    category: 'numbers',
    categoryLabel: 'Numbers',
    englishMeaning: 'Counting numeral 2 / Pair',
    teluguMeaning: 'సంఖ్య 2 / రెండు',
    teluguRomanized: 'Sankhya 2 / Rendu',
    instructions: 'Extend index and middle fingers upward in a V-shape, thumb folded over ring and pinky fingers.',
    exampleEn: 'I need two minutes.',
    exampleTe: 'నాకు రెండు నిమిషాలు సమయం కావాలి.',
    exampleRo: 'Naaku rendu nimishaalu samayam kaavaali.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_3',
    name: 'Number 3',
    category: 'numbers',
    categoryLabel: 'Numbers',
    englishMeaning: 'Counting numeral 3',
    teluguMeaning: 'సంఖ్య 3 / మూడు',
    teluguRomanized: 'Sankhya 3 / Moodu',
    instructions: 'Extend index, middle, and ring fingers upward, thumb folded across pinky finger.',
    exampleEn: 'There are three choices available.',
    exampleTe: 'మూడు ఎంపికలు అందుబాటులో ఉన్నాయి.',
    exampleRo: 'Moodu empikalu andubaatulo unnaayi.',
    isVerifiedISL: true
  },
  {
    id: 'ISL_4',
    name: 'Number 4',
    category: 'numbers',
    categoryLabel: 'Numbers',
    englishMeaning: 'Counting numeral 4',
    teluguMeaning: 'సంఖ్య 4 / నాలుగు',
    teluguRomanized: 'Sankhya 4 / Naalugu',
    instructions: 'Extend four fingers (index, middle, ring, pinky) vertically, with thumb folded across the palm.',
    exampleEn: 'Four people are waiting.',
    exampleTe: 'నలుగురు వ్యక్తులు వేచి ఉన్నారు.',
    exampleRo: 'Naluguru vyakthulu vechi unnaaru.',
    isVerifiedISL: true
  },

  // General Hand Gestures (Clearly distinguished, NOT official ISL)
  {
    id: 'Thumb_Up',
    name: 'Thumbs Up',
    category: 'general',
    categoryLabel: 'General Gestures',
    englishMeaning: 'General approval / Like',
    teluguMeaning: 'అవును / సమ్మతం',
    teluguRomanized: 'Botana Velu Paiki',
    instructions: 'Closed fist with thumb extended straight upward. (General hand gesture, distinct from regional ISL conventions).',
    exampleEn: 'Great job, well done.',
    exampleTe: 'చాలా మంచి పని.',
    exampleRo: 'Chaala manchi pani.',
    isVerifiedISL: false
  },
  {
    id: 'Thumb_Down',
    name: 'Thumbs Down',
    category: 'general',
    categoryLabel: 'General Gestures',
    englishMeaning: 'General disapproval / Dislike',
    teluguMeaning: 'కాదు / అసమ్మతి',
    teluguRomanized: 'Botana Velu Kindaki',
    instructions: 'Closed fist with thumb pointing downwards.',
    exampleEn: 'I disagree with this choice.',
    exampleTe: 'నేను ఈ ఎంపికతో విభేదిస్తున్నాను.',
    exampleRo: 'Nenu ee empikatho vibhedisthunnanu.',
    isVerifiedISL: false
  },
  {
    id: 'Pointing_Up',
    name: 'Pointing Up',
    category: 'general',
    categoryLabel: 'General Gestures',
    englishMeaning: 'Look up / Attention',
    teluguMeaning: 'పైకి చూడండి',
    teluguRomanized: 'Paiki Choodandi',
    instructions: 'Index finger pointing upward to direct attention.',
    exampleEn: 'Please look up at the screen.',
    exampleTe: 'దయచేసి తెరపై పైకి చూడండి.',
    exampleRo: 'Dayachesi therapai paiki choodandi.',
    isVerifiedISL: false
  },
  {
    id: 'ILoveYou',
    name: 'I Love You (ILY)',
    category: 'general',
    categoryLabel: 'General Gestures',
    englishMeaning: 'Informal affection / ILY',
    teluguMeaning: 'నేను నిన్ను ప్రేమిస్తున్నాను',
    teluguRomanized: 'Nenu Ninnu Premisthunnanu',
    instructions: 'Thumb, index, and pinky fingers extended upright, while middle and ring fingers remain curled.',
    exampleEn: 'Expressing warm affection.',
    exampleTe: 'ప్రేమ మరియు ఆప్యాయతను వ్యక్తపరచడం.',
    exampleRo: 'Prema mariyu aapyayathanu vyakthaparachadam.',
    isVerifiedISL: false
  }
];

interface ISLGuideProps {
  onPractiseSign?: (signId: string, signName: string) => void;
  activeModelClasses?: string[];
}

export const ISLGuide: React.FC<ISLGuideProps> = ({
  onPractiseSign,
  activeModelClasses = []
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<GuideCategory>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<GuideLanguage>('en');
  const [activeSignDetail, setActiveSignDetail] = useState<GuideSign | null>(null);

  // Set of model classes currently trained & active
  const modelClassesSet = useMemo(() => {
    // Default known 10 trained model classes if activeModelClasses is empty
    if (activeModelClasses && activeModelClasses.length > 0) {
      return new Set(activeModelClasses);
    }
    return new Set([
      'ISL_1',
      'ISL_2',
      'ISL_3',
      'ISL_4',
      'ISL_5',
      'ISL_OK',
      'ISL_YES_THUMBS_UP',
      'ISL_NO_INDEX',
      'ISL_PEACE_VICTORY',
      'ISL_FIST'
    ]);
  }, [activeModelClasses]);

  // Filtered signs list
  const filteredSigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return VERIFIED_SIGNS_DATA.filter((sign) => {
      // Category filter
      if (selectedCategory !== 'all' && sign.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (q) {
        const matchesName = sign.name.toLowerCase().includes(q);
        const matchesEnglish = sign.englishMeaning.toLowerCase().includes(q);
        const matchesTelugu = sign.teluguMeaning.toLowerCase().includes(q);
        const matchesRomanized = sign.teluguRomanized.toLowerCase().includes(q);
        const matchesInstructions = sign.instructions.toLowerCase().includes(q);
        if (!matchesName && !matchesEnglish && !matchesTelugu && !matchesRomanized && !matchesInstructions) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: VERIFIED_SIGNS_DATA.length,
      greetings: VERIFIED_SIGNS_DATA.filter((s) => s.category === 'greetings').length,
      everyday: VERIFIED_SIGNS_DATA.filter((s) => s.category === 'everyday').length,
      numbers: VERIFIED_SIGNS_DATA.filter((s) => s.category === 'numbers').length,
      general: VERIFIED_SIGNS_DATA.filter((s) => s.category === 'general').length
    };
  }, []);

  // Listen for escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeSignDetail) {
        setActiveSignDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSignDetail]);

  const handleSpeak = (text: string, lang: 'en' | 'te') => {
    ttsService.speak(text, lang).catch(() => {});
  };

  return (
    <div style={{ padding: '8px 0 40px 0', maxWidth: '1200px', margin: '0 auto' }}>
      {/* =========================================================================
          1. PAGE HEADING & CONCISE DESCRIPTION
          ========================================================================= */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
            }}
          >
            <BookOpen size={18} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', margin: 0 }}>
            Indian Sign Language Guide
          </h1>
        </div>
        <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
          Learn signs, practise them with your camera, and see supported recognition results.
        </p>
      </div>

      {/* =========================================================================
          2. SEARCH BAR & LANGUAGE TOGGLE
          ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          borderRadius: '10px'
        }}
      >
        {/* Search Field */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <Search
            size={18}
            color="#94a3b8"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signs by name or English / Telugu meaning..."
            aria-label="Search signs"
            style={{
              paddingLeft: '38px',
              paddingRight: searchQuery ? '38px' : '12px',
              width: '100%',
              fontSize: '0.88rem'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Language Display Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={16} color="#64748b" />
          <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Display:</span>
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid #e2e8f0'
            }}
          >
            <button
              onClick={() => setSelectedLanguage('en')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '5px',
                background: selectedLanguage === 'en' ? '#ffffff' : 'transparent',
                color: selectedLanguage === 'en' ? '#1d4ed8' : '#475569',
                border: '1px solid',
                borderColor: selectedLanguage === 'en' ? '#bfdbfe' : 'transparent',
                boxShadow: selectedLanguage === 'en' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
            >
              English
            </button>
            <button
              onClick={() => setSelectedLanguage('te')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '5px',
                background: selectedLanguage === 'te' ? '#ffffff' : 'transparent',
                color: selectedLanguage === 'te' ? '#1d4ed8' : '#475569',
                border: '1px solid',
                borderColor: selectedLanguage === 'te' ? '#bfdbfe' : 'transparent',
                boxShadow: selectedLanguage === 'te' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
            >
              తెలుగు
            </button>
            <button
              onClick={() => setSelectedLanguage('ro')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '5px',
                background: selectedLanguage === 'ro' ? '#ffffff' : 'transparent',
                color: selectedLanguage === 'ro' ? '#1d4ed8' : '#475569',
                border: '1px solid',
                borderColor: selectedLanguage === 'ro' ? '#bfdbfe' : 'transparent',
                boxShadow: selectedLanguage === 'ro' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
            >
              Romanized
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. SIMPLE CATEGORIES
          ========================================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '22px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}
        role="tablist"
        aria-label="Sign categories"
      >
        <button
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
          className={`btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          All Signs ({categoryCounts.all})
        </button>

        <button
          role="tab"
          aria-selected={selectedCategory === 'greetings'}
          onClick={() => setSelectedCategory('greetings')}
          className={`btn ${selectedCategory === 'greetings' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          Greetings ({categoryCounts.greetings})
        </button>

        <button
          role="tab"
          aria-selected={selectedCategory === 'everyday'}
          onClick={() => setSelectedCategory('everyday')}
          className={`btn ${selectedCategory === 'everyday' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          Everyday Words ({categoryCounts.everyday})
        </button>

        <button
          role="tab"
          aria-selected={selectedCategory === 'numbers'}
          onClick={() => setSelectedCategory('numbers')}
          className={`btn ${selectedCategory === 'numbers' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          Numbers ({categoryCounts.numbers})
        </button>

        <button
          role="tab"
          aria-selected={selectedCategory === 'general'}
          onClick={() => setSelectedCategory('general')}
          className={`btn ${selectedCategory === 'general' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '7px 14px', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
        >
          General Gestures ({categoryCounts.general})
        </button>
      </div>

      {/* =========================================================================
          4. SIGN CARDS GRID
          ========================================================================= */}
      {filteredSigns.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: '12px'
          }}
        >
          <HelpCircle size={40} color="var(--text-muted)" style={{ margin: '0 auto 14px auto', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No matching signs found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            We could not find any signs matching "{searchQuery}". Try searching with a different word or clear your search.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '18px'
          }}
        >
          {filteredSigns.map((sign) => {
            const isRecognizedByModel = modelClassesSet.has(sign.id);

            // Determine displayed meaning based on language selector
            let displayedMeaning = sign.englishMeaning;
            if (selectedLanguage === 'te') {
              displayedMeaning = sign.teluguMeaning;
            } else if (selectedLanguage === 'ro') {
              displayedMeaning = sign.teluguRomanized;
            }

            return (
              <div
                key={sign.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveSignDetail(sign)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveSignDetail(sign);
                  }
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#a5b4fc',
                        background: 'rgba(99, 102, 241, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {sign.categoryLabel}
                    </span>

                    {sign.isVerifiedISL ? (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={10} />
                        <span>Verified ISL</span>
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                        General Gesture
                      </span>
                    )}
                  </div>

                  {/* Sign Name */}
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    {sign.name}
                  </h3>

                  {/* Meaning */}
                  <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px', lineHeight: 1.45 }}>
                    <strong style={{ color: '#0f172a', fontWeight: 600 }}>Meaning: </strong>
                    {displayedMeaning}
                  </p>

                  {/* Visual Demonstration Status Notice */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '0.78rem',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <HelpCircle size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span>Visual demo being recorded by certified ISL instructors</span>
                  </div>
                </div>

                {/* Card Footer: Camera Status & Primary Action */}
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    {isRecognizedByModel ? (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: '#34d399',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 600
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                        Camera recognition ready
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} />
                        Camera recognition not available yet
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSignDetail(sign);
                      }}
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.82rem' }}
                    >
                      Learn Sign
                    </button>

                    {isRecognizedByModel && onPractiseSign && (
                      <button
                        className="btn btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPractiseSign(sign.id, sign.name);
                        }}
                        style={{ padding: '7px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Camera size={14} />
                        <span>Practise</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          5. CLEAN SIGN DETAIL MODAL / VIEW
          ========================================================================= */}
      {activeSignDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-sign-title"
          onClick={() => setActiveSignDetail(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '560px',
              width: '100%',
              borderRadius: '12px',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveSignDetail(null)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={14} />
                <span>Back to Guide</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                  {activeSignDetail.categoryLabel}
                </span>
                {activeSignDetail.isVerifiedISL ? (
                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                    <CheckCircle size={10} />
                    <span>Verified ISL</span>
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                    General Gesture
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h2 id="modal-sign-title" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              {activeSignDetail.name}
            </h2>

            {/* Demonstration Asset Area (Honest, No Invented Images) */}
            <div
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '20px 16px',
                textAlign: 'center',
                marginBottom: '18px'
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px auto'
                }}
              >
                <BookOpen size={20} color="#2563eb" />
              </div>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginBottom: '3px' }}>
                Official ISL Video Demonstration in Preparation
              </p>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, maxWidth: '380px', marginInline: 'auto' }}>
                Certified video demonstrations are being produced with native signers. Please follow the verified handshape instructions below.
              </p>
            </div>

            {/* Performing Instructions */}
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2563eb', marginBottom: '8px', fontWeight: 700 }}>
                How to Perform This Sign
              </h4>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: '#0f172a'
                }}
              >
                {activeSignDetail.instructions}
              </div>
            </div>

            {/* Multilingual Meanings */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2563eb', marginBottom: '8px', fontWeight: 700 }}>
                Meanings & Translations
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* English */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>English:</span>
                    <div style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: 600 }}>
                      {activeSignDetail.englishMeaning}
                    </div>
                    {activeSignDetail.exampleEn && (
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                        Example: "{activeSignDetail.exampleEn}"
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSpeak(activeSignDetail.englishMeaning, 'en')}
                    title="Speak in English"
                    aria-label="Speak English meaning"
                    style={{ padding: '6px', borderRadius: '6px' }}
                  >
                    <Volume2 size={15} color="#2563eb" />
                  </button>
                </div>

                {/* Telugu Script */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>తెలుగు (Telugu):</span>
                    <div style={{ fontSize: '0.98rem', color: '#0284c7', fontWeight: 600, fontFamily: 'sans-serif' }}>
                      {activeSignDetail.teluguMeaning}
                    </div>
                    {activeSignDetail.exampleTe && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                        ఉదాహరణ: "{activeSignDetail.exampleTe}"
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSpeak(activeSignDetail.teluguMeaning, 'te')}
                    title="Speak in Telugu"
                    aria-label="Speak Telugu meaning"
                    style={{ padding: '6px', borderRadius: '6px' }}
                  >
                    <Volume2 size={15} color="#0284c7" />
                  </button>
                </div>

                {/* Romanized Telugu */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Telugu (Romanized):</span>
                  <div style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 500, fontStyle: 'italic' }}>
                    {activeSignDetail.teluguRomanized}
                  </div>
                  {activeSignDetail.exampleRo && (
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                      Pronunciation: "{activeSignDetail.exampleRo}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recognition Status & Camera Practice Flow */}
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                {modelClassesSet.has(activeSignDetail.id) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.82rem', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    Supported by live camera AI model
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Camera recognition for this sign is not available yet.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveSignDetail(null)}
                  style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                >
                  Close
                </button>

                {modelClassesSet.has(activeSignDetail.id) && onPractiseSign && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const sign = activeSignDetail;
                      setActiveSignDetail(null);
                      onPractiseSign(sign.id, sign.name);
                    }}
                    style={{ padding: '8px 18px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Camera size={16} />
                    <span>Practise with Camera</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
