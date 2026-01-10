// Ship tracking via aisstream.io WebSocket
import { BOUNDING_BOX } from './config.js';

// AIS ship type codes to readable names
const SHIP_TYPES = {
  0: 'Unknown',
  // 20-29: Wing in ground
  20: 'Wing in Ground',
  // 30-39: Special craft
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing (large)',
  33: 'Dredger',
  34: 'Diving Ops',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure Craft',
  // 40-49: High speed craft
  40: 'High Speed Craft',
  41: 'High Speed Craft',
  42: 'High Speed Craft',
  43: 'High Speed Craft',
  44: 'High Speed Craft',
  45: 'High Speed Craft',
  46: 'High Speed Craft',
  47: 'High Speed Craft',
  48: 'High Speed Craft',
  49: 'High Speed Craft',
  // 50-59: Special craft
  50: 'Pilot Vessel',
  51: 'Search & Rescue',
  52: 'Tug',
  53: 'Port Tender',
  54: 'Anti-Pollution',
  55: 'Law Enforcement',
  56: 'Local Vessel',
  57: 'Local Vessel',
  58: 'Medical Transport',
  59: 'Special Craft',
  // 60-69: Passenger
  60: 'Passenger',
  61: 'Passenger',
  62: 'Passenger',
  63: 'Passenger',
  64: 'Passenger',
  65: 'Passenger',
  66: 'Passenger',
  67: 'Passenger',
  68: 'Passenger',
  69: 'Passenger',
  // 70-79: Cargo
  70: 'Cargo',
  71: 'Cargo (Hazard A)',
  72: 'Cargo (Hazard B)',
  73: 'Cargo (Hazard C)',
  74: 'Cargo (Hazard D)',
  75: 'Cargo',
  76: 'Cargo',
  77: 'Cargo',
  78: 'Cargo',
  79: 'Cargo',
  // 80-89: Tanker
  80: 'Tanker',
  81: 'Tanker (Hazard A)',
  82: 'Tanker (Hazard B)',
  83: 'Tanker (Hazard C)',
  84: 'Tanker (Hazard D)',
  85: 'Tanker',
  86: 'Tanker',
  87: 'Tanker',
  88: 'Tanker',
  89: 'Tanker',
  // 90-99: Other
  90: 'Other',
  91: 'Other',
  92: 'Other',
  93: 'Other',
  94: 'Other',
  95: 'Other',
  96: 'Other',
  97: 'Other',
  98: 'Other',
  99: 'Other',
};

