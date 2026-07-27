/**
 * Canonical college list — the single source of truth for both the app picker
 * and the Supabase `colleges` seed.
 *
 * Why a local file and not a Supabase query: onboarding must not wait on a
 * network round trip, and the list is static. `scripts/emit-colleges-sql.ts`
 * generates the DDL/seed from this file so the two can never drift; run it and
 * re-paste whenever you add a school (same pattern as the venues parity
 * backfill).
 *
 * `slug` is the join key, NOT a uuid: it keeps this file and the database
 * readable and diffable, and `profiles.college_slug` FKs straight to it.
 * Slugs are permanent — renaming one orphans every profile pointing at it.
 *
 * region drives the default (unsearched) ordering only; search spans the whole
 * list. HWS is first deliberately — it's the fall campus beachhead.
 */

export type CollegeRegion =
  | "launch"
  | "nyc"
  | "ny"
  | "ma"
  | "ct"
  | "nj"
  | "northeast"
  | "national";

export type College = {
  slug: string;
  name: string;
  city: string;
  state: string;
  region: CollegeRegion;
};

/** Lower sorts first in the browse list. */
export const REGION_ORDER: Record<CollegeRegion, number> = {
  launch: 0,
  nyc: 10,
  ny: 20,
  nj: 30,
  ct: 40,
  ma: 50,
  northeast: 60,
  national: 70,
};

