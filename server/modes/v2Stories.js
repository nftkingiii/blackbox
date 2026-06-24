function makePack(modeId, prefix, entry, index, defaults) {
  const [title, answer, intro, clue1, clue2, clue3, emoji] = entry;
  const clues = [
    { at: 1, type: defaults.firstClueType, payload: clue1 },
    { at: 0.66, type: defaults.secondClueType, payload: clue2 },
    emoji
      ? { at: 0.33, type: "emoji", payload: emoji }
      : { at: 0.33, type: "hint", payload: clue3 }
  ];

  return {
    id: `${prefix}-${String(index + 5).padStart(2, "0")}-${answer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    modeId,
    title,
    creator: "BlackBox",
    intro,
    answer,
    answerType: defaults.answerType,
    maskStyle: defaults.maskStyle,
    timerSec: defaults.timerSec,
    difficulty: index % 4 === 3 ? "hard" : index % 3 === 0 ? "easy" : "medium",
    tags: defaults.tags,
    clues,
    zeroG: { uri: `0g://blackbox/seed/${prefix}-${answer.toLowerCase()}` }
  };
}

const seedEntries = [
  ["The Night Compass", "north", "A recovery card points toward a direction that never moves on a map.", "The needle settles toward the top edge of every chart.", "Explorers use this direction to orient a map.", "A cardinal direction. Five letters.", "🧭⬆️"],
  ["The Silent Library", "index", "A numbered wallet archive has lost the word used to locate every record.", "The final pages list topics beside page numbers.", "Databases use this structure to find information quickly.", "A guide for locating entries. Five letters."],
  ["The Glass Signal", "prism", "A light-based key device splits one beam into a hidden sequence.", "One white beam enters and several colors leave.", "It is often made of glass and bends light.", "A solid that separates light. Five letters.", "⬜🌈"],
  ["The Winter Ledger", "frost", "A metal backup was recovered from a freezer with one weather-word erased.", "A thin white layer covered the etched plate.", "It forms when water vapor freezes on a cold surface.", "A cold crystal coating. Five letters.", "❄️🧊"],
  ["The Paper Current", "river", "A phrase was hidden in a map where one flowing landmark was blacked out.", "The route follows a winding blue line toward the sea.", "It has banks but stores no money.", "A natural flowing waterway. Five letters.", "🏞️💧"],
  ["The Beacon Archive", "signal", "A radio wallet repeats one missing transmission word every midnight.", "The receiver shows bars whenever the message returns.", "It carries information across a distance.", "A transmitted indication. Six letters.", "📡〰️"],
  ["The Lunar Key", "crater", "A moon-map backup is missing the name of its largest circular mark.", "The feature was formed by a violent impact.", "The moon is covered in these bowl-shaped hollows.", "An impact depression. Six letters.", "🌕🕳️"],
  ["The Quiet Workshop", "hammer", "A tool inventory concealed a phrase word among repair equipment.", "It has a weighted head fixed to a handle.", "It drives nails without turning them.", "A striking tool. Six letters.", "🔨"],
  ["The Amber Circuit", "resin", "A circuit-board backup sealed its missing word inside hardened tree material.", "The substance began as sticky sap.", "It can preserve insects for millions of years.", "A hardened organic substance. Five letters."],
  ["The Dawn Terminal", "sunrise", "A timed vault opens when the horizon matches its missing phrase word.", "Darkness fades as the eastern sky brightens.", "It happens once each morning.", "The sun appearing above the horizon. Seven letters.", "🌅"],
  ["The Hidden Pantry", "pepper", "A kitchen inventory contains one spicy recovery word hidden in static.", "The note warns that grinding it may cause a sneeze.", "It comes in black grains and sits beside salt.", "A common table spice. Six letters.", "🧂🌶️"],
  ["The Echo Chamber", "whisper", "A voice-locked wallet accepts only a very quiet missing word.", "The recording is speech without full vocal volume.", "It is softer than ordinary conversation.", "A hushed way of speaking. Seven letters.", "🤫🗣️"],
  ["The Stone Garden", "marble", "A sculpture manifest masks the material used for every statue.", "The polished surface shows pale veins.", "Classical sculptors carved figures from it.", "A hard decorative stone. Six letters."],
  ["The Storm Cabinet", "thunder", "A weather station stored one loud phrase word after a flash.", "The sound arrives after lightning because it travels slower.", "It is heard during a storm.", "The booming sound after lightning. Seven letters.", "⚡🔊"],
  ["The Clockmaker's Note", "minute", "A timed safe is missing the unit between seconds and hours.", "Sixty seconds complete one of these.", "A clock counts sixty of them in an hour.", "A unit of time. Six letters.", "⏱️6️⃣0️⃣"],
  ["The Folded Sky", "cloud", "A weather backup replaced one floating object with symbols.", "It can be white, gray, thin, or heavy with rain.", "It drifts through the sky and is made of droplets.", "A visible mass in the sky. Five letters.", "☁️"]
];

