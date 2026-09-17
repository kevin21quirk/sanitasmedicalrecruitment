// CV matching engine — LLM-backed (Anthropic) with heuristic fallback.

// ---------- text extraction ----------
export async function extractCvText(buffer, filename = '', mimetype = '') {
  const ext = filename.toLowerCase().split('.').pop();
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  // txt / anything else: treat as plain text
  return buffer.toString('utf8');
}

// ---------- shared output shape ----------
// { score: 0-100, verdict: 'strong'|'good'|'partial'|'weak',
//   matched: [{ item, evidence }], missing: [{ item, importance, note }],
//   summary: string, engine: 'claude'|'heuristic' }

const VERDICTS = [
  [80, 'strong'],
  [60, 'good'],
  [40, 'partial'],
  [0, 'weak'],
];
const verdictFor = (score) => VERDICTS.find(([min]) => score >= min)[1];

// ---------- Claude ----------
async function analyzeWithClaude(cvText, vacancy) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const prompt = `You are an expert UK medical recruitment consultant for Sanitas Medical Recruitment, an agency placing Registered Nurses and Healthcare Assistants into private care homes in Essex and London.

Analyse this CV against the vacancy below. Respond with ONLY a JSON object (no markdown, no prose) in exactly this shape:
{
  "score": <integer 0-100 overall match>,
  "matched": [{"item": "<requirement or quality matched>", "evidence": "<what in the CV proves it>"}],
  "missing": [{"item": "<requirement or quality not evidenced>", "importance": "essential|desirable", "note": "<brief explanation>"}],
  "summary": "<2-4 sentence recruiter-style assessment of fit, flagging anything notable>"
}

Consider: registration requirements (NMC PIN for nurse roles), DBS/right-to-work signals, clinical skills (dementia, palliative, medication administration, PEG feeding, wound care, catheter care, tracheostomy, manual handling, safeguarding), care-home sector experience, years of experience, shift-pattern fit, and geography if mentioned. Be honest — flag missing essentials clearly rather than inflating the score.

VACANCY
Title: ${vacancy.title}
Role: ${vacancy.role}
Client type: ${vacancy.client_type ?? 'Care home'} (${vacancy.client_name ?? ''})
Employment type: ${vacancy.employment_type}
Shift pattern: ${vacancy.shift_pattern ?? 'not specified'}
Hours/week: ${vacancy.hours_per_week ?? 'not specified'}
Pay rate: ${vacancy.pay_rate ? '£' + vacancy.pay_rate + '/hr' : 'not specified'}
Requirements: ${(vacancy.requirements || []).join('; ') || 'none listed'}
Description: ${vacancy.description ?? 'none'}

CV
${cvText.slice(0, 15000)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('No JSON in AI response');
  const parsed = JSON.parse(json);
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    verdict: verdictFor(Math.round(parsed.score ?? 0)),
    matched: parsed.matched ?? [],
    missing: parsed.missing ?? [],
    summary: parsed.summary ?? '',
    engine: 'claude',
  };
}

// ---------- heuristic fallback ----------
const SKILLS = [
  { key: 'nmc', label: 'NMC registration', re: /\bNMC\b|nursing and midwifery council|nmc pin|registered nurse/i, nurseOnly: true },
  { key: 'dbs', label: 'DBS check', re: /\bDBS\b|disclosure and barring|enhanced disclosure|update service/i },
  { key: 'rtw', label: 'Right to work', re: /right to work|british citizen|uk citizen|settled status|pre-?settled|work visa|indefinite leave/i },
  { key: 'dementia', label: 'Dementia care', re: /dementia|alzheimer/i },
  { key: 'palliative', label: 'Palliative / end of life care', re: /palliative|end[- ]of[- ]life|eol\b/i },
  { key: 'meds', label: 'Medication administration', re: /medicat|medicines management|administer(ing|ed)? (medication|meds)|drug rounds/i },
  { key: 'peg', label: 'PEG / enteral feeding', re: /\bPEG\b|percutaneous|enteral|ng tube|nasogastric/i },
  { key: 'wound', label: 'Wound care', re: /wound (care|dressing)|pressure (ulcer|sore|area|relief)|tissue viability/i },
  { key: 'catheter', label: 'Catheter care', re: /catheter/i },
  { key: 'manual', label: 'Manual handling', re: /manual handling|moving and handling|hoist/i },
  { key: 'safeguarding', label: 'Safeguarding', re: /safeguarding/i },
  { key: 'careplan', label: 'Care planning', re: /care plan|care planning|care records/i },
  { key: 'trach', label: 'Tracheostomy care', re: /tracheostomy|tracheotomy/i },
  { key: 'diabetes', label: 'Diabetes care', re: /diabet|insulin|blood glucose/i },
  { key: 'epilepsy', label: 'Epilepsy management', re: /epilep|seizure/i },
  { key: 'infection', label: 'Infection control', re: /infection control|infection prevention/i },
  { key: 'firstaid', label: 'First aid', re: /first aid|basic life support|\bBLS\b/i },
  { key: 'nvq', label: 'NVQ/QCF care qualification', re: /\bNVQ\b|\bQCF\b|level [23].{0,30}(health|care)|health and social care.{0,30}level/i },
  { key: 'carecert', label: 'Care Certificate', re: /care certificate/i },
  { key: 'carehome', label: 'Care home sector experience', re: /care home|nursing home|residential (home|care)|care setting|elderly care/i },
  { key: 'nights', label: 'Night shift experience', re: /night shift|nights only|working nights|night duty/i },
  { key: 'leadership', label: 'Team leadership / senior experience', re: /team lead|supervis|senior (nurse|hca|carer|healthcare)|shift lead|unit (lead|manager)/i },
  { key: 'personal', label: 'Personal care', re: /personal care|washing|bathing|toileting|dressing|adl/i },
];

const ROLE_RES = {
  'Registered Nurse': [/\bRN\b|registered nurse|staff nurse|staff nurse|nmc.{0,20}(pin|registered)|\bRGN\b/i],
  'Senior Nurse': [/senior nurse|unit (lead|manager)|clinical lead|deputy manager|\bRN\b|registered nurse/i],
  'Healthcare Assistant': [/healthcare assistant|\bHCA\b|care assistant|support worker|carer\b/i],
  'Senior HCA': [/senior (hca|healthcare assistant|carer|care assistant)|senior support worker|healthcare assistant|\bHCA\b/i],
};

// Map a requirement string to a skill key when possible
function reqToSkill(req) {
  const t = req.toLowerCase();
  if (/nmc|pin/.test(t)) return 'nmc';
  if (/dbs/.test(t)) return 'dbs';
  if (/right to work|visa|rtw/.test(t)) return 'rtw';
  if (/dementia/.test(t)) return 'dementia';
  if (/palliative|end of life/.test(t)) return 'palliative';
  if (/medicat/.test(t)) return 'meds';
  if (/peg|enteral/.test(t)) return 'peg';
  if (/wound|pressure/.test(t)) return 'wound';
  if (/catheter/.test(t)) return 'catheter';
  if (/manual handling|moving/.test(t)) return 'manual';
  if (/safeguard/.test(t)) return 'safeguarding';
  if (/transport|drive|car\b/.test(t)) return 'transport';
  if (/night/.test(t)) return 'nights';
  if (/experience/.test(t)) return 'experience';
  return null;
}

function snippet(cvText, re) {
  const m = cvText.match(re);
  if (!m) return null;
  const i = m.index;
  const s = cvText.slice(Math.max(0, i - 30), Math.min(cvText.length, i + m[0].length + 40)).replace(/\s+/g, ' ').trim();
  return `…${s}…`;
}

export function analyzeHeuristic(cvText, vacancy) {
  const cv = ` ${cvText} `;
  const isNurse = /nurse/i.test(vacancy.role);
  const matched = [];
  const missing = [];

  // 1. Role match
  const roleRes = ROLE_RES[vacancy.role] ?? [];
  const roleHit = roleRes.some((re) => re.test(cv));
  if (roleHit) {
    matched.push({ item: `Role fit — ${vacancy.role}`, evidence: snippet(cv, roleRes.find((re) => re.test(cv))) || 'CV indicates relevant role experience' });
  } else {
    missing.push({ item: `Role fit — ${vacancy.role}`, importance: 'essential', note: `CV does not clearly evidence experience as a ${vacancy.role}` });
  }

  // 2. Explicit vacancy requirements
  const reqs = vacancy.requirements || [];
  for (const req of reqs) {
    const key = reqToSkill(req);
    if (key === 'experience') {
      const years = maxYears(cv);
      if (years >= 1) {
        matched.push({ item: req, evidence: `CV indicates ~${years} year${years === 1 ? '' : 's'} of experience` });
      } else {
        missing.push({ item: req, importance: 'essential', note: 'No clear experience duration stated in CV' });
      }
      continue;
    }
    if (key === 'transport') {
      const hit = /driv|own transport|car owner|full.{0,10}licen[cs]e/i.test(cv);
      if (hit) matched.push({ item: req, evidence: snippet(cv, /driv|own transport|car owner|full.{0,10}licen[cs]e/i) });
      else missing.push({ item: req, importance: 'desirable', note: 'Transport/driving not mentioned in CV' });
      continue;
    }
    const skill = SKILLS.find((s) => s.key === key);
    if (skill) {
      if (skill.re.test(cv)) matched.push({ item: req, evidence: snippet(cv, skill.re) });
      else missing.push({ item: req, importance: 'essential', note: `"${req}" not evidenced in CV` });
    } else {
      // free-text requirement — check salient word overlap
      const words = req.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      const hit = words.length && words.some((w) => cv.toLowerCase().includes(w));
      if (hit) matched.push({ item: req, evidence: `Related terms found in CV` });
      else missing.push({ item: req, importance: 'desirable', note: `"${req}" not clearly evidenced` });
    }
  }

  // 3. Skills coverage
  const isHca = /hca|healthcare/i.test(vacancy.role);
  for (const s of SKILLS) {
    if (s.nurseOnly && !isNurse) continue;
    if (reqs.some((r) => reqToSkill(r) === s.key)) continue; // already covered above
    if (s.re.test(cv)) {
      matched.push({ item: s.label, evidence: snippet(cv, s.re) });
    } else if ((s.key === 'nmc' && isNurse) || (s.key === 'nvq' && isHca) || (s.key === 'dbs') || (s.key === 'carehome')) {
      missing.push({
        item: s.label,
        importance: s.key === 'nmc' || s.key === 'dbs' ? 'essential' : 'desirable',
        note: `No mention of ${s.label.toLowerCase()} found in CV`,
      });
    }
  }

  // 4. Experience
  const years = maxYears(cv);
  if (years >= 3) matched.push({ item: 'Experience depth', evidence: `~${years} years of experience indicated` });
  else if (years > 0) matched.push({ item: 'Experience depth', evidence: `~${years} year${years === 1 ? '' : 's'} indicated — below the typical 3+ preferred` });
  else missing.push({ item: 'Experience depth', importance: 'desirable', note: 'Years of experience not stated clearly' });

  // Score: essentials weigh more
  const reqCount = reqs.length + 1; // role fit counts as a requirement
  const reqMatched = matched.filter((m) => reqs.some((r) => m.item === r) || m.item.startsWith('Role fit')).length;
  const skillMatched = matched.length - reqMatched;
  const essentialMissing = missing.filter((m) => m.importance === 'essential').length;
  let score = 30 * (reqCount ? reqMatched / reqCount : 1) + 45 * Math.min(skillMatched / 8, 1) + 25 * Math.min(years / 5, 1);
  score -= essentialMissing * 12;
  score = Math.max(5, Math.min(98, Math.round(score)));

  const summary = `${verdictFor(score) === 'strong' ? 'Strong match' : verdictFor(score) === 'good' ? 'Good match' : verdictFor(score) === 'partial' ? 'Partial match' : 'Weak match'}: ${matched.length} requirement${matched.length === 1 ? '' : 's'}/skill${matched.length === 1 ? '' : 's'} evidenced, ${missing.length} gap${missing.length === 1 ? '' : 's'} found${essentialMissing ? ` — including ${essentialMissing} essential item${essentialMissing === 1 ? '' : 's'}` : ''}. ${years ? `Approximately ${years} years of relevant experience indicated.` : 'Experience duration unclear from CV.'} Review flagged items before progressing to compliance stage.`;

  return { score, verdict: verdictFor(score), matched, missing, summary, engine: 'heuristic' };
}

function maxYears(cv) {
  let max = 0;
  for (const m of cv.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/gi)) {
    const n = +m[1];
    if (n > max && n < 60) max = n;
  }
  return max;
}

// ---------- entry point ----------
export async function matchCv(cvText, vacancy) {
  try {
    const ai = await analyzeWithClaude(cvText, vacancy);
    if (ai) return ai;
  } catch (e) {
    console.error('Claude match failed, falling back to heuristic:', e.message);
  }
  return analyzeHeuristic(cvText, vacancy);
}