export const COLLEGES: College[] = [
  // ── Launch campus (fall beachhead) ──
  { slug: "hws", name: "Hobart and William Smith Colleges", city: "Geneva", state: "NY", region: "launch" },

  // ── New York City (East Village beachhead) ──
  { slug: "nyu", name: "New York University", city: "New York", state: "NY", region: "nyc" },
  { slug: "columbia", name: "Columbia University", city: "New York", state: "NY", region: "nyc" },
  { slug: "barnard", name: "Barnard College", city: "New York", state: "NY", region: "nyc" },
  { slug: "the-new-school", name: "The New School", city: "New York", state: "NY", region: "nyc" },
  { slug: "parsons", name: "Parsons School of Design", city: "New York", state: "NY", region: "nyc" },
  { slug: "cooper-union", name: "The Cooper Union", city: "New York", state: "NY", region: "nyc" },
  { slug: "fordham", name: "Fordham University", city: "New York", state: "NY", region: "nyc" },
  { slug: "pace", name: "Pace University", city: "New York", state: "NY", region: "nyc" },
  { slug: "baruch", name: "Baruch College (CUNY)", city: "New York", state: "NY", region: "nyc" },
  { slug: "hunter", name: "Hunter College (CUNY)", city: "New York", state: "NY", region: "nyc" },
  { slug: "ccny", name: "City College of New York (CUNY)", city: "New York", state: "NY", region: "nyc" },
  { slug: "brooklyn-college", name: "Brooklyn College (CUNY)", city: "Brooklyn", state: "NY", region: "nyc" },
  { slug: "queens-college", name: "Queens College (CUNY)", city: "Queens", state: "NY", region: "nyc" },
  { slug: "john-jay", name: "John Jay College (CUNY)", city: "New York", state: "NY", region: "nyc" },
  { slug: "fit", name: "Fashion Institute of Technology", city: "New York", state: "NY", region: "nyc" },
  { slug: "sva", name: "School of Visual Arts", city: "New York", state: "NY", region: "nyc" },
  { slug: "pratt", name: "Pratt Institute", city: "Brooklyn", state: "NY", region: "nyc" },
  { slug: "juilliard", name: "The Juilliard School", city: "New York", state: "NY", region: "nyc" },
  { slug: "marymount-manhattan", name: "Marymount Manhattan College", city: "New York", state: "NY", region: "nyc" },
  { slug: "yeshiva", name: "Yeshiva University", city: "New York", state: "NY", region: "nyc" },
  { slug: "st-johns", name: "St. John's University", city: "Queens", state: "NY", region: "nyc" },
  { slug: "manhattan", name: "Manhattan University", city: "Bronx", state: "NY", region: "nyc" },
  { slug: "hofstra", name: "Hofstra University", city: "Hempstead", state: "NY", region: "nyc" },
  { slug: "stony-brook", name: "Stony Brook University", city: "Stony Brook", state: "NY", region: "nyc" },

  // ── Rest of New York ──
  { slug: "cornell", name: "Cornell University", city: "Ithaca", state: "NY", region: "ny" },
  { slug: "syracuse", name: "Syracuse University", city: "Syracuse", state: "NY", region: "ny" },
  { slug: "rochester", name: "University of Rochester", city: "Rochester", state: "NY", region: "ny" },
  { slug: "rit", name: "Rochester Institute of Technology", city: "Rochester", state: "NY", region: "ny" },
  { slug: "colgate", name: "Colgate University", city: "Hamilton", state: "NY", region: "ny" },
  { slug: "hamilton", name: "Hamilton College", city: "Clinton", state: "NY", region: "ny" },
  { slug: "skidmore", name: "Skidmore College", city: "Saratoga Springs", state: "NY", region: "ny" },
  { slug: "union", name: "Union College", city: "Schenectady", state: "NY", region: "ny" },
  { slug: "vassar", name: "Vassar College", city: "Poughkeepsie", state: "NY", region: "ny" },
  { slug: "bard", name: "Bard College", city: "Annandale-on-Hudson", state: "NY", region: "ny" },
  { slug: "ithaca", name: "Ithaca College", city: "Ithaca", state: "NY", region: "ny" },
  { slug: "st-lawrence", name: "St. Lawrence University", city: "Canton", state: "NY", region: "ny" },
  { slug: "rpi", name: "Rensselaer Polytechnic Institute", city: "Troy", state: "NY", region: "ny" },
  { slug: "binghamton", name: "Binghamton University (SUNY)", city: "Binghamton", state: "NY", region: "ny" },
  { slug: "suny-albany", name: "University at Albany (SUNY)", city: "Albany", state: "NY", region: "ny" },
  { slug: "suny-buffalo", name: "University at Buffalo (SUNY)", city: "Buffalo", state: "NY", region: "ny" },
  { slug: "suny-geneseo", name: "SUNY Geneseo", city: "Geneseo", state: "NY", region: "ny" },
  { slug: "suny-cortland", name: "SUNY Cortland", city: "Cortland", state: "NY", region: "ny" },

  // ── New Jersey ──
  { slug: "princeton", name: "Princeton University", city: "Princeton", state: "NJ", region: "nj" },
  { slug: "rutgers", name: "Rutgers University", city: "New Brunswick", state: "NJ", region: "nj" },
  { slug: "seton-hall", name: "Seton Hall University", city: "South Orange", state: "NJ", region: "nj" },
  { slug: "stevens", name: "Stevens Institute of Technology", city: "Hoboken", state: "NJ", region: "nj" },
  { slug: "tcnj", name: "The College of New Jersey", city: "Ewing", state: "NJ", region: "nj" },
  { slug: "montclair-state", name: "Montclair State University", city: "Montclair", state: "NJ", region: "nj" },
  { slug: "rowan", name: "Rowan University", city: "Glassboro", state: "NJ", region: "nj" },
  { slug: "fdu", name: "Fairleigh Dickinson University", city: "Teaneck", state: "NJ", region: "nj" },
  { slug: "ramapo", name: "Ramapo College of New Jersey", city: "Mahwah", state: "NJ", region: "nj" },
  { slug: "monmouth", name: "Monmouth University", city: "West Long Branch", state: "NJ", region: "nj" },

  // ── Connecticut ──
  { slug: "yale", name: "Yale University", city: "New Haven", state: "CT", region: "ct" },
  { slug: "uconn", name: "University of Connecticut", city: "Storrs", state: "CT", region: "ct" },
  { slug: "trinity-ct", name: "Trinity College", city: "Hartford", state: "CT", region: "ct" },
  { slug: "wesleyan", name: "Wesleyan University", city: "Middletown", state: "CT", region: "ct" },
  { slug: "fairfield", name: "Fairfield University", city: "Fairfield", state: "CT", region: "ct" },
  { slug: "quinnipiac", name: "Quinnipiac University", city: "Hamden", state: "CT", region: "ct" },
  { slug: "conn-college", name: "Connecticut College", city: "New London", state: "CT", region: "ct" },
  { slug: "sacred-heart", name: "Sacred Heart University", city: "Fairfield", state: "CT", region: "ct" },
  { slug: "hartford", name: "University of Hartford", city: "West Hartford", state: "CT", region: "ct" },

  // ── Massachusetts ──
  { slug: "harvard", name: "Harvard University", city: "Cambridge", state: "MA", region: "ma" },
  { slug: "mit", name: "Massachusetts Institute of Technology", city: "Cambridge", state: "MA", region: "ma" },
  { slug: "bc", name: "Boston College", city: "Chestnut Hill", state: "MA", region: "ma" },
  { slug: "bu", name: "Boston University", city: "Boston", state: "MA", region: "ma" },
  { slug: "northeastern", name: "Northeastern University", city: "Boston", state: "MA", region: "ma" },
  { slug: "tufts", name: "Tufts University", city: "Medford", state: "MA", region: "ma" },
  { slug: "umass-amherst", name: "UMass Amherst", city: "Amherst", state: "MA", region: "ma" },
  { slug: "umass-boston", name: "UMass Boston", city: "Boston", state: "MA", region: "ma" },
  { slug: "emerson", name: "Emerson College", city: "Boston", state: "MA", region: "ma" },
  { slug: "suffolk", name: "Suffolk University", city: "Boston", state: "MA", region: "ma" },
  { slug: "bentley", name: "Bentley University", city: "Waltham", state: "MA", region: "ma" },
  { slug: "babson", name: "Babson College", city: "Wellesley", state: "MA", region: "ma" },
  { slug: "brandeis", name: "Brandeis University", city: "Waltham", state: "MA", region: "ma" },
  { slug: "holy-cross", name: "College of the Holy Cross", city: "Worcester", state: "MA", region: "ma" },
  { slug: "williams", name: "Williams College", city: "Williamstown", state: "MA", region: "ma" },
  { slug: "amherst", name: "Amherst College", city: "Amherst", state: "MA", region: "ma" },
  { slug: "smith", name: "Smith College", city: "Northampton", state: "MA", region: "ma" },
  { slug: "mount-holyoke", name: "Mount Holyoke College", city: "South Hadley", state: "MA", region: "ma" },
  { slug: "wellesley", name: "Wellesley College", city: "Wellesley", state: "MA", region: "ma" },
  { slug: "clark", name: "Clark University", city: "Worcester", state: "MA", region: "ma" },
  { slug: "wpi", name: "Worcester Polytechnic Institute", city: "Worcester", state: "MA", region: "ma" },
  { slug: "stonehill", name: "Stonehill College", city: "Easton", state: "MA", region: "ma" },

  // ── Rest of the Northeast ──
  { slug: "johns-hopkins", name: "Johns Hopkins University", city: "Baltimore", state: "MD", region: "northeast" },
  { slug: "maryland", name: "University of Maryland", city: "College Park", state: "MD", region: "northeast" },
  { slug: "georgetown", name: "Georgetown University", city: "Washington", state: "DC", region: "northeast" },
  { slug: "gwu", name: "George Washington University", city: "Washington", state: "DC", region: "northeast" },
  { slug: "american", name: "American University", city: "Washington", state: "DC", region: "northeast" },
  { slug: "penn", name: "University of Pennsylvania", city: "Philadelphia", state: "PA", region: "northeast" },
  { slug: "villanova", name: "Villanova University", city: "Villanova", state: "PA", region: "northeast" },
  { slug: "temple", name: "Temple University", city: "Philadelphia", state: "PA", region: "northeast" },
  { slug: "drexel", name: "Drexel University", city: "Philadelphia", state: "PA", region: "northeast" },
  { slug: "lehigh", name: "Lehigh University", city: "Bethlehem", state: "PA", region: "northeast" },
  { slug: "bucknell", name: "Bucknell University", city: "Lewisburg", state: "PA", region: "northeast" },
  { slug: "lafayette", name: "Lafayette College", city: "Easton", state: "PA", region: "northeast" },
  { slug: "penn-state", name: "Penn State University", city: "University Park", state: "PA", region: "northeast" },
  { slug: "pitt", name: "University of Pittsburgh", city: "Pittsburgh", state: "PA", region: "northeast" },
  { slug: "brown", name: "Brown University", city: "Providence", state: "RI", region: "northeast" },
  { slug: "providence", name: "Providence College", city: "Providence", state: "RI", region: "northeast" },
  { slug: "uri", name: "University of Rhode Island", city: "Kingston", state: "RI", region: "northeast" },
  { slug: "dartmouth", name: "Dartmouth College", city: "Hanover", state: "NH", region: "northeast" },
  { slug: "unh", name: "University of New Hampshire", city: "Durham", state: "NH", region: "northeast" },
  { slug: "uvm", name: "University of Vermont", city: "Burlington", state: "VT", region: "northeast" },
  { slug: "middlebury", name: "Middlebury College", city: "Middlebury", state: "VT", region: "northeast" },
  { slug: "bowdoin", name: "Bowdoin College", city: "Brunswick", state: "ME", region: "northeast" },
  { slug: "colby", name: "Colby College", city: "Waterville", state: "ME", region: "northeast" },
  { slug: "bates", name: "Bates College", city: "Lewiston", state: "ME", region: "northeast" },
  { slug: "delaware", name: "University of Delaware", city: "Newark", state: "DE", region: "northeast" },

  // ── Major national ──
  { slug: "virginia", name: "University of Virginia", city: "Charlottesville", state: "VA", region: "national" },
  { slug: "virginia-tech", name: "Virginia Tech", city: "Blacksburg", state: "VA", region: "national" },
  { slug: "duke", name: "Duke University", city: "Durham", state: "NC", region: "national" },
  { slug: "unc", name: "University of North Carolina", city: "Chapel Hill", state: "NC", region: "national" },
  { slug: "elon", name: "Elon University", city: "Elon", state: "NC", region: "national" },
  { slug: "vanderbilt", name: "Vanderbilt University", city: "Nashville", state: "TN", region: "national" },
  { slug: "emory", name: "Emory University", city: "Atlanta", state: "GA", region: "national" },
  { slug: "georgia", name: "University of Georgia", city: "Athens", state: "GA", region: "national" },
  { slug: "clemson", name: "Clemson University", city: "Clemson", state: "SC", region: "national" },
  { slug: "alabama", name: "University of Alabama", city: "Tuscaloosa", state: "AL", region: "national" },
  { slug: "tulane", name: "Tulane University", city: "New Orleans", state: "LA", region: "national" },
  { slug: "miami", name: "University of Miami", city: "Coral Gables", state: "FL", region: "national" },
  { slug: "florida", name: "University of Florida", city: "Gainesville", state: "FL", region: "national" },
  { slug: "florida-state", name: "Florida State University", city: "Tallahassee", state: "FL", region: "national" },
  { slug: "michigan", name: "University of Michigan", city: "Ann Arbor", state: "MI", region: "national" },
  { slug: "michigan-state", name: "Michigan State University", city: "East Lansing", state: "MI", region: "national" },
  { slug: "ohio-state", name: "Ohio State University", city: "Columbus", state: "OH", region: "national" },
  { slug: "indiana", name: "Indiana University", city: "Bloomington", state: "IN", region: "national" },
  { slug: "notre-dame", name: "University of Notre Dame", city: "Notre Dame", state: "IN", region: "national" },
  { slug: "wisconsin", name: "University of Wisconsin–Madison", city: "Madison", state: "WI", region: "national" },
  { slug: "illinois", name: "University of Illinois", city: "Urbana-Champaign", state: "IL", region: "national" },
  { slug: "northwestern", name: "Northwestern University", city: "Evanston", state: "IL", region: "national" },
  { slug: "chicago", name: "University of Chicago", city: "Chicago", state: "IL", region: "national" },
  { slug: "wash-u", name: "Washington University in St. Louis", city: "St. Louis", state: "MO", region: "national" },
  { slug: "texas", name: "University of Texas at Austin", city: "Austin", state: "TX", region: "national" },
  { slug: "smu", name: "Southern Methodist University", city: "Dallas", state: "TX", region: "national" },
  { slug: "colorado", name: "University of Colorado Boulder", city: "Boulder", state: "CO", region: "national" },
  { slug: "arizona-state", name: "Arizona State University", city: "Tempe", state: "AZ", region: "national" },
  { slug: "arizona", name: "University of Arizona", city: "Tucson", state: "AZ", region: "national" },
  { slug: "usc", name: "University of Southern California", city: "Los Angeles", state: "CA", region: "national" },
  { slug: "ucla", name: "UCLA", city: "Los Angeles", state: "CA", region: "national" },
  { slug: "berkeley", name: "UC Berkeley", city: "Berkeley", state: "CA", region: "national" },
  { slug: "stanford", name: "Stanford University", city: "Stanford", state: "CA", region: "national" },
  { slug: "san-diego", name: "UC San Diego", city: "La Jolla", state: "CA", region: "national" },
  { slug: "washington", name: "University of Washington", city: "Seattle", state: "WA", region: "national" },
  { slug: "mcgill", name: "McGill University", city: "Montreal", state: "QC", region: "national" },
];