const wrongNumberEntries = [
  ["The Broken Tooth", "dentist", "A nervous stranger is sending photos of a cracked molar.", "Message 1: 'It hurts whenever I drink something cold.'", "Message 2: 'Can you fit me in before the swelling gets worse?'", "They think you treat teeth. Seven letters.", "🦷🩺"],
  ["The Delayed Flight", "pilot", "An airport dispatcher keeps asking why the aircraft has not left.", "Message 1: 'Runway three is clear and the passengers are boarded.'", "Message 2: 'Confirm your heading before you taxi.'", "They think you fly an aircraft. Five letters.", "✈️👨‍✈️"],
  ["The Vanishing Bouquet", "florist", "A wedding planner is texting about flowers that never arrived.", "Message 1: 'The roses are wilting and the ceremony starts at four.'", "Message 2: 'Can you rebuild the bridal arrangement in white?'", "They think you arrange and sell flowers. Seven letters.", "💐✂️"],
  ["The Empty Classroom", "teacher", "A parent believes you are responsible for tomorrow's lesson.", "Message 1: 'Is the science test still happening on Friday?'", "Message 2: 'My son left his workbook under his desk.'", "They think you educate students. Seven letters.", "🏫📚"],
  ["The Leaking Ceiling", "plumber", "A tenant keeps sending videos of water dripping through a light fixture.", "Message 1: 'I shut the valve but the pipe is still knocking.'", "Message 2: 'Please bring the wrench you used last time.'", "They think you repair water pipes. Seven letters.", "🔧🚰"],
  ["The Missing Portrait", "photographer", "A couple is asking when their edited ceremony pictures will arrive.", "Message 1: 'Can you remove the glare from the sunset photo?'", "Message 2: 'We still need the full-resolution gallery link.'", "They think you take professional photographs. Twelve letters.", "📷✨"],
  ["The Burnt Souffle", "chef", "A restaurant manager thinks you are running tonight's kitchen.", "Message 1: 'Table nine sent the sauce back twice.'", "Message 2: 'The dinner rush starts in twenty minutes. Where are you?'", "They think you cook professionally. Four letters.", "👨‍🍳🍽️"],
  ["The Final Rehearsal", "conductor", "An orchestra member is asking about tempo changes before a concert.", "Message 1: 'Are the violins entering after your second cue?'", "Message 2: 'The brass section needs the revised score.'", "They think you direct an orchestra. Nine letters.", "🎼🎻"],
  ["The Locked Apartment", "locksmith", "A resident is waiting outside and thinks you have the tools to help.", "Message 1: 'The key snapped inside the front door.'", "Message 2: 'Can you open it without replacing the whole lock?'", "They think you make or repair locks. Nine letters.", "🔐🗝️"],
  ["The Fading Tattoo", "artist", "A customer is asking how to repair a detailed design on their arm.", "Message 1: 'The blue lines healed much lighter than the black ones.'", "Message 2: 'Should I book a touch-up session next month?'", "They think you create visual artwork. Six letters.", "🎨✍️"],
  ["The Stray Patient", "veterinarian", "Someone is describing an animal that refuses to eat.", "Message 1: 'The cat has been hiding under the bed all day.'", "Message 2: 'Should I bring her vaccination records?'", "They think you provide medical care for animals. Twelve letters.", "🐈🩺"],
  ["The Court Deadline", "lawyer", "A client is urgently forwarding contracts and hearing dates.", "Message 1: 'The other side changed clause twelve again.'", "Message 2: 'Will you speak for me at the hearing tomorrow?'", "They think you practice law. Six letters.", "⚖️📄"],
  ["The Tangled Cut", "hairdresser", "A customer is sending reference photos for a drastic new hairstyle.", "Message 1: 'Please keep the length but remove the damaged ends.'", "Message 2: 'Can you match this fringe before Saturday?'", "They think you cut and style hair. Eleven letters.", "💇✂️"],
  ["The Dark Stage", "electrician", "A theater manager thinks you can restore power before opening night.", "Message 1: 'The breaker trips whenever the spotlight turns on.'", "Message 2: 'Please test the new wiring above the stage.'", "They think you install and repair electrical systems. Eleven letters.", "⚡🧰"],
  ["The Missing Parcel", "courier", "A customer keeps asking why a tracked package stopped moving.", "Message 1: 'The address is correct, but the delivery photo is not my building.'", "Message 2: 'Can you bring the parcel back before six?'", "They think you deliver packages. Seven letters.", "📦🚲"],
  ["The Crooked Shelf", "carpenter", "A homeowner is sending measurements for a wall unit that will not fit.", "Message 1: 'The left panel is two centimeters too wide.'", "Message 2: 'Can you trim the wood without damaging the finish?'", "They think you build and repair wooden structures. Nine letters.", "🪚🪵"]
];

