/**
 * SignBridge AI - Compositional Numerical Recognition Engine
 * 
 * Supports scalable numbers from 1 to 1,000,000,000 and beyond.
 * Interprets sequences of recognized single digits (0-9) and scale multipliers
 * (Hundred, Thousand, Lakh, Million, Crore, Billion), maintains sequence order,
 * prevents accidental duplicate triggers via temporal debouncing, and generates
 * validated numerical values and multilingual verbalizations (EN, TE, RO, HI).
 */

export type MultiplierUnit = 'HUNDRED' | 'THOUSAND' | 'LAKH' | 'MILLION' | 'CRORE' | 'BILLION';

export interface NumberToken {
  type: 'digit' | 'multiplier';
  value: number; // 0-9 for digits, scale factor for multipliers
  multiplierKey?: MultiplierUnit;
  label: string;
  sourceGesture: string;
  timestamp: number;
}

export interface NumericalEvaluation {
  value: bigint;
  formatted: string;
  inWords: {
    en: string;
    te: string;
    ro: string;
    hi: string;
  };
  isValid: boolean;
  tokensCount: number;
}

export const GESTURE_TO_NUMBER_TOKEN: Record<string, { type: 'digit' | 'multiplier'; value: number; multiplierKey?: MultiplierUnit; label: string }> = {
  'ISL_0': { type: 'digit', value: 0, label: '0' },
  'ISL_1': { type: 'digit', value: 1, label: '1' },
  'ISL_2': { type: 'digit', value: 2, label: '2' },
  'ISL_3': { type: 'digit', value: 3, label: '3' },
  'ISL_4': { type: 'digit', value: 4, label: '4' },
  'ISL_5': { type: 'digit', value: 5, label: '5' },
  'ISL_6': { type: 'digit', value: 6, label: '6' },
  'ISL_7': { type: 'digit', value: 7, label: '7' },
  'ISL_8': { type: 'digit', value: 8, label: '8' },
  'ISL_9': { type: 'digit', value: 9, label: '9' },
  'ISL_HUNDRED': { type: 'multiplier', value: 100, multiplierKey: 'HUNDRED', label: 'Hundred (100)' },
  'ISL_THOUSAND': { type: 'multiplier', value: 1_000, multiplierKey: 'THOUSAND', label: 'Thousand (1,000)' },
  'ISL_LAKH': { type: 'multiplier', value: 100_000, multiplierKey: 'LAKH', label: 'Lakh (100,000)' },
  'ISL_MILLION': { type: 'multiplier', value: 1_000_000, multiplierKey: 'MILLION', label: 'Million (1,000,000)' },
  'ISL_CRORE': { type: 'multiplier', value: 10_000_000, multiplierKey: 'CRORE', label: 'Crore (10,000,000)' },
  'ISL_BILLION': { type: 'multiplier', value: 1_000_000_000, multiplierKey: 'BILLION', label: 'Billion (1,000,000,000)' },
};

export function isNumericalGesture(gestureLabel: string): boolean {
  return gestureLabel in GESTURE_TO_NUMBER_TOKEN;
}

/**
 * Evaluates an ordered sequence of recognized NumberTokens into a combined numerical value.
 * Handles:
 * 1. Direct positional sequences: [1, 4, 2] -> 142
 * 2. Multiplier expressions: [5, HUNDRED] -> 500, [1, LAKH, 2, 5, THOUSAND] -> 125,000
 * 3. Leading multipliers: [BILLION] -> 1,000,000,000
 */
export function evaluateTokenSequence(tokens: NumberToken[]): NumericalEvaluation {
  if (tokens.length === 0) {
    return {
      value: BigInt(0),
      formatted: '0',
      inWords: {
        en: 'Zero',
        te: 'సున్నా',
        ro: 'Sunna',
        hi: 'शून्य',
      },
      isValid: false,
      tokensCount: 0,
    };
  }

  // Parse structured expression
  let total = BigInt(0);
  let currentGroup = BigInt(0);
  let hasPendingDigits = false;

  for (const token of tokens) {
    if (token.type === 'digit') {
      currentGroup = currentGroup * BigInt(10) + BigInt(token.value);
      hasPendingDigits = true;
    } else if (token.type === 'multiplier') {
      const mult = BigInt(token.value);
      const coefficient = hasPendingDigits ? currentGroup : BigInt(1);
      total += coefficient * mult;
      currentGroup = BigInt(0);
      hasPendingDigits = false;
    }
  }

  // Add any remaining unmultiplied digits (e.g. 100 + 45)
  if (hasPendingDigits) {
    total += currentGroup;
  }

  const formattedStr = total.toLocaleString('en-IN');
  const words = formatNumberInWords(total);

  return {
    value: total,
    formatted: formattedStr,
    inWords: words,
    isValid: true,
    tokensCount: tokens.length,
  };
}