const BY_SLUG = new Map(COLLEGES.map((c) => [c.slug, c]));

export function getCollege(slug: string | null | undefined): College | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

/**
 * Browse order: launch campus, then beachhead city, then outward. Search spans
 * everything, so this only governs the unfiltered list.
 */
export const COLLEGES_SORTED = [...COLLEGES].sort(
  (a, b) => REGION_ORDER[a.region] - REGION_ORDER[b.region] || a.name.localeCompare(b.name),
);

/**
 * Substring match over name, city and slug so "nyu", "new york" and "geneva"
 * all land. Deliberately not fuzzy — a wrong-but-confident match is worse than
 * no match when the result is a permanent profile field.
 */
export function searchColleges(query: string): College[] {
  const q = query.trim().toLowerCase();
  if (!q) return COLLEGES_SORTED;
  return COLLEGES_SORTED.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.slug.includes(q),
  );
}

/** Class-year range: wide enough for alumni, bounded so the list stays usable. */
export function classYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  const years: number[] = [];
  for (let v = y + 6; v >= y - 20; v--) years.push(v);
  return years;
}

/** An alum is anyone whose class year has already passed. */
export function isAlum(classYear: number | null | undefined, now = new Date()): boolean {
  return typeof classYear === "number" && classYear < now.getFullYear();
}

/** Display form: "NYU '27". Falls back to the school alone when year is unset. */
export function collegeLabel(
  slug: string | null | undefined,
  classYear: number | null | undefined,
): string | null {
  const college = getCollege(slug);
  if (!college) return null;
  if (typeof classYear !== "number") return college.name;
  return `${college.name} '${String(classYear).slice(-2)}`;
}