const tickerEntries = [
  ["The Moon Exit", "LUNADROP", "A lunar token climbed all night before liquidity disappeared at dawn.", "The chart resembles a rocket that suddenly lost its engine.", "Logo note: a crescent moon falling through a red floor.", "A moon-related word joined to a sudden fall.", "🌙📉"],
  ["The Phantom Pool", "GHOSTLP", "A liquidity pool shows deposits even though every wallet is empty.", "The holder list contains addresses that vanish when opened.", "Logo note: a transparent figure floating over a pool.", "A spirit plus the abbreviation for liquidity provider.", "👻💧"],
  ["The Honey Trap", "BEELOCK", "A cheerful yield farm prevents users from withdrawing their rewards.", "The contract calls every deposit a hive contribution.", "Logo note: a padlock covered in yellow stripes.", "An insect plus a security device.", "🐝🔒"],
  ["The False Bridge", "BRIDGEX", "A cross-chain portal accepts tokens but never delivers them.", "Thousands of transfers are stuck halfway between two networks.", "Logo note: a broken bridge ending at a letter X.", "A structure for crossing plus the letter used for failure.", "🌉❌"],
  ["The Copycat Coin", "CLONEX", "A new project copied another token's site, logo, and contract description.", "Even the spelling mistakes match the original whitepaper.", "Logo note: two identical coins with one crossed out.", "A duplicate plus the letter X."],
  ["The Empty Treasury", "VOIDDAO", "A community treasury vote passed, then every asset disappeared.", "The governance page reports a balance of absolute nothing.", "Logo note: a ballot box opening into a black hole.", "Nothingness joined to a decentralized organization.", "🕳️🗳️"],
  ["The Frozen Swap", "ICEDEX", "A decentralized exchange lets users deposit but all swaps remain pending.", "Every transaction freezes at exactly ninety-nine percent.", "Logo note: a snowflake trapped inside trading arrows.", "Frozen water plus an exchange abbreviation.", "🧊🔁"],
  ["The Inflated Crown", "KINGPUMP", "A royal-themed token prints new supply whenever its price falls.", "The top wallet owns enough tokens to control every vote.", "Logo note: a crown attached to an air pump.", "A ruler plus an artificial price rise.", "👑📈"],
  ["The Silent Oracle", "MUTEDATA", "A prediction market relies on a price feed that stopped updating yesterday.", "The oracle timestamp is old, but the dashboard still says live.", "Logo note: a microphone crossed out beside a database.", "Silenced information. Eight letters."],
  ["The Exit Rocket", "RUGJET", "A space coin launched vertically before the developers sold everything.", "The team wallet moved before any public warning appeared.", "Logo note: a rocket pulling a carpet behind it.", "A scam exit plus a fast aircraft.", "🚀🧶"],
  ["The Paper Whale", "FAKEWHALE", "A trading bot claims a giant buyer entered, but no matching wallet exists.", "The volume bars are huge while on-chain activity stays flat.", "Logo note: an origami whale above an empty ledger.", "An unreal large crypto holder.", "🐋🎭"],
  ["The Broken Faucet", "DRIPSTOP", "A reward token promises constant payouts that abruptly cease.", "The claim counter rises, but every transfer returns zero.", "Logo note: a dry faucet above a coin.", "A small repeated payment that has ended.", "🚰⛔"],
  ["The Locked Airdrop", "CLAIMNO", "A free distribution asks for approval but never releases a token.", "Users sign repeatedly while the claim button resets.", "Logo note: a parachute tied to a closed safe.", "A request to receive something followed by refusal.", "🪂🔒"],
  ["The Mirror Market", "ECHOX", "A token's chart repeats the exact same candle pattern every hour.", "Buy and sell orders return like a copied sound.", "Logo note: mirrored charts facing a letter X.", "A repeated sound plus the exchange-style suffix.", "🔊🔁"],
  ["The Dust Vault", "ASHSAFE", "A security token's reserve contains only worthless remnants.", "The audit opened the vault and found gray powder instead of assets.", "Logo note: a safe door releasing smoke and ash.", "Burnt remains plus a protected container."],
  ["The Red Switch", "KILLSWAP", "A hidden contract function disables trading for everyone except the owner.", "The sell route closes the moment public volume peaks.", "Logo note: a red emergency switch between two arrows.", "An emergency stop joined to a trade.", "🛑🔁"]
];

export const seedPhraseV2Packs = seedEntries.map((entry, index) => makePack("seedPhrase", "seed-v2", entry, index, {
  answerType: "common word",
  maskStyle: "symbol-heavy",
  timerSec: 60,
  tags: ["crypto", "recovery", "word"],
  firstClueType: "terminal",
  secondClueType: "association"
}));

export const wrongNumberV2Packs = wrongNumberEntries.map((entry, index) => makePack("wrongNumber", "wrong-v2", entry, index, {
  answerType: "role",
  maskStyle: "soft",
  timerSec: 70,
  tags: ["texts", "role", "mystery"],
  firstClueType: "message",
  secondClueType: "message"
}));

export const rugCoinV2Packs = tickerEntries.map((entry, index) => makePack("rugCoin", "ticker-v2", entry, index, {
  answerType: "ticker",
  maskStyle: "caps-symbol",
  timerSec: 60,
  tags: ["crypto", "ticker", "market"],
  firstClueType: "feed",
  secondClueType: "logo"
}));