// Convert numbers up to Billions into verbal representations
const ONES_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const ONES_TE = ['', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది', 'పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పంతొమ్మిది'];
const TENS_TE = ['', '', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంభై'];

const ONES_RO = ['', 'okati', 'rendu', 'moodu', 'naalugu', 'aidu', 'aaru', 'eedu', 'enimidi', 'tommidi', 'padi', 'padakondu', 'pannendu', 'padamoodu', 'padnaalugu', 'padihenu', 'padahaaru', 'padihedu', 'paddenimidi', 'pantommidi'];
const TENS_RO = ['', '', 'iravai', 'muppai', 'nalabhai', 'yaabhai', 'aravai', 'debbai', 'enabhai', 'tombhai'];

const ONES_HI = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस'];
const TENS_HI = ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे'];

function toWordsEn(n: bigint): string {
  if (n === BigInt(0)) return 'zero';
  const num = Number(n);
  if (n >= BigInt(1_000_000_000)) {
    const b = n / BigInt(1_000_000_000);
    const rem = n % BigInt(1_000_000_000);
    return `${toWordsEn(b)} billion${rem > 0 ? ' ' + toWordsEn(rem) : ''}`;
  }
  if (n >= BigInt(10_000_000)) {
    const cr = n / BigInt(10_000_000);
    const rem = n % BigInt(10_000_000);
    return `${toWordsEn(cr)} crore${rem > 0 ? ' ' + toWordsEn(rem) : ''}`;
  }
  if (n >= BigInt(1_000_000)) {
    const m = n / BigInt(1_000_000);
    const rem = n % BigInt(1_000_000);
    return `${toWordsEn(m)} million${rem > 0 ? ' ' + toWordsEn(rem) : ''}`;
  }
  if (n >= BigInt(100_000)) {
    const lk = n / BigInt(100_000);
    const rem = n % BigInt(100_000);
    return `${toWordsEn(lk)} lakh${rem > 0 ? ' ' + toWordsEn(rem) : ''}`;
  }
  if (n >= BigInt(1000)) {
    const th = n / BigInt(1000);
    const rem = n % BigInt(1000);
    return `${toWordsEn(th)} thousand${rem > 0 ? ' ' + toWordsEn(rem) : ''}`;
  }
  if (n >= BigInt(100)) {
    const h = n / BigInt(100);
    const rem = n % BigInt(100);
    return `${toWordsEn(h)} hundred${rem > 0 ? ' and ' + toWordsEn(rem) : ''}`;
  }
  if (num < 20) return ONES_EN[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `${TENS_EN[tens]}${ones > 0 ? '-' + ONES_EN[ones] : ''}`;
}

function toWordsTe(n: bigint): string {
  if (n === BigInt(0)) return 'సున్నా';
  const num = Number(n);
  if (n >= BigInt(1_000_000_000)) {
    const b = n / BigInt(1_000_000_000);
    const rem = n % BigInt(1_000_000_000);
    return `${toWordsTe(b)} వంద కోట్లు${rem > 0 ? ' ' + toWordsTe(rem) : ''}`;
  }
  if (n >= BigInt(10_000_000)) {
    const cr = n / BigInt(10_000_000);
    const rem = n % BigInt(10_000_000);
    return `${toWordsTe(cr)} కోట్లు${rem > 0 ? ' ' + toWordsTe(rem) : ''}`;
  }
  if (n >= BigInt(100_000)) {
    const lk = n / BigInt(100_000);
    const rem = n % BigInt(100_000);
    return `${toWordsTe(lk)} లక్షల${rem > 0 ? ' ' + toWordsTe(rem) : ''}`;
  }
  if (n >= BigInt(1000)) {
    const th = n / BigInt(1000);
    const rem = n % BigInt(1000);
    return `${toWordsTe(th)} వేల${rem > 0 ? ' ' + toWordsTe(rem) : ''}`;
  }
  if (n >= BigInt(100)) {
    const h = n / BigInt(100);
    const rem = n % BigInt(100);
    return `${toWordsTe(h)} వందల${rem > 0 ? ' ' + toWordsTe(rem) : ''}`;
  }
  if (num < 20) return ONES_TE[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `${TENS_TE[tens]}${ones > 0 ? ' ' + ONES_TE[ones] : ''}`;
}

function toWordsRo(n: bigint): string {
  if (n === BigInt(0)) return 'sunna';
  const num = Number(n);
  if (n >= BigInt(1_000_000_000)) {
    const b = n / BigInt(1_000_000_000);
    const rem = n % BigInt(1_000_000_000);
    return `${toWordsRo(b)} vanda kotlu${rem > 0 ? ' ' + toWordsRo(rem) : ''}`;
  }
  if (n >= BigInt(10_000_000)) {
    const cr = n / BigInt(10_000_000);
    const rem = n % BigInt(10_000_000);
    return `${toWordsRo(cr)} kotlu${rem > 0 ? ' ' + toWordsRo(rem) : ''}`;
  }
  if (n >= BigInt(100_000)) {
    const lk = n / BigInt(100_000);
    const rem = n % BigInt(100_000);
    return `${toWordsRo(lk)} lakshala${rem > 0 ? ' ' + toWordsRo(rem) : ''}`;
  }
  if (n >= BigInt(1000)) {
    const th = n / BigInt(1000);
    const rem = n % BigInt(1000);
    return `${toWordsRo(th)} vela${rem > 0 ? ' ' + toWordsRo(rem) : ''}`;
  }
  if (n >= BigInt(100)) {
    const h = n / BigInt(100);
    const rem = n % BigInt(100);
    return `${toWordsRo(h)} vandala${rem > 0 ? ' ' + toWordsRo(rem) : ''}`;
  }
  if (num < 20) return ONES_RO[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `${TENS_RO[tens]}${ones > 0 ? ' ' + ONES_RO[ones] : ''}`;
}

function toWordsHi(n: bigint): string {
  if (n === BigInt(0)) return 'शून्य';
  const num = Number(n);
  if (n >= BigInt(1_000_000_000)) {
    const b = n / BigInt(1_000_000_000);
    const rem = n % BigInt(1_000_000_000);
    return `${toWordsHi(b)} अरब${rem > 0 ? ' ' + toWordsHi(rem) : ''}`;
  }
  if (n >= BigInt(10_000_000)) {
    const cr = n / BigInt(10_000_000);
    const rem = n % BigInt(10_000_000);
    return `${toWordsHi(cr)} करोड़${rem > 0 ? ' ' + toWordsHi(rem) : ''}`;
  }
  if (n >= BigInt(100_000)) {
    const lk = n / BigInt(100_000);
    const rem = n % BigInt(100_000);
    return `${toWordsHi(lk)} लाख${rem > 0 ? ' ' + toWordsHi(rem) : ''}`;
  }
  if (n >= BigInt(1000)) {
    const th = n / BigInt(1000);
    const rem = n % BigInt(1000);
    return `${toWordsHi(th)} हज़ार${rem > 0 ? ' ' + toWordsHi(rem) : ''}`;
  }
  if (n >= BigInt(100)) {
    const h = n / BigInt(100);
    const rem = n % BigInt(100);
    return `${toWordsHi(h)} सौ${rem > 0 ? ' ' + toWordsHi(rem) : ''}`;
  }
  if (num < 20) return ONES_HI[num];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `${TENS_HI[tens]}${ones > 0 ? ' ' + ONES_HI[ones] : ''}`;
}

export function formatNumberInWords(n: bigint): { en: string; te: string; ro: string; hi: string } {
  const en = toWordsEn(n);
  const te = toWordsTe(n);
  const ro = toWordsRo(n);
  const hi = toWordsHi(n);
  return {
    en: en.charAt(0).toUpperCase() + en.slice(1),
    te,
    ro: ro.charAt(0).toUpperCase() + ro.slice(1),
    hi,
  };
}

/**
 * Debounce controller to prevent duplicate digit triggers while user maintains pose.
 * Requires user to either:
 * - Enter neutral (no hand / diff gesture) before appending same digit
 * - Or hold pose for at least triggerHoldMs without interruption
 */
export class NumericalDebounceController {
  private lastTokenLabel: string | null = null;
  private lastCommitTime = 0;
  private readonly cooldownMs: number;

  constructor(cooldownMs = 1200) {
    this.cooldownMs = cooldownMs;
  }

  public shouldCommit(gestureLabel: string, now = Date.now()): boolean {
    if (!isNumericalGesture(gestureLabel)) {
      this.lastTokenLabel = null;
      return false;
    }

    if (this.lastTokenLabel !== gestureLabel) {
      // New distinct numerical sign
      this.lastTokenLabel = gestureLabel;
      this.lastCommitTime = now;
      return true;
    }

    // Same sign: only commit if cooldown elapsed (intentional repeat hold)
    if (now - this.lastCommitTime >= this.cooldownMs) {
      this.lastCommitTime = now;
      return true;
    }

    return false;
  }

  public reset(): void {
    this.lastTokenLabel = null;
    this.lastCommitTime = 0;
  }
}
