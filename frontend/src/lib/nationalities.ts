// Companies House records PSC nationality as a demonym ("British", "Polish").
// Map the common ones to an ISO 3166-1 alpha-2 code so we can show a flag.
// Unknown demonyms simply get no flag.
const DEMONYM_TO_CODE: Record<string, string> = {
  british: "GB", english: "GB", scottish: "GB", welsh: "GB", "northern irish": "GB",
  irish: "IE", french: "FR", german: "DE", italian: "IT", spanish: "ES",
  portuguese: "PT", dutch: "NL", belgian: "BE", luxembourgish: "LU", swiss: "CH",
  austrian: "AT", danish: "DK", swedish: "SE", norwegian: "NO", finnish: "FI",
  icelandic: "IS", polish: "PL", czech: "CZ", slovak: "SK", hungarian: "HU",
  romanian: "RO", bulgarian: "BG", greek: "GR", "cypriot": "CY", maltese: "MT",
  croatian: "HR", slovenian: "SI", serbian: "RS", lithuanian: "LT", latvian: "LV",
  estonian: "EE", russian: "RU", ukrainian: "UA", belarusian: "BY", turkish: "TR",
  american: "US", canadian: "CA", mexican: "MX", brazilian: "BR", argentine: "AR",
  argentinian: "AR", chilean: "CL", colombian: "CO", australian: "AU",
  "new zealander": "NZ", "new zealand": "NZ", indian: "IN", pakistani: "PK",
  bangladeshi: "BD", "sri lankan": "LK", nepalese: "NP", chinese: "CN",
  "hong kong": "HK", taiwanese: "TW", japanese: "JP", korean: "KR",
  "south korean": "KR", singaporean: "SG", malaysian: "MY", indonesian: "ID",
  thai: "TH", vietnamese: "VN", filipino: "PH", emirati: "AE", "saudi arabian": "SA",
  saudi: "SA", qatari: "QA", kuwaiti: "KW", bahraini: "BH", omani: "OM",
  israeli: "IL", lebanese: "LB", jordanian: "JO", egyptian: "EG", iranian: "IR",
  iraqi: "IQ", "south african": "ZA", nigerian: "NG", ghanaian: "GH", kenyan: "KE",
  zimbabwean: "ZW", moroccan: "MA", algerian: "DZ", tunisian: "TN", mauritian: "MU",
};

export function nationalityToCode(nationality?: string): string | undefined {
  if (!nationality) return undefined;
  return DEMONYM_TO_CODE[nationality.trim().toLowerCase()];
}
