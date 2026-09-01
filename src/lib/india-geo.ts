// Lightweight India city -> state lookup used to rank city matches by
// distance from the user's home city (same city, then same state, then the
// rest of India) before ranking by skill/experience match within each group.

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  "new delhi": "Delhi",
  "delhi ncr": "Delhi",
  gurgaon: "Gurugram",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  trivandrum: "Thiruvananthapuram",
  cochin: "Kochi",
  mysore: "Mysuru",
  vizag: "Visakhapatnam",
  "pune city": "Pune",
  baroda: "Vadodara",
  allahabad: "Prayagraj",
  gurugram: "Gurugram",
  noida: "Noida",
  "greater noida": "Noida",
};

// City (lowercase, post-alias) -> state / union territory.
const CITY_STATE: Record<string, string> = {
  // Andhra Pradesh
  visakhapatnam: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  guntur: "Andhra Pradesh",
  tirupati: "Andhra Pradesh",
  nellore: "Andhra Pradesh",
  kurnool: "Andhra Pradesh",
  kakinada: "Andhra Pradesh",
  rajahmundry: "Andhra Pradesh",
  // Arunachal Pradesh
  itanagar: "Arunachal Pradesh",
  // Assam
  guwahati: "Assam",
  dibrugarh: "Assam",
  silchar: "Assam",
  jorhat: "Assam",
  // Bihar
  patna: "Bihar",
  gaya: "Bihar",
  bhagalpur: "Bihar",
  muzaffarpur: "Bihar",
  darbhanga: "Bihar",
  // Chhattisgarh
  raipur: "Chhattisgarh",
  bhilai: "Chhattisgarh",
  bilaspur: "Chhattisgarh",
  durg: "Chhattisgarh",
  // Goa
  panaji: "Goa",
  margao: "Goa",
  vasco: "Goa",
  // Gujarat
  ahmedabad: "Gujarat",
  surat: "Gujarat",
  vadodara: "Gujarat",
  rajkot: "Gujarat",
  gandhinagar: "Gujarat",
  bhavnagar: "Gujarat",
  jamnagar: "Gujarat",
  anand: "Gujarat",
  // Haryana
  gurugram: "Haryana",
  faridabad: "Haryana",
  panipat: "Haryana",
  ambala: "Haryana",
  hisar: "Haryana",
  karnal: "Haryana",
  rohtak: "Haryana",
  sonipat: "Haryana",
  // Himachal Pradesh
  shimla: "Himachal Pradesh",
  manali: "Himachal Pradesh",
  dharamshala: "Himachal Pradesh",
  solan: "Himachal Pradesh",
  // Jharkhand
  ranchi: "Jharkhand",
  jamshedpur: "Jharkhand",
  dhanbad: "Jharkhand",
  bokaro: "Jharkhand",
  // Karnataka
  bengaluru: "Karnataka",
  mysuru: "Karnataka",
  mangaluru: "Karnataka",
  hubballi: "Karnataka",
  belagavi: "Karnataka",
  "hubli-dharwad": "Karnataka",
  hubli: "Karnataka",
  mangalore: "Karnataka",
  belgaum: "Karnataka",
  // Kerala
  kochi: "Kerala",
  thiruvananthapuram: "Kerala",
  kozhikode: "Kerala",
  thrissur: "Kerala",
  kollam: "Kerala",
  kannur: "Kerala",
  calicut: "Kerala",
  // Madhya Pradesh
  bhopal: "Madhya Pradesh",
  indore: "Madhya Pradesh",
  gwalior: "Madhya Pradesh",
  jabalpur: "Madhya Pradesh",
  ujjain: "Madhya Pradesh",
  sagar: "Madhya Pradesh",
  satna: "Madhya Pradesh",
  ratlam: "Madhya Pradesh",
  rewa: "Madhya Pradesh",
  dewas: "Madhya Pradesh",
  // Maharashtra
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  thane: "Maharashtra",
  aurangabad: "Maharashtra",
  "chhatrapati sambhajinagar": "Maharashtra",
  solapur: "Maharashtra",
  kolhapur: "Maharashtra",
  navi: "Maharashtra",
  "navi mumbai": "Maharashtra",
  amravati: "Maharashtra",
  // Manipur
  imphal: "Manipur",
  // Meghalaya
  shillong: "Meghalaya",
  // Mizoram
  aizawl: "Mizoram",
  // Nagaland
  kohima: "Nagaland",
  dimapur: "Nagaland",
  // Odisha
  bhubaneswar: "Odisha",
  cuttack: "Odisha",
  rourkela: "Odisha",
  berhampur: "Odisha",
  // Punjab
  ludhiana: "Punjab",
  amritsar: "Punjab",
  jalandhar: "Punjab",
  patiala: "Punjab",
  mohali: "Punjab",
  bathinda: "Punjab",
  chandigarh: "Punjab",
  // Rajasthan
  jaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  udaipur: "Rajasthan",
  kota: "Rajasthan",
  ajmer: "Rajasthan",
  bikaner: "Rajasthan",
  alwar: "Rajasthan",
  // Sikkim
  gangtok: "Sikkim",
  // Tamil Nadu
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  madurai: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu",
  trichy: "Tamil Nadu",
  salem: "Tamil Nadu",
  tirupur: "Tamil Nadu",
  erode: "Tamil Nadu",
  vellore: "Tamil Nadu",
  // Telangana
  hyderabad: "Telangana",
  warangal: "Telangana",
  nizamabad: "Telangana",
  karimnagar: "Telangana",
  // Tripura
  agartala: "Tripura",
  // Uttar Pradesh
  lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  noida: "Uttar Pradesh",
  "greater noida": "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  prayagraj: "Uttar Pradesh",
  meerut: "Uttar Pradesh",
  bareilly: "Uttar Pradesh",
  aligarh: "Uttar Pradesh",
  moradabad: "Uttar Pradesh",
  gorakhpur: "Uttar Pradesh",
  // Uttarakhand
  dehradun: "Uttarakhand",
  haridwar: "Uttarakhand",
  rishikesh: "Uttarakhand",
  nainital: "Uttarakhand",
  // West Bengal
  kolkata: "West Bengal",
  howrah: "West Bengal",
  durgapur: "West Bengal",
  siliguri: "West Bengal",
  asansol: "West Bengal",
  // Union territories / NCT
  delhi: "Delhi",
  "new delhi": "Delhi",
  puducherry: "Puducherry",
  jammu: "Jammu and Kashmir",
  srinagar: "Jammu and Kashmir",
  leh: "Ladakh",
};