// MMSI MID (Maritime Identification Digits) to country/flag
// First 3 digits of MMSI indicate nationality
const MID_TO_COUNTRY = {
  201: { name: 'Albania', flag: '🇦🇱' },
  202: { name: 'Andorra', flag: '🇦🇩' },
  203: { name: 'Austria', flag: '🇦🇹' },
  204: { name: 'Azores', flag: '🇵🇹' },
  205: { name: 'Belgium', flag: '🇧🇪' },
  206: { name: 'Belarus', flag: '🇧🇾' },
  207: { name: 'Bulgaria', flag: '🇧🇬' },
  208: { name: 'Vatican', flag: '🇻🇦' },
  209: { name: 'Cyprus', flag: '🇨🇾' },
  210: { name: 'Cyprus', flag: '🇨🇾' },
  211: { name: 'Germany', flag: '🇩🇪' },
  212: { name: 'Cyprus', flag: '🇨🇾' },
  213: { name: 'Georgia', flag: '🇬🇪' },
  214: { name: 'Moldova', flag: '🇲🇩' },
  215: { name: 'Malta', flag: '🇲🇹' },
  216: { name: 'Armenia', flag: '🇦🇲' },
  218: { name: 'Germany', flag: '🇩🇪' },
  219: { name: 'Denmark', flag: '🇩🇰' },
  220: { name: 'Denmark', flag: '🇩🇰' },
  224: { name: 'Spain', flag: '🇪🇸' },
  225: { name: 'Spain', flag: '🇪🇸' },
  226: { name: 'France', flag: '🇫🇷' },
  227: { name: 'France', flag: '🇫🇷' },
  228: { name: 'France', flag: '🇫🇷' },
  229: { name: 'Malta', flag: '🇲🇹' },
  230: { name: 'Finland', flag: '🇫🇮' },
  231: { name: 'Faroe Islands', flag: '🇫🇴' },
  232: { name: 'United Kingdom', flag: '🇬🇧' },
  233: { name: 'United Kingdom', flag: '🇬🇧' },
  234: { name: 'United Kingdom', flag: '🇬🇧' },
  235: { name: 'United Kingdom', flag: '🇬🇧' },
  236: { name: 'Gibraltar', flag: '🇬🇮' },
  237: { name: 'Greece', flag: '🇬🇷' },
  238: { name: 'Croatia', flag: '🇭🇷' },
  239: { name: 'Greece', flag: '🇬🇷' },
  240: { name: 'Greece', flag: '🇬🇷' },
  241: { name: 'Greece', flag: '🇬🇷' },
  242: { name: 'Morocco', flag: '🇲🇦' },
  243: { name: 'Hungary', flag: '🇭🇺' },
  244: { name: 'Netherlands', flag: '🇳🇱' },
  245: { name: 'Netherlands', flag: '🇳🇱' },
  246: { name: 'Netherlands', flag: '🇳🇱' },
  247: { name: 'Italy', flag: '🇮🇹' },
  248: { name: 'Malta', flag: '🇲🇹' },
  249: { name: 'Malta', flag: '🇲🇹' },
  250: { name: 'Ireland', flag: '🇮🇪' },
  251: { name: 'Iceland', flag: '🇮🇸' },
  252: { name: 'Liechtenstein', flag: '🇱🇮' },
  253: { name: 'Luxembourg', flag: '🇱🇺' },
  254: { name: 'Monaco', flag: '🇲🇨' },
  255: { name: 'Madeira', flag: '🇵🇹' },
  256: { name: 'Malta', flag: '🇲🇹' },
  257: { name: 'Norway', flag: '🇳🇴' },
  258: { name: 'Norway', flag: '🇳🇴' },
  259: { name: 'Norway', flag: '🇳🇴' },
  261: { name: 'Poland', flag: '🇵🇱' },
  262: { name: 'Montenegro', flag: '🇲🇪' },
  263: { name: 'Portugal', flag: '🇵🇹' },
  264: { name: 'Romania', flag: '🇷🇴' },
  265: { name: 'Sweden', flag: '🇸🇪' },
  266: { name: 'Sweden', flag: '🇸🇪' },
  267: { name: 'Slovakia', flag: '🇸🇰' },
  268: { name: 'San Marino', flag: '🇸🇲' },
  269: { name: 'Switzerland', flag: '🇨🇭' },
  270: { name: 'Czech Republic', flag: '🇨🇿' },
  271: { name: 'Turkey', flag: '🇹🇷' },
  272: { name: 'Ukraine', flag: '🇺🇦' },
  273: { name: 'Russia', flag: '🇷🇺' },
  274: { name: 'North Macedonia', flag: '🇲🇰' },
  275: { name: 'Latvia', flag: '🇱🇻' },
  276: { name: 'Estonia', flag: '🇪🇪' },
  277: { name: 'Lithuania', flag: '🇱🇹' },
  278: { name: 'Slovenia', flag: '🇸🇮' },
  279: { name: 'Serbia', flag: '🇷🇸' },
  301: { name: 'Anguilla', flag: '🇦🇮' },
  303: { name: 'USA', flag: '🇺🇸' },
  304: { name: 'Antigua', flag: '🇦🇬' },
  305: { name: 'Antigua', flag: '🇦🇬' },
  306: { name: 'Curaçao', flag: '🇨🇼' },
  307: { name: 'Aruba', flag: '🇦🇼' },
  308: { name: 'Bahamas', flag: '🇧🇸' },
  309: { name: 'Bahamas', flag: '🇧🇸' },
  310: { name: 'Bermuda', flag: '🇧🇲' },
  311: { name: 'Bahamas', flag: '🇧🇸' },
  312: { name: 'Belize', flag: '🇧🇿' },
  314: { name: 'Barbados', flag: '🇧🇧' },
  316: { name: 'Canada', flag: '🇨🇦' },
  319: { name: 'Cayman Islands', flag: '🇰🇾' },
  321: { name: 'Costa Rica', flag: '🇨🇷' },
  323: { name: 'Cuba', flag: '🇨🇺' },
  325: { name: 'Dominica', flag: '🇩🇲' },
  327: { name: 'Dominican Rep.', flag: '🇩🇴' },
  329: { name: 'Guadeloupe', flag: '🇬🇵' },
  330: { name: 'Grenada', flag: '🇬🇩' },
  331: { name: 'Greenland', flag: '🇬🇱' },
  332: { name: 'Guatemala', flag: '🇬🇹' },
  334: { name: 'Honduras', flag: '🇭🇳' },
  336: { name: 'Haiti', flag: '🇭🇹' },
  338: { name: 'USA', flag: '🇺🇸' },
  339: { name: 'Jamaica', flag: '🇯🇲' },
  341: { name: 'St Kitts', flag: '🇰🇳' },
  343: { name: 'St Lucia', flag: '🇱🇨' },
  345: { name: 'Mexico', flag: '🇲🇽' },
  347: { name: 'Martinique', flag: '🇲🇶' },
  348: { name: 'Montserrat', flag: '🇲🇸' },
  350: { name: 'Nicaragua', flag: '🇳🇮' },
  351: { name: 'Panama', flag: '🇵🇦' },
  352: { name: 'Panama', flag: '🇵🇦' },
  353: { name: 'Panama', flag: '🇵🇦' },
  354: { name: 'Panama', flag: '🇵🇦' },
  355: { name: 'Panama', flag: '🇵🇦' },
  356: { name: 'Panama', flag: '🇵🇦' },
  357: { name: 'Panama', flag: '🇵🇦' },
  358: { name: 'Puerto Rico', flag: '🇵🇷' },
  359: { name: 'El Salvador', flag: '🇸🇻' },
  361: { name: 'St Pierre', flag: '🇵🇲' },
  362: { name: 'Trinidad', flag: '🇹🇹' },
  364: { name: 'Turks & Caicos', flag: '🇹🇨' },
  366: { name: 'USA', flag: '🇺🇸' },
  367: { name: 'USA', flag: '🇺🇸' },
  368: { name: 'USA', flag: '🇺🇸' },
  369: { name: 'USA', flag: '🇺🇸' },
  370: { name: 'Panama', flag: '🇵🇦' },
  371: { name: 'Panama', flag: '🇵🇦' },
  372: { name: 'Panama', flag: '🇵🇦' },
  373: { name: 'Panama', flag: '🇵🇦' },
  374: { name: 'Panama', flag: '🇵🇦' },
  375: { name: 'St Vincent', flag: '🇻🇨' },
  376: { name: 'St Vincent', flag: '🇻🇨' },
  377: { name: 'St Vincent', flag: '🇻🇨' },
  378: { name: 'British VI', flag: '🇻🇬' },
  379: { name: 'US VI', flag: '🇻🇮' },
  401: { name: 'Afghanistan', flag: '🇦🇫' },
  403: { name: 'Saudi Arabia', flag: '🇸🇦' },
  405: { name: 'Bangladesh', flag: '🇧🇩' },
  408: { name: 'Bahrain', flag: '🇧🇭' },
  410: { name: 'Bhutan', flag: '🇧🇹' },
  412: { name: 'China', flag: '🇨🇳' },
  413: { name: 'China', flag: '🇨🇳' },
  414: { name: 'China', flag: '🇨🇳' },
  416: { name: 'Taiwan', flag: '🇹🇼' },
  417: { name: 'Sri Lanka', flag: '🇱🇰' },
  419: { name: 'India', flag: '🇮🇳' },
  422: { name: 'Iran', flag: '🇮🇷' },
  423: { name: 'Azerbaijan', flag: '🇦🇿' },
  425: { name: 'Iraq', flag: '🇮🇶' },
  428: { name: 'Israel', flag: '🇮🇱' },
  431: { name: 'Japan', flag: '🇯🇵' },
  432: { name: 'Japan', flag: '🇯🇵' },
  434: { name: 'Turkmenistan', flag: '🇹🇲' },
  436: { name: 'Kazakhstan', flag: '🇰🇿' },
  437: { name: 'Uzbekistan', flag: '🇺🇿' },
  438: { name: 'Jordan', flag: '🇯🇴' },
  440: { name: 'South Korea', flag: '🇰🇷' },
  441: { name: 'South Korea', flag: '🇰🇷' },
  443: { name: 'Palestine', flag: '🇵🇸' },
  445: { name: 'North Korea', flag: '🇰🇵' },
  447: { name: 'Kuwait', flag: '🇰🇼' },
  450: { name: 'Lebanon', flag: '🇱🇧' },
  451: { name: 'Kyrgyzstan', flag: '🇰🇬' },
  453: { name: 'Macao', flag: '🇲🇴' },
  455: { name: 'Maldives', flag: '🇲🇻' },
  457: { name: 'Mongolia', flag: '🇲🇳' },
  459: { name: 'Nepal', flag: '🇳🇵' },
  461: { name: 'Oman', flag: '🇴🇲' },
  463: { name: 'Pakistan', flag: '🇵🇰' },
  466: { name: 'Qatar', flag: '🇶🇦' },
  468: { name: 'Syria', flag: '🇸🇾' },
  470: { name: 'UAE', flag: '🇦🇪' },
  471: { name: 'UAE', flag: '🇦🇪' },
  472: { name: 'Tajikistan', flag: '🇹🇯' },
  473: { name: 'Yemen', flag: '🇾🇪' },
  475: { name: 'Yemen', flag: '🇾🇪' },
  477: { name: 'Hong Kong', flag: '🇭🇰' },
  478: { name: 'Bosnia', flag: '🇧🇦' },
  501: { name: 'Antarctica', flag: '🇦🇶' },
  503: { name: 'Australia', flag: '🇦🇺' },
  506: { name: 'Myanmar', flag: '🇲🇲' },
  508: { name: 'Brunei', flag: '🇧🇳' },
  510: { name: 'Micronesia', flag: '🇫🇲' },
  511: { name: 'Palau', flag: '🇵🇼' },
  512: { name: 'New Zealand', flag: '🇳🇿' },
  514: { name: 'Cambodia', flag: '🇰🇭' },
  515: { name: 'Cambodia', flag: '🇰🇭' },
  516: { name: 'Christmas Island', flag: '🇨🇽' },
  518: { name: 'Cook Islands', flag: '🇨🇰' },
  520: { name: 'Fiji', flag: '🇫🇯' },
  523: { name: 'Cocos Islands', flag: '🇨🇨' },
  525: { name: 'Indonesia', flag: '🇮🇩' },
  529: { name: 'Kiribati', flag: '🇰🇮' },
  531: { name: 'Laos', flag: '🇱🇦' },
  533: { name: 'Malaysia', flag: '🇲🇾' },
  536: { name: 'N. Mariana Is.', flag: '🇲🇵' },
  538: { name: 'Marshall Islands', flag: '🇲🇭' },
  540: { name: 'New Caledonia', flag: '🇳🇨' },
  542: { name: 'Niue', flag: '🇳🇺' },
  544: { name: 'Nauru', flag: '🇳🇷' },
  546: { name: 'French Polynesia', flag: '🇵🇫' },
  548: { name: 'Philippines', flag: '🇵🇭' },
  553: { name: 'Papua New Guinea', flag: '🇵🇬' },
  555: { name: 'Pitcairn', flag: '🇵🇳' },
  557: { name: 'Solomon Islands', flag: '🇸🇧' },
  559: { name: 'Samoa', flag: '🇼🇸' },
  561: { name: 'Singapore', flag: '🇸🇬' },
  563: { name: 'Singapore', flag: '🇸🇬' },
  564: { name: 'Singapore', flag: '🇸🇬' },
  565: { name: 'Singapore', flag: '🇸🇬' },
  566: { name: 'Singapore', flag: '🇸🇬' },
  567: { name: 'Thailand', flag: '🇹🇭' },
  570: { name: 'Tonga', flag: '🇹🇴' },
  572: { name: 'Tuvalu', flag: '🇹🇻' },
  574: { name: 'Vietnam', flag: '🇻🇳' },
  576: { name: 'Vanuatu', flag: '🇻🇺' },
  577: { name: 'Vanuatu', flag: '🇻🇺' },
  578: { name: 'Wallis & Futuna', flag: '🇼🇫' },
  601: { name: 'South Africa', flag: '🇿🇦' },
  603: { name: 'Angola', flag: '🇦🇴' },
  605: { name: 'Algeria', flag: '🇩🇿' },
  607: { name: 'St Paul', flag: '🇹🇫' },
  608: { name: 'Ascension', flag: '🇦🇨' },
  609: { name: 'Burundi', flag: '🇧🇮' },
  610: { name: 'Benin', flag: '🇧🇯' },
  611: { name: 'Botswana', flag: '🇧🇼' },
  612: { name: 'CAR', flag: '🇨🇫' },
  613: { name: 'Cameroon', flag: '🇨🇲' },
  615: { name: 'DR Congo', flag: '🇨🇩' },
  616: { name: 'Comoros', flag: '🇰🇲' },
  617: { name: 'Cabo Verde', flag: '🇨🇻' },
  618: { name: 'Crozet', flag: '🇹🇫' },
  619: { name: 'Ivory Coast', flag: '🇨🇮' },
  620: { name: 'Comoros', flag: '🇰🇲' },
  621: { name: 'Djibouti', flag: '🇩🇯' },
  622: { name: 'Egypt', flag: '🇪🇬' },
  624: { name: 'Ethiopia', flag: '🇪🇹' },
  625: { name: 'Eritrea', flag: '🇪🇷' },
  626: { name: 'Gabon', flag: '🇬🇦' },
  627: { name: 'Ghana', flag: '🇬🇭' },
  629: { name: 'Gambia', flag: '🇬🇲' },
  630: { name: 'Guinea-Bissau', flag: '🇬🇼' },
  631: { name: 'Eq. Guinea', flag: '🇬🇶' },
  632: { name: 'Guinea', flag: '🇬🇳' },
  633: { name: 'Burkina Faso', flag: '🇧🇫' },
  634: { name: 'Kenya', flag: '🇰🇪' },
  635: { name: 'Kerguelen', flag: '🇹🇫' },
  636: { name: 'Liberia', flag: '🇱🇷' },
  637: { name: 'Liberia', flag: '🇱🇷' },
  638: { name: 'South Sudan', flag: '🇸🇸' },
  642: { name: 'Libya', flag: '🇱🇾' },
  644: { name: 'Lesotho', flag: '🇱🇸' },
  645: { name: 'Mauritius', flag: '🇲🇺' },
  647: { name: 'Madagascar', flag: '🇲🇬' },
  649: { name: 'Mali', flag: '🇲🇱' },
  650: { name: 'Mozambique', flag: '🇲🇿' },
  654: { name: 'Mauritania', flag: '🇲🇷' },
  655: { name: 'Malawi', flag: '🇲🇼' },
  656: { name: 'Niger', flag: '🇳🇪' },
  657: { name: 'Nigeria', flag: '🇳🇬' },
  659: { name: 'Namibia', flag: '🇳🇦' },
  660: { name: 'Réunion', flag: '🇷🇪' },
  661: { name: 'Rwanda', flag: '🇷🇼' },
  662: { name: 'Sudan', flag: '🇸🇩' },
  663: { name: 'Senegal', flag: '🇸🇳' },
  664: { name: 'Seychelles', flag: '🇸🇨' },
  665: { name: 'St Helena', flag: '🇸🇭' },
  666: { name: 'Somalia', flag: '🇸🇴' },
  667: { name: 'Sierra Leone', flag: '🇸🇱' },
  668: { name: 'São Tomé', flag: '🇸🇹' },
  669: { name: 'Eswatini', flag: '🇸🇿' },
  670: { name: 'Chad', flag: '🇹🇩' },
  671: { name: 'Togo', flag: '🇹🇬' },
  672: { name: 'Tunisia', flag: '🇹🇳' },
  674: { name: 'Tanzania', flag: '🇹🇿' },
  675: { name: 'Uganda', flag: '🇺🇬' },
  676: { name: 'Congo', flag: '🇨🇬' },
  677: { name: 'Tanzania', flag: '🇹🇿' },
  678: { name: 'Zambia', flag: '🇿🇲' },
  679: { name: 'Zimbabwe', flag: '🇿🇼' },
  701: { name: 'Argentina', flag: '🇦🇷' },
  710: { name: 'Brazil', flag: '🇧🇷' },
  720: { name: 'Bolivia', flag: '🇧🇴' },
  725: { name: 'Chile', flag: '🇨🇱' },
  730: { name: 'Colombia', flag: '🇨🇴' },
  735: { name: 'Ecuador', flag: '🇪🇨' },
  740: { name: 'Falkland Is.', flag: '🇫🇰' },
  745: { name: 'Guiana', flag: '🇬🇫' },
  750: { name: 'Guyana', flag: '🇬🇾' },
  755: { name: 'Paraguay', flag: '🇵🇾' },
  760: { name: 'Peru', flag: '🇵🇪' },
  765: { name: 'Suriname', flag: '🇸🇷' },
  770: { name: 'Uruguay', flag: '🇺🇾' },
  775: { name: 'Venezuela', flag: '🇻🇪' },
};