// Nearest major job-hub cities to suggest when someone's home city/state has
// little or nothing in the dataset yet — e.g. Patna (Bihar) has few listings,
// so point at Noida/Delhi/Lucknow, the hubs Bihar job-seekers commonly target.
const NEARBY_HUBS: Record<string, string[]> = {
  "Andhra Pradesh": ["Hyderabad", "Bengaluru", "Chennai"],
  "Arunachal Pradesh": ["Guwahati", "Kolkata"],
  Assam: ["Guwahati", "Kolkata", "Bengaluru"],
  Bihar: ["Noida", "Delhi", "Lucknow"],
  Chhattisgarh: ["Raipur", "Nagpur", "Bhopal"],
  Goa: ["Pune", "Mumbai"],
  Gujarat: ["Ahmedabad", "Pune", "Mumbai"],
  Haryana: ["Gurugram", "Delhi", "Noida"],
  "Himachal Pradesh": ["Chandigarh", "Delhi"],
  Jharkhand: ["Kolkata", "Noida", "Delhi"],
  Karnataka: ["Bengaluru", "Hyderabad"],
  Kerala: ["Kochi", "Bengaluru", "Chennai"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Pune"],
  Maharashtra: ["Pune", "Mumbai"],
  Manipur: ["Guwahati", "Kolkata"],
  Meghalaya: ["Guwahati", "Kolkata"],
  Mizoram: ["Guwahati", "Kolkata"],
  Nagaland: ["Guwahati", "Kolkata"],
  Odisha: ["Bhubaneswar", "Kolkata", "Hyderabad"],
  Punjab: ["Chandigarh", "Delhi", "Gurugram"],
  Rajasthan: ["Jaipur", "Gurugram", "Delhi"],
  Sikkim: ["Kolkata", "Guwahati"],
  "Tamil Nadu": ["Chennai", "Bengaluru", "Coimbatore"],
  Telangana: ["Hyderabad", "Bengaluru"],
  Tripura: ["Guwahati", "Kolkata"],
  "Uttar Pradesh": ["Noida", "Delhi", "Gurugram", "Lucknow"],
  Uttarakhand: ["Delhi", "Noida", "Chandigarh"],
  "West Bengal": ["Kolkata", "Bengaluru"],
  Delhi: ["Gurugram", "Noida"],
  Puducherry: ["Chennai", "Bengaluru"],
  "Jammu and Kashmir": ["Chandigarh", "Delhi"],
  Ladakh: ["Chandigarh", "Delhi"],
};

export function nearbyHubsForState(state: string): string[] {
  return NEARBY_HUBS[state] ?? [];
}

function titleCase(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

const KNOWN_CITY_KEYS = [...new Set([...Object.keys(CITY_STATE), ...Object.keys(CITY_ALIASES)])];

/** Classic edit distance — small strings only, so the naive DP table is fine. */
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i]![0] = i;
  for (let j = 0; j < cols; j += 1) dp[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[rows - 1]![cols - 1]!;
}

/** Corrects small typos ("ptna" -> "patna", "banglore" -> "bangalore") against known city names. */
function closestKnownCity(key: string): string | null {
  if (key.length < 3) return null;
  let best: { key: string; distance: number } | null = null;
  for (const candidate of KNOWN_CITY_KEYS) {
    if (Math.abs(candidate.length - key.length) > 2) continue;
    const distance = levenshtein(key, candidate);
    if (!best || distance < best.distance) best = { key: candidate, distance };
  }
  if (!best) return null;
  const threshold = key.length <= 4 ? 1 : 2;
  return best.distance <= threshold ? best.key : null;
}

/** Normalize a free-text city name the same way the scraper cleans locations, with typo correction. */
export function resolveCityName(raw: string): string {
  const first =
    raw
      .split(/[,/|]/)[0]
      ?.replace(/(hybrid|remote|work from home|wfo|onsite)/gi, "")
      .replace(/[-–()]/g, " ")
      .trim() ?? "";
  if (!first) return "";
  const key = first.toLowerCase().trim();
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  if (CITY_STATE[key]) return titleCase(first);

  const corrected = closestKnownCity(key);
  if (corrected) return CITY_ALIASES[corrected] ?? titleCase(corrected);

  return titleCase(first);
}

export function stateForCity(rawCity: string): string | null {
  const resolved = resolveCityName(rawCity);
  if (!resolved) return null;
  return CITY_STATE[resolved.toLowerCase()] ?? null;
}