// Get country info from MMSI
function getCountryFromMMSI(mmsi) {
  const mid = Math.floor(mmsi / 1000000); // First 3 digits
  return MID_TO_COUNTRY[mid] || { name: 'Unknown', flag: '🏳️' };
}

// Get readable ship type from code
function getShipType(typeCode) {
  if (typeCode === undefined || typeCode === null) return 'Unknown';
  // Handle ranges
  if (typeCode >= 20 && typeCode <= 29) return 'Wing in Ground';
  if (typeCode >= 40 && typeCode <= 49) return 'High Speed Craft';
  if (typeCode >= 60 && typeCode <= 69) return 'Passenger';
  if (typeCode >= 70 && typeCode <= 79) return 'Cargo';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  if (typeCode >= 90 && typeCode <= 99) return 'Other';
  return SHIP_TYPES[typeCode] || 'Unknown';
}

class ShipTracker {
  constructor() {
    this.ships = new Map();
    this.socket = null;
    this.onShipEnter = null;
    this.onShipExit = null;
    this.onShipMove = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.staleCheckInterval = null;
  }

  connect() {
    // Connect to WebSocket proxy - detect local vs production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = host.includes('localhost')
      ? 'ws://localhost:3001/ws'
      : `${protocol}//${host}/ws`;
    console.log('Connecting to:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      return;
    }

    this.socket.onopen = () => {
      console.log('Connected to proxy server');
      this.reconnectAttempts = 0;

      // Start checking for stale ships (no update in 5 minutes)
      this.staleCheckInterval = setInterval(() => this.removeStaleShips(), 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.attemptReconnect();
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      console.error('WebSocket readyState:', this.socket.readyState);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  handleMessage(data) {
    // aisstream.io message format
    const msgType = data.MessageType;
    if (msgType !== 'PositionReport') return;

    const meta = data.MetaData;
    const pos = data.Message?.PositionReport;

    if (!meta || !pos) return;

    const mmsi = meta.MMSI;
    const lat = pos.Latitude;
    const lon = pos.Longitude;

    // Skip invalid positions
    if (lat === 0 && lon === 0) return;
    if (!this.isInBounds(lat, lon)) return;

    // Normalize position to 0-1 range
    const normalized = this.normalizePosition(lat, lon);

    // Filter out ships outside the circular sonar zone
    const dx = normalized.x - 0.5;
    const dy = normalized.y - 0.5;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    if (distanceFromCenter > 0.45) return; // Slightly inside edge for visual margin

    // Get ship type and country
    const shipType = getShipType(meta.ShipType);
    const country = getCountryFromMMSI(mmsi);

    const shipData = {
      mmsi,
      name: meta.ShipName?.trim() || `Ship ${mmsi}`,
      lat,
      lon,
      x: normalized.x,
      y: normalized.y,
      speed: pos.Sog || 0,
      course: pos.Cog || 0,
      shipType,
      country,
      lastUpdate: Date.now()
    };

    const isNew = !this.ships.has(mmsi);
    this.ships.set(mmsi, shipData);

    if (isNew) {
      console.log(`Ship entered: ${shipData.name}`);
      this.onShipEnter?.(shipData);
    } else {
      this.onShipMove?.(shipData);
    }
  }

  isInBounds(lat, lon) {
    return (
      lat >= BOUNDING_BOX.minLat &&
      lat <= BOUNDING_BOX.maxLat &&
      lon >= BOUNDING_BOX.minLon &&
      lon <= BOUNDING_BOX.maxLon
    );
  }

  normalizePosition(lat, lon) {
    const x = (lon - BOUNDING_BOX.minLon) / (BOUNDING_BOX.maxLon - BOUNDING_BOX.minLon);
    const y = (lat - BOUNDING_BOX.minLat) / (BOUNDING_BOX.maxLat - BOUNDING_BOX.minLat);
    return { x, y };
  }

  removeStaleShips() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [mmsi, ship] of this.ships) {
      if (now - ship.lastUpdate > staleThreshold) {
        console.log(`Ship exited (stale): ${ship.name}`);
        this.ships.delete(mmsi);
        this.onShipExit?.(ship);
      }
    }
  }

  getShips() {
    return Array.from(this.ships.values());
  }

  getShipCount() {
    return this.ships.size;
  }

  disconnect() {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
    }
    if (this.socket) {
      this.socket.close();
    }
  }
}

export const shipTracker = new ShipTracker();
