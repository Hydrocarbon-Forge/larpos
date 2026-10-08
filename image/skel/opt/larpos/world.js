const { writeWorldLarp } = require('./larp');
// app/world.js — Coherent seeded world generator for LarpOS

const { PRNG } = require('./prng');

const ENTITY_APPS = {
  // 1. brine_beacon
  'mercury-phial': {
    title: 'QUICKSILVER SOUNDING COLUMN',
    format: 'gauge',
    screen: 'A four-foot column of cold green glass encased in perforated brass. A thick meniscus of oxidized mercury pulses inside, responding to unseen seismic swells seventy fathoms below the frozen sea.',
    element: {
      name: 'quicksilver-petcock',
      label: 'Bleed Hydrographic Petcock',
      type: 'valve',
      state: 'seated',
      action: 'turn',
      responses: {
        turn: 'You turn the knurled valve one-quarter turn. A hiss of chilled sea-gas escapes, and the mercury surges upward to mark the frozen depth: FORTY-ONE FATHOMS.'
      }
    }
  },
  'sounding-lead': {
    title: 'DEEP-SHEAVE SOUNDING REGISTER',
    format: 'register',
    screen: 'A cast-iron spool holding coiled hemp line, dripping cold brine onto the floorboards. Barnacle-crusted tallies click against a brass pawl as the lead weight tests the silent abyss.',
    element: {
      name: 'pawl-release',
      label: 'Trip Pawl Release Lever',
      type: 'lever',
      state: 'locked',
      action: 'pull',
      responses: {
        pull: 'You pull the counterweighted iron lever. The drum spins with a harsh shriek; five fathoms of tarred hemp scream into the dark before the pawl catches with a violent thud.'
      }
    }
  },
  'prism-housing': {
    title: 'FRESNEL BULLSEYE OPTIC',
    format: 'mirror',
    screen: 'Eight tiers of hand-ground bulls-eye glass revolving on a ring of mercury. The dying yellow lamp reflects across countless concentric rings, casting geometric spokes of brilliance across the green ice outside.',
    element: {
      name: 'mantle-regulator',
      label: 'Adjust Mantle Draft Louver',
      type: 'dial',
      state: 'half-open',
      action: 'turn',
      responses: {
        turn: 'You rotate the knurled brass dial. The tallow flame flares incandescent white inside the prism cage, throwing sharp diamond shadows against the stone vault.'
      }
    }
  },
  'drowned-bell': {
    title: 'SUBMERGED FOG RESONATOR',
    format: 'mouth',
    screen: 'An acoustic copper funnel bolted to the sea-intake grate. Submerged twenty feet beneath the ice, the green-bronze bell rings muffled chords that reverberate directly into your sternum.',
    element: {
      name: 'acoustic-shutter',
      label: 'Open Sea-Acoustic Shutter',
      type: 'aperture',
      state: 'constricted',
      action: 'open',
      responses: {
        open: 'You pull the iris ring open. A deafening, low bronze rumble rushes up the pipe, carrying the smell of crushed kelp and icy fathoms.'
      }
    }
  },
  'logbook-folio-42': {
    title: 'ADMIRALTY BRINE LEDGER',
    format: 'filing-cabinet',
    screen: 'A brass desk cradle holding the swollen calfskin logbook. The parchment pages are crusted with salt crystals that crackle like glass beneath your fingertips.',
    element: {
      name: 'folio-hasp',
      label: 'Unclasp Folio Seal',
      type: 'toggle',
      state: 'latched',
      action: 'flip',
      responses: {
        flip: 'You flip the corroded iron toggle. The parchment springs open to reveal fresh purple gall notes: "Tide ceased at 0300. The sea has taken the bells."'
      }
    }
  },
  'tallow-trough': {
    title: 'WHALE-TALLOW FEED HOPPER',
    format: 'valve',
    screen: 'A wide copper reservoir filled with solid amber tallow, heated from beneath by steam coils. Thick droplets of liquefied fat drip through a glass sight-tube toward the burner chamber.',
    element: {
      name: 'feed-piston',
      label: 'Advance Tallow Feed Ram',
      type: 'slider',
      state: 'notch-2',
      action: 'slide',
      responses: {
        slide: 'You force the brass slider along its notched guide. The piston compresses the tallow slab; a warm wave of roasted marrow vapor fills the air as the burner hums louder.'
      }
    }
  },

  // 2. dead_god_cranium
  'suture-omega': {
    title: 'CORONAL SUTURE MANOMETER',
    format: 'gauge',
    screen: 'An ivory bridge spanning the jagged cranial seam. Dial indicators tipped with silver needles register minute expansions in the celestial bone as pressure builds in the parietal lobes.',
    element: {
      name: 'suture-relief-cock',
      label: 'Vent Suture Relief Cock',
      type: 'valve',
      state: 'closed',
      action: 'turn',
      responses: {
        turn: 'You turn the bone petcock. A fine mist of amber cerebrospinal steam whistles out; the needle dials shudder backward three increments.'
      }
    }
  },
  'ivory-stylus': {
    title: 'ULNA TELEMETRY GALVANOMETER',
    format: 'register',
    screen: 'A carved bone stylus suspended by silver wire over a disc of smoked glass. The needle twitches with tiny galvanic spasms, tracing the dormant thoughts of the seraph.',
    element: {
      name: 'galvanic-key',
      label: 'Depress Galvanic Contact Key',
      type: 'button',
      state: 'grounded',
      action: 'depress',
      responses: {
        depress: 'You press the ivory button down. A sharp spark leaps from the needle to your knuckle, and the stylus scratches an eight-pointed star onto the soot.'
      }
    }
  },
  'dura-cistern': {
    title: 'CEREBROSPINAL SIPHON',
    format: 'mouth',
    screen: 'A lead-lined basin sunk into the floor where cold spinal fluid pools. A copper suction pipe draws the bitter amber liquid through fine mesh filters for liturgical distribution.',
    element: {
      name: 'siphon-treadle',
      label: 'Depress Cistern Siphon Treadle',
      type: 'lever',
      state: 'idle',
      action: 'pull',
      responses: {
        pull: 'You throw the heavy copper treadle lever. The suction pump groans; clear golden fluid cascades into the receiving chalice, smelling of cedar and bitter almonds.'
      }
    }
  },
  'trepan-drill': {
    title: 'SURGICAL TREPAN BRACE',
    format: 'aperture',
    screen: 'A heavy cast-steel trepan brace mounted to an articulated iron arm over the cranial plate. Serrated saw-teeth gleam beneath a coat of sterile mutton grease.',
    element: {
      name: 'brace-crank',
      label: 'Rotate Trepan Crown Crank',
      type: 'dial',
      state: 'retracted',
      action: 'turn',
      responses: {
        turn: 'You crank the wooden handle two full turns. The crown bit bites into the fossilized ivory with a dry, rhythmic crunch; powdered bone dust puffs out like confectioner\'s sugar.'
      }
    }
  },
  'ossified-psalm': {
    title: 'DURA-MATER PSALM REGISTER',
    format: 'filing-cabinet',
    screen: 'A slate frame holding stretched parchment-like dura tissue. Silver pins driven through specific syllables cause faint harmonic hums to echo through the vault.',
    element: {
      name: 'resonance-pin',
      label: 'Advance Liturgical Pin Array',
      type: 'slider',
      state: 'verse-IV',
      action: 'slide',
      responses: {
        slide: 'You shift the pin array forward one notch. The stretched membrane vibrates with an eerie choir chord that lingers in the bone marrow of your shins.'
      }
    }
  },
  'optic-chasm': {
    title: 'OPTIC CANAL MIRROR',
    format: 'mirror',
    screen: 'A polished speculum angled down the immense optic tunnel. Deep within the petrified nerve canal, faint celestial after-images drift across the dark like phosphorescent jellyfish.',
    element: {
      name: 'speculum-gimbal',
      label: 'Pivot Speculum Iris Aperture',
      type: 'aperture',
      state: 'focused',
      action: 'open',
      responses: {
        open: 'You expand the brass iris ring. The darkness deep within the optic tunnel flashes blinding violet; for an instant you see a field of burning wheels.'
      }
    }
  },

  // 3. ash_railway
  'frosted-pane': {
    title: 'PERMAFROST OBSERVATION TURRET',
    format: 'mirror',
    screen: 'A reinforced bevel-edge carriage window coated with three inches of crystalline rime. Outside, the black tundra drifts past under the emerald twitching of the northern aurora.',
    element: {
      name: 'defrost-cock',
      label: 'Vent Steam Defrost Jet',
      type: 'valve',
      state: 'chilled',
      action: 'turn',
      responses: {
        turn: 'You crack the steam valve. A scalding hiss clears a silver circle in the frost; out on the ballast, three antlered shadows stand motionless watching the train pass.'
      }
    }
  },
  'samovar-spigot': {
    title: 'BRASS SAMOVAR DISPENSER',
    format: 'samovar',
    screen: 'A massive fluted brass samovar bolted to the cabin floor, trembling with the rhythm of the rail ties. Its charcoal flue glows cherry-red, keeping forty liters of brackish bog tea at a rolling boil.',
    element: {
      name: 'tea-petcock',
      label: 'Throw Spigot Dispenser Lever',
      type: 'toggle',
      state: 'drip',
      action: 'flip',
      responses: {
        flip: 'You throw the knurled toggle lever. Steaming black tea rushes into your tin glass, smelling strongly of woodsmoke, chicory, and iron meltwater.'
      }
    }
  },
  'passenger-ledger': {
    title: 'TRANSIT BERTH REGISTER',
    format: 'filing-cabinet',
    screen: 'A heavy buckram binder filled with yellowed travel vouchers and stamped manifests. Black ink names have been ruled out in purple crayon by order of the Ministry.',
    element: {
      name: 'docket-stamp',
      label: 'Depress Conductor Berth Stamp',
      type: 'button',
      state: 'armed',
      action: 'depress',
      responses: {
        depress: 'You bring the heavy lead stamp down with a sharp thud. A purple imprint seals the page: DISPATCH CLEARED // BERTH 04 VACANT.'
      }
    }
  },
  'switch-lever-3': {
    title: 'WESTINGHOUSE PNEUMATIC SWITCH',
    format: 'lever',
    screen: 'A five-foot cast-iron switch throw standing in the vestibule corner. Steel linkages run down through the floorboards to control the narrow-gauge frogs under Car 04.',
    element: {
      name: 'track-throw',
      label: 'Throw Mainline Switch Throw',
      type: 'lever',
      state: 'tangent',
      action: 'pull',
      responses: {
        pull: 'You heave the counterweighted lever back until the iron latch clangs into place. Beneath your boots, the trucks lurch sideways with a violent metallic screech onto the ash siding.'
      }
    }
  },
  'telegraph-punch': {
    title: 'TIN-STRIP TELEGRAPH RECORDER',
    format: 'register',
    screen: 'A clockwork telegraph instrument that embosses arriving messages directly into a ribbon of tin foil. The spool clatters with rapid bursts of Morse code from abandoned stations ahead.',
    element: {
      name: 'tape-advance',
      label: 'Advance Embossing Wheel Dial',
      type: 'dial',
      state: 'ready',
      action: 'turn',
      responses: {
        turn: 'You turn the brass knurled knob. A fresh foot of embossed tin slides out of the cutter: "STATION 9 UNMANNED // PROCEED THROUGH PERMAFROST WITHOUT STOPPING."'
      }
    }
  },
  'under-berth-trunk': {
    title: 'PASSENGER BAGGAGE CHEST',
    format: 'hatch',
    screen: 'A zinc-lined steamer trunk secured beneath the wooden bunk with leather straps. The padlock is frozen in a block of gray ice that smells of mothballs and coal oil.',
    element: {
      name: 'trunk-clasp',
      label: 'Slide Zinc Locking Bolt',
      type: 'slider',
      state: 'secured',
      action: 'slide',
      responses: {
        slide: 'You force the stiff zinc bolt back. The heavy lid pops open two inches, spilling out a dry scent of dried chamomile, wool greatcoats, and unused railway tokens.'
      }
    }
  },

  // 4. monastic_loom
  'boxwood-shuttle': {
    title: 'BOXWOOD WEFT SHUTTLE',
    format: 'loom',
    screen: 'A polished boat-shaped shuttle resting in the cloth race. A quill of jet-black silk thread feeds through its ivory eyelet, ready to bind the linen warp of the cloister shroud.',
    element: {
      name: 'shuttle-flyer',
      label: 'Drive Weft Shuttle Flyer',
      type: 'lever',
      state: 'cocked',
      action: 'pull',
      responses: {
        pull: 'You jerk the picking strap. The shuttle shoots across the shed with a crisp clack-thud, laying a gleaming black line across the white linen.'
      }
    }
  },
  'selvedge-border': {
    title: 'SELVEDGE TENSION GAUGE',
    format: 'gauge',
    screen: 'A pair of brass weights suspended from silk cords over the fabric margin. The weights rise and fall as the cloth advances, measuring tension to avoid dropped stitches in the sacred draft.',
    element: {
      name: 'tension-wheel',
      label: 'Rotate Selvedge Tension Wheel',
      type: 'dial',
      state: 'level-3',
      action: 'turn',
      responses: {
        turn: 'You rotate the knurled wooden dial. The cords tauten like violin strings; the selvedge edge pulls arrow-straight along the reed.'
      }
    }
  },
  'treadle-pedals': {
    title: 'MONASTIC TREADLE ARRAY',
    format: 'pedal',
    screen: 'Four worn ash pedals connected by hemp cords to the heddle harnesses above. Depressing a pedal splits the white warp threads into an open shed to receive the prayer pattern.',
    element: {
      name: 'heddle-treadle',
      label: 'Depress Harness Treadle Four',
      type: 'button',
      state: 'raised',
      action: 'depress',
      responses: {
        depress: 'You step heavily onto the wooden pedal. The upper harness drops with a clatter of boxwood pulleys, opening a wide triangular shed between the warp threads.'
      }
    }
  },
  'distaff-of-flax': {
    title: 'FLAX ROVING SPINDLE',
    format: 'register',
    screen: 'A tall distaff bound with silver-gray unspun flax. A weighted soapstone spindle hangs beneath, spinning slowly and twisting raw fiber into continuous liturgical thread.',
    element: {
      name: 'spindle-whorl',
      label: 'Spin Soapstone Whorl',
      type: 'dial',
      state: 'spinning',
      action: 'turn',
      responses: {
        turn: 'You give the soapstone whorl a sharp twist. It hums like a sleeping bumblebee, drawing a hair-thin flax filament down through your fingers.'
      }
    }
  },
  'counting-beads': {
    title: 'ROSARY PATTERN REGISTER',
    format: 'filing-cabinet',
    screen: 'A string of seventy-two turned horn beads mounted on an iron wire above the breast beam. Moving a bead records one completed row of the funeral tapestry.',
    element: {
      name: 'pattern-bead',
      label: 'Advance Liturgical Pattern Bead',
      type: 'slider',
      state: 'bead-18',
      action: 'slide',
      responses: {
        slide: 'You slide the horn bead across the wire. It clicks into place against the abacus stop: ROW NINETEEN RECORDED // CHAPTER COMMUNION SECURED.'
      }
    }
  },
  'shear-blades': {
    title: 'IRON CLOISTER SHEARS',
    format: 'valve',
    screen: 'A pair of spring-tempered forge-welded iron shears hung from a leather strap on the breast beam. Their edges are honed to shave dry parchment without snagging.',
    element: {
      name: 'shears-catch',
      label: 'Release Shear Catch Toggle',
      type: 'toggle',
      state: 'latched',
      action: 'flip',
      responses: {
        flip: 'You flip the copper spring latch. The heavy iron blades spring open with a musical ring, scenting the air with hone and machine oil.'
      }
    }
  },

  // 5. flooded_kitchen
  'bakelite-radio': {
    title: 'BAKELITE VALVE WIRELESS',
    format: 'dial',
    screen: 'A curved brown bakelite wireless receiver sitting in four inches of still floodwater on the side table. Behind its amber tuning dial, two vacuum valves glow like gas lanterns.',
    element: {
      name: 'wireless-tuner',
      label: 'Rotate Longwave Tuning Dial',
      type: 'dial',
      state: '200kHz',
      action: 'turn',
      responses: {
        turn: 'You rotate the ribbed knob. Static crackles like frying fat, followed by a distant brass band playing an old waltz and the BBC shipping forecast for Thames and Dover.'
      }
    }
  },
  'oilcloth-surface': {
    title: 'YELLOW OILCLOTH REGISTER',
    format: 'register',
    screen: 'A broad pine table covered in cracked checkered oilcloth. Brown tea stains, knife scratches, and grease pencil tally marks form a domestic cartography of forgotten weeks.',
    element: {
      name: 'grease-pencil',
      label: 'Etch Mark With Grease Pencil',
      type: 'button',
      state: 'ready',
      action: 'depress',
      responses: {
        depress: 'You press the wax pencil firmly against the oilcloth, scoring a thick black tally: "WEEK 12 // WATER LEVEL: BOTTOM SHELF."'
      }
    }
  },
  'cutlery-drawer': {
    title: 'SWOLLEN DEAL CUTLERY CHEST',
    format: 'filing-cabinet',
    screen: 'A kitchen drawer swollen shut by dampness, jammed three inches open. Tarnished nickel teaspoons, bone fish-knives, and lead tea weights rattle inside like dead teeth.',
    element: {
      name: 'drawer-pull',
      label: 'Heave Wooden Drawer Pull',
      type: 'lever',
      state: 'jammed',
      action: 'pull',
      responses: {
        pull: 'You give the wooden knob a fierce tug. The deal slides with a wet groan, exposing a velvet-lined cutlery roll and an envelope of unopened telegrams.'
      }
    }
  },
  'condensed-milk-tin': {
    title: 'PUNCTURED MILK RATION',
    format: 'gauge',
    screen: 'A vintage blue-and-white tin with two rusty nail holes in the lid. Thick, sugary cream slowly oozes down the tinplate into the puddle below.',
    element: {
      name: 'ration-seal',
      label: 'Slide Tin Cover Clip',
      type: 'slider',
      state: 'dripping',
      action: 'slide',
      responses: {
        slide: 'You slide the tin clip over the puncture. A bead of sweet cream wells up on your thumb, tasting of burnt sugar and canned iron.'
      }
    }
  },
  'drowned-carpet': {
    title: 'SUBMERGED AXMINSTER RUG',
    format: 'mouth',
    screen: 'A waterlogged floral wool carpet beneath five inches of cold brackish water. Air bubbles trapped in the sodden pile rise to the surface whenever someone shifts weight.',
    element: {
      name: 'drain-plug',
      label: 'Pull Scupper Plug Toggle',
      type: 'toggle',
      state: 'plugged',
      action: 'flip',
      responses: {
        flip: 'You kick the lead scupper toggle. A hollow sucking gurgle resonates under the floorboards, pulling small paper floating scraps into a spinning whirlpool.'
      }
    }
  },
  'steeped-pot': {
    title: 'ENAMEL TEA INFUSER',
    format: 'valve',
    screen: 'A speckled blue enamel teapot perched on an overturned biscuit tin above the waterline. A thin streamer of bergamot steam rises from its chipped spout.',
    element: {
      name: 'infuser-lid',
      label: 'Lift Enamel Pot Lid',
      type: 'aperture',
      state: 'steeping',
      action: 'open',
      responses: {
        open: 'You lift the chipped blue lid. A rich cloud of black tea vapor and boiling chicory warms your face, dispelling the stagnant chill of the room.'
      }
    }
  },

  // 6. orbital_solarium
  'jasmine-trellis': {
    title: 'HYDROPONIC JASMINE ARBOR',
    format: 'retort',
    screen: 'A floating brass framework draped with fragrant white star-blossoms. In microgravity, water mist forms glistening globes among the emerald leaves, catching purple starlight.',
    element: {
      name: 'mist-manifold',
      label: 'Open Nutrient Mist Valve',
      type: 'valve',
      state: 'metered',
      action: 'turn',
      responses: {
        turn: 'You crack the knurled valve. A fine aerosol of chamomile-scented nutrient brine billows across the vine; every blossom opens wide with an audible rustle.'
      }
    }
  },
  'amethyst-prism': {
    title: 'SOLAR QUARTZ REFRACTOR',
    format: 'mirror',
    screen: 'A hand-cut hexagonal amethyst suspended in counterbalanced gimbals. It splits the dying star\'s violet rays into three calibrated beams directed across the algae beds.',
    element: {
      name: 'gimbal-vernier',
      label: 'Adjust Prism Vernier Dial',
      type: 'dial',
      state: 'azimuth-4',
      action: 'turn',
      responses: {
        turn: 'You turn the knurled bronze dial. The amethyst rotates three degrees; a deep violet lance of light ignites the moss tray, illuminating glowing spore veins.'
      }
    }
  },
  'water-droplet': {
    title: 'ORBITAL MENISCUS SPHERE',
    format: 'gauge',
    screen: 'A twelve-inch globe of distilled water hovering without support in the cupola center. Inside its curved optical surface, the entire dying constellation is magnified in miniature.',
    element: {
      name: 'surface-tension-pin',
      label: 'Touch Surface Probe Key',
      type: 'button',
      state: 'poised',
      action: 'depress',
      responses: {
        depress: 'You touch the platinum probe to the sphere. Capillary waves shimmer across the liquid surface, sending refracted violet rainbows dancing across the ceiling.'
      }
    }
  },
  'compost-retort': {
    title: 'IMPERIAL DIGESTION RETORT',
    format: 'retort',
    screen: 'A sealed bronze alembic where fallen camellia petals and old imperial treaties decompose into rich humus. A glass sight tube reveals warm brown loam bubbling slowly.',
    element: {
      name: 'digester-piston',
      label: 'Advance Digestor Ram Lever',
      type: 'lever',
      state: 'charged',
      action: 'pull',
      responses: {
        pull: 'You haul back the curved bronze lever. The internal ram compresses the composting mass; a warm earthy vapor smells richly of rain on summer slate.'
      }
    }
  },
  'mercury-manometer': {
    title: 'VACUUM PRESSURE MANOMETER',
    format: 'gauge',
    screen: 'A U-shaped borosilicate tube filled with quicksilver, measuring pressure against the vacuum outside the dome glass. A small brass float records barometric trends.',
    element: {
      name: 'manometer-shunt',
      label: 'Slide Manometer Calibrator',
      type: 'slider',
      state: '0.8-bar',
      action: 'slide',
      responses: {
        slide: 'You slide the brass index marker down the scale. The mercury level stabilizes with a sharp metallic clink: SECTOR INTEGRITY CONFIRMED // DOME PRESSURE STEADY.'
      }
    }
  },
  'imperial-graft': {
    title: 'ROYAL BOTANICAL GRAFT',
    format: 'mouth',
    screen: 'A delicate botanical splice where a wild thorn-vine has been grafted into an imperial pear bough using waxed silk thread. A single white bud is swelling at the seam.',
    element: {
      name: 'graft-ligature',
      label: 'Tighten Silk Ligature Toggle',
      type: 'toggle',
      state: 'tensioned',
      action: 'flip',
      responses: {
        flip: 'You flip the miniature ivory toggle. The silk thread tightens; pale green sap pulses through the translucent skin of the bud, illuminating its petals from within.'
      }
    }
  },

  // 7. glacial_scriptorium
  'frozen-ledger-1891': {
    title: 'BLUE-ICE REGISTRY FOLIO',
    format: 'filing-cabinet',
    screen: 'A massive sheepskin folio frozen solid into a brick of blue glacial ice. Through the transparent frost, rows of iron-gall ledger entries are legible down to the kopek.',
    element: {
      name: 'thaw-wire',
      label: 'Energize Charcoal Thaw Wire',
      type: 'toggle',
      state: 'cold',
      action: 'flip',
      responses: {
        flip: 'You flip the copper toggle switch. A thin red glow runs through the nichrome wire embedded in the ice; a melted tear trickles down, revealing page 142.'
      }
    }
  },
  'charcoal-brazier': {
    title: 'CLERK HEATING BRAZIER',
    format: 'brazier',
    screen: 'A shallow cast-iron brazier burning dry birch charcoal. It radiates dry heat just sufficient to keep the clerk\'s ink from crystallizing in the horn inkwell.',
    element: {
      name: 'draft-shutter',
      label: 'Rotate Brazier Air Draft',
      type: 'dial',
      state: 'quarter-draft',
      action: 'turn',
      responses: {
        turn: 'You turn the perforated damper. A glowing crimson breath sweeps through the coals; a fragrant plume of birch smoke rises toward the frosty rafters.'
      }
    }
  },
  'lead-pigeonhole': {
    title: 'CHANCERY DOCKET REPOSITORY',
    format: 'filing-cabinet',
    screen: 'A grid of eighty heavy lead pigeonholes set into the frozen granite wall. Bundles of tied vellum scrolls are filed under imperial wax seals, covered in light hoarfrost.',
    element: {
      name: 'docket-ejector',
      label: 'Pull Docket Ejector Lever',
      type: 'lever',
      state: 'set',
      action: 'pull',
      responses: {
        pull: 'You pull the brass ejector rod. A frozen vellum scroll slides forward into your hands with a dry rasp: "UKASE 418: EXPEDITION INTO THE SILENT GLACIER."'
      }
    }
  },
  'gall-inkwell': {
    title: 'OAK-GALL SLUSH INKWELL',
    format: 'gauge',
    screen: 'A heavy horned-owl inkwell carved of black basalt. Inside rests thick, purple oak-gall ink, kept at the exact boundary between liquid and slush.',
    element: {
      name: 'stirring-plunger',
      label: 'Depress Inkwell Plunger',
      type: 'button',
      state: 'slushed',
      action: 'depress',
      responses: {
        depress: 'You depress the basalt plunger. The ink slush swirls into a glossy black pool; the steel nib draws a rich, dark line across the cold vellum.'
      }
    }
  },
  'parchment-press': {
    title: 'SCREW-THREAD VELLUM PRESS',
    format: 'valve',
    screen: 'A massive oak and iron screw press used to flatten water-swollen calfskin sheets before filing. Its iron flywheel is encrusted in gray frost crystals.',
    element: {
      name: 'flywheel-turner',
      label: 'Turn Heavy Flywheel Handwheel',
      type: 'valve',
      state: 'clamped',
      action: 'turn',
      responses: {
        turn: 'You grasp the counterweighted iron spokes and heave. The heavy screw descends with a deep groan; the calfskin beneath flattens with a sharp crack of breaking ice crystals.'
      }
    }
  },
  'brass-clerks-bell': {
    title: 'CHANCERY SUMMONS CHIME',
    format: 'mouth',
    screen: 'A small polished brass hand-bell resting on a pad of green baize. When struck in the glacial vault, its high-pitched ping travels down the corridors for half a verst.',
    element: {
      name: 'striker-hasp',
      label: 'Trip Bell Striker Lever',
      type: 'lever',
      state: 'primed',
      action: 'pull',
      responses: {
        pull: 'You trigger the spring-loaded striker. A piercing silver tone rings through the frozen hall; out in the stacks, a dozen clerks cough softly in unison.'
      }
    }
  },

  // 8. chime_foundry
  'master-chime-alpha': {
    title: 'TWELVE-TON MASTER BOWL',
    format: 'bell',
    screen: 'An immense inverted bronze bell suspended from charred oak roof trusses. Its thick rim is cold and dark as river ice, but hums with an ultrasonic vibration that rattles your teeth.',
    element: {
      name: 'mallet-release',
      label: 'Trip Suspended Mallet Cam',
      type: 'lever',
      state: 'cocked',
      action: 'pull',
      responses: {
        pull: 'You yank the lanyard. The eighty-pound lead hammer swings and strikes the bronze rim with an immense, sonorous roar; an ocean of pure C-sharp vibrates through the flagstones.'
      }
    }
  },
  'cooling-sand-trough': {
    title: 'SILICATE CASTING TRENCH',
    format: 'brazier',
    screen: 'A deep rectangular trench of black loam sand still radiating dry heat from yesterday\'s bell pour. Beneath the surface, an eight-foot chime is slowly contracting.',
    element: {
      name: 'sand-probe',
      label: 'Thrust Pyrometer Probe Key',
      type: 'button',
      state: 'ready',
      action: 'depress',
      responses: {
        depress: 'You sink the copper probe into the hot black sand. The dial snaps to: 420 DEGREES // CORE SOLIDIFICATION: COMPLETE.'
      }
    }
  },
  'obsidian-fork': {
    title: 'VOLCANIC PITCH STANDARD',
    format: 'gauge',
    screen: 'A tuning fork ground from pure jet-black obsidian mounted in a water-filled brass bowl. In air it is silent; in water, it creates intricate standing wave mandalas.',
    element: {
      name: 'fork-clapper',
      label: 'Slide Water Immersion Ring',
      type: 'slider',
      state: 'dry',
      action: 'slide',
      responses: {
        slide: 'You lower the tines into the water. Thousands of microscopic mist droplets erupt in a humming fountain, ringing a pure 432 Hertz in your collarbone.'
      }
    }
  },
  'tuning-chisel': {
    title: 'DIAMOND-TIPPED SCRAPER',
    format: 'register',
    screen: 'A heavy scraper arm mounted to an iron carriage spanning the bell rim. Its black industrial diamond edge shaves micron-thin curls of bronze to tune overtones.',
    element: {
      name: 'lead-screw-dial',
      label: 'Advance Scraper Lead Screw',
      type: 'dial',
      state: 'calibrated',
      action: 'turn',
      responses: {
        turn: 'You turn the calibrated handwheel one notch. The diamond blade kisses the revolving bronze; a hair of bright gold metal curls away with a high whistling chime.'
      }
    }
  },
  'chalk-register': {
    title: 'HARMONIC CHALK TABLET',
    format: 'filing-cabinet',
    screen: 'A slate wall ruled in white chalk columns recording fundamental pitches, strike notes, and tierce ratios for every casting since the foundry was founded.',
    element: {
      name: 'slate-slate-slide',
      label: 'Slide Octave Register Rule',
      type: 'slider',
      state: 'tierce-4',
      action: 'slide',
      responses: {
        slide: 'You slide the brass index rule across the slate: OVERTONE HARMONIC MATCHED // PITCH CONSISTENCY CONFIRMED.'
      }
    }
  },
  'felt-damper': {
    title: 'BOILED FELT DAMPING ARM',
    format: 'aperture',
    screen: 'A thick pad of dense boiled wool mounted on an articulated ash lever. Bringing it against a vibrating bell instantly chokes unwanted hum overtones.',
    element: {
      name: 'damper-throw',
      label: 'Throw Felt Damper Cam',
      type: 'toggle',
      state: 'disengaged',
      action: 'flip',
      responses: {
        flip: 'You flip the wooden eccentric cam. The heavy wool pad presses against the bronze rim; the thunderous ringing is quenched in an instant, leaving profound, heavy silence.'
      }
    }
  }
};

const ARCHETYPE_META = {
  'brine_beacon': {
    openVerb: 'unveil',
    homeVerb: 'watch',
    extraVerbs: [
      { name: 'unveil', help: 'unveil [entity] — draw back the tarpaulin to open the running apparatus screen.' },
      { name: 'watch', help: 'watch — step away from the active station and return to the main gallery overview.' }
    ]
  },
  'dead_god_cranium': {
    openVerb: 'trepan',
    homeVerb: 'vault',
    extraVerbs: [
      { name: 'vault', help: 'vault — retreat from the open conduit back to the cranial gallery overview.' }
    ]
  },
  'ash_railway': {
    openVerb: 'board',
    homeVerb: 'berth',
    extraVerbs: [
      { name: 'board', help: 'board [entity] — open and enter the console compartment of the carriage apparatus.' },
      { name: 'berth', help: 'berth — return to the conductor overview and central train corridor.' }
    ]
  },
  'monastic_loom': {
    openVerb: 'unfold',
    homeVerb: 'selvedge',
    extraVerbs: [
      { name: 'unfold', help: 'unfold [entity] — open the warp frame to engage the apparatus directly.' },
      { name: 'selvedge', help: 'selvedge — step back from the loom to view the cloister overview.' }
    ]
  },
  'flooded_kitchen': {
    openVerb: 'approach',
    homeVerb: 'table',
    extraVerbs: [
      { name: 'approach', help: 'approach [entity] — wade over to the station to open and operate its mechanism.' },
      { name: 'table', help: 'table — step back to the dry central cutting board overview.' }
    ]
  },
  'orbital_solarium': {
    openVerb: 'illuminate',
    homeVerb: 'dome',
    extraVerbs: [
      { name: 'illuminate', help: 'illuminate [entity] — open the sun louvers and activate the station instrument.' },
      { name: 'dome', help: 'dome — step away from the bench and return to the central cupola overview.' }
    ]
  },
  'glacial_scriptorium': {
    openVerb: 'docket',
    homeVerb: 'registry',
    extraVerbs: [
      { name: 'docket', help: 'docket [entity] — open the cold chancery drawer and inspect the working mechanism.' },
      { name: 'registry', help: 'registry — return to the main clerk overview at the front of the frozen hall.' }
    ]
  },
  'chime_foundry': {
    openVerb: 'resonate',
    homeVerb: 'pit',
    extraVerbs: [
      { name: 'resonate', help: 'resonate [entity] — open the acoustic dampers and stand before the sounding instrument.' },
      { name: 'pit', help: 'pit — step back from the mould to the central foundry overview.' }
    ]
  }
};

const ARCHETYPES = [
  {
    id: 'brine_beacon',
    nameTemplates: [
      (p) => `PHAROS ${p.choice(['IV', 'VII', 'IX', 'XII'])} // THE GLASS REACHES`,
      (p) => `SALT-REGISTER AT CAPE ${p.choice(['MUTE', 'TALLOW', 'SPENT-COAST', 'BLACK-WATER'])}`,
      (p) => `BELL-STATION ${p.int(10, 89)} // MERCURY APERTURE`,
      (p) => `THE SOUNDING LOG OF STATION ${p.choice(['NORTH-BY-DRIFT', 'SEAWARD-VOID', 'IRON-REEF'])}`,
      (p) => `LENS-VAULT ${p.choice(['EPSILON', 'CORVO', 'OLD-BRINE'])} // ZERO FATHOMS`
    ],
    themes: [
      'abandoned lighthouse control desk, 1904; the sea turned to solid green glass three months ago',
      'submerged semaphore gallery in the silt doldrums, where brass bells ring without ropes',
      'brine-crusted sounding pulpit perched over an ocean that has forgotten how to produce waves',
      'fog-station watchdesk at the edge of the glass gulf; whale-tallow wicks burn without smoke'
    ],
    palettes: [
      ['#09131b', '#0f2537', '#4ecdc4', '#cbe3db', '#e07a5f'],
      ['#071013', '#11222c', '#2ec4b6', '#edf2f4', '#ff9f1c'],
      ['#0b1411', '#162b23', '#52b788', '#d8f3dc', '#e9c46a']
    ],
    keepers: [
      {
        name: 'Corvo, Third Keeper of the Brass Lens',
        personality: 'half-blind from whale-tallow smoke; deaf to shouting but flinches at every shift in atmospheric draft',
        idiom: 'maritime sounding measurements, tallow grades, fathom tallies, and brine sediment',
        prefix: 'Corvo',
        unknownResponses: [
          (cmd) => `Corvo tilts his cataract-clouded eyes toward the copper ceiling: "You mutter '${cmd}' into the sounding tube as if the salt cared. The gallery only answers: strike, unseal, listen, stoke, tally, or hail."`,
          (cmd) => `Corvo wipes grease from his thumbs onto his wool bib: "There is no tally for '${cmd}' in the admiralty ledger. Speak in things that ring or measure."`
        ]
      },
      {
        name: 'Maura of the Fog Signals',
        personality: 'keeps the shears tied to her wrist with tarred hemp; convinced the mainland slipped into the silt last winter',
        idiom: 'foghorn resonance, barometer drops, tallow grease, and dead gull tallies',
        prefix: 'Maura',
        unknownResponses: [
          (cmd) => `Maura does not drop her tallow scraper: "'${cmd}' is not in the signal code, stranger. Try hail for the watch rules, or strike, unseal, listen, stoke, or tally."`,
          (cmd) => `Maura taps the barometer glass with a broken fingernail: "'${cmd}' won't trim the wicks. We have work with the bells and the lead."`
        ]
      }
    ],
    lawsPool: [
      'The water depth increases by four fathoms whenever spoken into the brass funnel.',
      'Salt corrodes any sentence containing an apology before it can reach the logbook.',
      'No bullseye lens may be polished while the horizon remains horizontal.',
      'A bell rung under glass only warns the drowned.',
      'Tallow burned after midnight leaves gray grease that spells maritime initials.',
      'The barometer needle cannot point to storm if all three keepers are silent.'
    ],
    helpVerb: 'hail',
    reseedVerb: 'cast',
    verbsPool: [
      { name: 'strike', help: 'strike [bell/lead] — swing the padded copper mallet to sound a bronze or glass entity.' },
      { name: 'unseal', help: 'unseal [phial/folio] — crack the bitumen wax seal to inspect preserved contents.' },
      { name: 'listen', help: 'listen [target] — press ear to casing or sea-pipe to catch the acoustic tail.' },
      { name: 'stoke', help: 'stoke [burner/wick] — feed mutton tallow or whale grease into the draft chamber.' },
      { name: 'tally', help: 'tally [target] — notch a knife-mark into the register to record the state of an apparatus.' },
      { name: 'hail', help: 'hail — list the beacon watch-verbs and operational codes.' },
      { name: 'cast', help: 'cast — cast the lead into the glassy void to drift toward another station (reboot).' }
    ],
    entitiesPool: [
      {
        name: 'mercury-phial',
        title: 'Mercury Phial',
        aliases: ['phial', 'mercury', 'vial', 'quicksilver'],
        kind: 'sealed hydrographic vial',
        desc: 'A heavy glass bottle of oxidized quicksilver sealed with black bitumen. The label reads: ADMIRALTY HYDROGRAPHIC STORE, 1904.',
        reachVerbs: ['unseal', 'listen', 'strike', 'tally'],
        responses: {
          unseal: 'You peel back the brittle bitumen with a thumb. The mercury does not pour; it climbs the neck of the glass like a cold silver caterpillar and hums the water temperature at forty fathoms: zero degrees, precisely.',
          listen: 'You hold the phial to your ear. Inside the heavy glass, you hear no liquid sloshing—only the high, thin whine of telegraph wire vibrating in a gale sixty miles north.',
          strike: 'The bottle rings like a ship chronometer. The quicksilver quivers into five concentric rings that form the word: STILL.',
          tally: 'You carve a small notch next to the Admiralty stamp. Gray oxide flakes away like dried moth wings.'
        }
      },
      {
        name: 'sounding-lead',
        title: 'Sounding Lead',
        aliases: ['lead', 'sounding', 'rope', 'line'],
        kind: 'weighted sounding line',
        desc: 'Twenty fathoms of tarred hemp line knotted with lead tallies, encrusted in brittle barnacles that click when the tide shifts.',
        reachVerbs: ['listen', 'strike', 'tally', 'unseal'],
        responses: {
          listen: 'Leaning over the hawsehole, the line vibrates in your palm. A rhythmic, muffled clicking rises through the hemp—the barnacles talking to the floor of the gulf.',
          strike: 'You rap the lead weight against the cast-iron rim. A dull, heavy thud resounds through the foundations, answered three seconds later by a deeper groan beneath the stone.',
          tally: 'You count the greasy rag tallies: five, ten, fifteen fathoms. At eighteen fathoms, someone has knotted in a strand of coarse black horsehair.',
          unseal: 'You untie the greasecloth protecting the bottom hollow of the weight. The tallow plug is pressed with white river-sand that does not belong to this ocean.'
        }
      },
      {
        name: 'prism-housing',
        title: 'Prism Housing',
        aliases: ['prism', 'lens', 'fresnel', 'housing'],
        kind: 'revolving brass optic apparatus',
        desc: 'The great revolving brass cage of the Fresnel lens; eight tiers of bullseye glass reflecting an empty, frozen horizon.',
        reachVerbs: ['stoke', 'listen', 'strike', 'tally'],
        responses: {
          stoke: 'You turn the tallow valve into the mantle. A hiss of vaporized mutton fat catches the pilot wick, bathing the brass gears in thick, warm yellow brilliance.',
          listen: 'The brass clockwork ticks with the heavy cadence of a church tower. Between ticks, you hear the bullseye glass straining against the cold outside air.',
          strike: 'Your knuckle against the central bullseye produces a crystal chime that hangs in the air for twenty heartbeats. Out on the glass sea, a flash answers.',
          tally: 'You check the brass revolution counter: 418,922 turns since the log began. The brass gear tooth for zero is worn almost flat.'
        }
      },
      {
        name: 'drowned-bell',
        title: 'Drowned Bell',
        aliases: ['bell', 'drowned', 'bronze'],
        kind: 'submerged fog bell',
        desc: 'A green-bronze fog bell caught in the lower seawater intake grating, its iron clapper wrapped in matted kelp.',
        reachVerbs: ['strike', 'listen', 'unseal', 'tally'],
        responses: {
          strike: 'You strike the intake pipe with your mallet. The drowned bell below answers with a long, water-strangled moan that sets the puddle around your boots shivering.',
          listen: 'You press your ear against the cold iron grate. The kelp around the clapper swishes slowly, sighing like someone turning over in wet wool blankets.',
          unseal: 'You reach through the bars and tear a handful of black kelp from the rim. Beneath the weed, raised Latin letters read: NON SIBI SED AEQUORI.',
          tally: 'You notch the intake rim. The salt-crust crumbles, revealing seven notches already gouged there by earlier watches.'
        }
      },
      {
        name: 'logbook-folio-42',
        title: 'Logbook Folio 42',
        aliases: ['logbook', 'folio', 'folio-42', 'book', 'ledger'],
        kind: 'water-swollen calfskin record',
        desc: 'A calfskin ledger swollen to three times its thickness by brine, held shut by a rusted iron clasp.',
        reachVerbs: ['unseal', 'listen', 'tally'],
        responses: {
          unseal: 'You force the rusted clasp open. The page reveals purple iron-gall ink: "Day 91: The gulls landed upon the water and did not sink. When the boy threw a stone, it skittered two miles into the fog."',
          listen: 'Flipping the stiff parchment close to your ear sounds like dry salt blowing across slate.',
          tally: 'You sign your watch initials on the margin. The ink is swallowed instantly by the thirsty, damp calfskin.'
        }
      },
      {
        name: 'tallow-trough',
        title: 'Tallow Trough',
        aliases: ['trough', 'tallow', 'fat', 'basin'],
        kind: 'copper fuel reservoir',
        desc: 'A wide copper basin filled with congealed, yellow mutton tallow, marked with carved tally marks of dead gulls.',
        reachVerbs: ['stoke', 'tally', 'unseal'],
        responses: {
          stoke: 'You scoop a slab of cold mutton fat and feed it into the furnace chute. The iron plate glows dull orange; the scent of roasted marrow fills the cabin.',
          tally: 'You count the knife-notches along the copper lip: forty-four gulls. The last notch is fresh, with a speck of dried blood in the groove.',
          unseal: 'You dig your knife into the center of the cold fat. Two inches down, the blade hits something hard: an unopened brass cartridge case.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[PHAROS SECTOR-LOG // WATCH CYCLE ${p.int(100, 999)}]`,
      `${keeper.prefix.toUpperCase()}: "Keep your boots off the brass pipe. The sea went hard three months ago, and every vibration travels forty miles."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} is sitting on the console; don't jar the seal unless you have the sounding code ready."`,
      `${keeper.prefix.toUpperCase()}: "If you've come from the mainland, forget the roads. There is only the glass and what we burn in the mantle."`,
      `[SOUNDING TUBE: a faint drone in G-sharp echoes from below the deck plates]`
    ]
  },
  {
    id: 'dead_god_cranium',
    nameTemplates: [
      (p) => `CALVARIA-${p.choice(['IV', 'IX', 'XIII', 'XXVII'])} // SUTURE REGISTRY`,
      (p) => `THE CRANIAL DRAINAGE SUITE // LOBE ${p.int(2, 8)}`,
      (p) => `MARROW-COMMUNION DIALECTIC // VAULT ${p.choice(['ALPHA', 'BETA', 'OMEGA'])}`,
      (p) => `OSSARY OF THE FALLEN SERAPH // SECTOR ${p.int(10, 99)}`,
      (p) => `THE TREPANNED HEAVEN // BONE TELEMETRY`
    ],
    themes: [
      'a copper-wired trepanning gallery bolted into the calcified frontal lobe of a fallen celestial being',
      'an ossuary archive where memories are recovered by driving silver pins through petrified dura mater',
      'a surgical scriptorium inside an immense fossilized skull; cerebrospinal fluid flows like cold tea',
      'the vestibular chamber of a dead titan, where pilgrims calibrate prayer needles against bone resonance'
    ],
    palettes: [
      ['#12090b', '#2b1117', '#c1666b', '#ebd4cb', '#d4af37'],
      ['#0f0d11', '#211a24', '#b5838d', '#f7ede2', '#e5989b'],
      ['#140f0b', '#2e1c14', '#ddbea9', '#ffe8d6', '#a53860']
    ],
    keepers: [
      {
        name: 'Sister Vespera, Clerk of the Marrow',
        personality: 'weighs bone shavings in miniature brass scales; speaks as if reciting an autopsy on someone standing before her',
        idiom: 'anatomical Latin, suture lines, bone density, and surgical remorse',
        prefix: 'Sister Vespera',
        unknownResponses: [
          (cmd) => `Sister Vespera taps her ivory stylus on the bone rim: "'${cmd}' is no incision recognized by the Calvaria Synod. Speak the litany, or trepan, palpate, confess, incise, or cauterize."`,
          (cmd) => `Sister Vespera dips a linen sponge into lead water: "'${cmd}' will not relieve cranial pressure. Choose an instrument that fits the bone."`
        ]
      },
      {
        name: 'Anatomist Malakor',
        personality: 'has silver wires threaded through his fingernails; insists the celestial skull is still thinking, only very slowly',
        idiom: 'cerebrospinal drainage, dura mater tension, bone resonance, and petrified nerves',
        prefix: 'Malakor',
        unknownResponses: [
          (cmd) => `Malakor winces as the suture above him twitches: "Silence that '${cmd}'. The skull mirrors discord. Use the litany, or trepan, palpate, or confess."`,
          (cmd) => `Malakor measures a cranial fissure with calipers: "No nerve reacts to '${cmd}'. Try words the marrow knows."`
        ]
      }
    ],
    lawsPool: [
      'Any thought retained longer than thirty minutes calcifies into porous calcium carbonate.',
      'Cerebrospinal fluid cannot flow past the third rib without petition in whispering Latin.',
      'The bone vault mirrors whatever was thought during the previous thunderclap.',
      'You may not measure the soul while your boot-heels rest upon bare marrow.',
      'Silver pins driven into the frontal lobe extinguish candle flames within twelve yards.',
      'Memories spoken in anger leave gray scorch marks along the coronal suture.'
    ],
    helpVerb: 'litany',
    reseedVerb: 'commune',
    verbsPool: [
      { name: 'trepan', help: 'trepan [suture/fissure] — turn the serrated crown bit into the bone to vent pressure or memory.' },
      { name: 'palpate', help: 'palpate [nerve/organ] — press fingers against the calcified tissue to feel the galvanic pulse.' },
      { name: 'confess', help: 'confess [target] — whisper a grievance into a bone cavity to induce chemical response.' },
      { name: 'incise', help: 'incise [membrane/psalm] — cut the preserved fibrous shroud to reveal inscribed tissue.' },
      { name: 'cauterize', help: 'cauterize [target] — apply heated iron wire to quiet harmonic squeal in the bone.' },
      { name: 'litany', help: 'litany — recite the canonical surgical procedures and available instruments.' },
      { name: 'commune', help: 'commune — drink the bitter cerebrospinal draught to awaken in another skull (reboot).' }
    ],
    entitiesPool: [
      {
        name: 'suture-omega',
        title: 'Suture Omega',
        aliases: ['suture', 'omega', 'fissure', 'seam'],
        kind: 'petrified coronal cranial seam',
        desc: 'The great zig-zag bone seam across the vault ceiling, leaking chilled amber marrow that never hits the floor.',
        reachVerbs: ['trepan', 'palpate', 'confess', 'cauterize'],
        responses: {
          trepan: 'You place the brace against the seam and turn. The bit bites into ancient ivory; a vapor smelling of incense and burned zinc puffs out with a soft gasp.',
          palpate: 'Your fingers press into the serrated fissure. A slow, massive pulse—one beat every two minutes—shakes the marrow under your nails.',
          confess: 'You speak your regret into the gap. The amber marrow curds into pearlescent beads that roll backward into the ceiling.',
          cauterize: 'You draw the red-hot iron along the seam. The bone sizzles white; a voice like eight flutes playing unison chords resonates through your teeth.'
        }
      },
      {
        name: 'ivory-stylus',
        title: 'Ivory Stylus',
        aliases: ['stylus', 'needle', 'pin', 'ivory'],
        kind: 'carved bone telemetry needle',
        desc: 'A twelve-inch needle carved from a martyr\'s ulna, vibrating whenever held within three paces of the optic canal.',
        reachVerbs: ['palpate', 'incise', 'confess', 'trepan'],
        responses: {
          palpate: 'As you balance the needle across two fingers, its tip swings steadily northward toward the Great Pit, humming an eerie B-flat.',
          incise: 'You draw the sharp point across the bone floor. It cuts clean as grease, leaving a luminous white line that glows like phosphorus.',
          confess: 'Whispering to the stylus makes its needle-eye sweat a drop of clear rosewater.',
          trepan: 'You slide the stylus into an existing trepan hole. Deep within the vault, a chime like a cathedral clock sounds twelve times.'
        }
      },
      {
        name: 'dura-cistern',
        title: 'Dura Cistern',
        aliases: ['cistern', 'vat', 'reservoir', 'fluid'],
        kind: 'lead-lined cerebrospinal vat',
        desc: 'A deep vat lined with hammered lead collecting clear cerebrospinal condensate that reflects no face.',
        reachVerbs: ['palpate', 'confess', 'cauterize', 'incise'],
        responses: {
          palpate: 'You dip your bare fingers into the fluid. It feels colder than snow, yet your skin does not numb; instead, every hair stands on end as you hear distant organ pipes.',
          confess: 'You speak over the surface. The mirror-still liquid wrinkles into concentric ripples that spell out the date of your mother\'s birth.',
          cauterize: 'Touching the red wire to the surface produces a blue flash without steam. The surface solidifies for five seconds into transparent ice.',
          incise: 'You slice the scum layer with your scalpel. Beneath it, miniature silver minnows scatter into the dark depths of the lead tank.'
        }
      },
      {
        name: 'trepan-drill',
        title: 'Trepan Drill',
        aliases: ['drill', 'brace', 'bit', 'trepan'],
        kind: 'geared surgical brace',
        desc: 'A heavy brass-and-steel brace fitted with a circular crown bit, encrusted with dried myrrh and powdered bone.',
        reachVerbs: ['cauterize', 'palpate', 'trepan'],
        responses: {
          cauterize: 'You pass the flame across the serrated teeth. The dried myrrh crackles into fragrant blue smoke that cleanses the metallic stench of the room.',
          palpate: 'The gears turn with oiled silk smoothness. The circular blade is sharp enough to cut silk floating in the air.',
          trepan: 'You test the spring tension against your palm; the mechanism clicks with clinical, irrevocable precision.'
        }
      },
      {
        name: 'ossified-psalm',
        title: 'Ossified Psalm',
        aliases: ['psalm', 'cartilage', 'rib', 'inscription'],
        kind: 'calcified rib cartilage scroll',
        desc: 'A curved strip of petrified costal cartilage inscribed with microscopic Latin cursive using a hot diamond point.',
        reachVerbs: ['incise', 'palpate', 'confess'],
        responses: {
          incise: 'You scrape away the surface lime. The lettering underneath reads: "We did not slay the cherub; we merely unbolted the skull to see what held the sky aloft."',
          palpate: 'The cartilage flexes under your thumbs like horn, warming rapidly to body temperature.',
          confess: 'You breathe your secret upon the Latin characters; they turn dark violet as if soaked in fresh red wine.'
        }
      },
      {
        name: 'optic-chasm',
        title: 'Optic Chasm',
        aliases: ['chasm', 'canal', 'optic', 'socket'],
        kind: 'empty celestial eye socket',
        desc: 'A yawning circular opening thirty feet across, looking out upon a starless black void that smells of ozone and lilies.',
        reachVerbs: ['confess', 'palpate', 'cauterize'],
        responses: {
          confess: 'You whisper into the yawning dark. Two miles away in the void, a small golden spark flares, burns for three seconds, and gently goes out.',
          palpate: 'You lean over the polished bone ledge. The air rising from the abyss is entirely dry, smelling of linen dried in ancient sunlight.',
          cauterize: 'You cast a glowing cinder into the chasm. As it falls, it leaves a trail of green sparks that reveals immense bone pillars descending into infinity.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[CRANIAL TELEMETRY RECORD // SUTURE CYCLE ${p.int(10, 99)}]`,
      `${keeper.prefix.toUpperCase()}: "Tread lightly upon the sphenoid bone. We are six hours into the drainage protocol."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} is vibrating again; whatever this seraph remembered before it fell is beginning to warm."`,
      `${keeper.prefix.toUpperCase()}: "Do not ask when the surgery ends. The skull is three hundred leagues long; we have only cleared the forehead."`,
      `[A RESONANT TREMOR: the calcified vault groans as the cerebrospinal fluid shifts in the cistern]`
    ]
  },
  {
    id: 'ash_railway',
    nameTemplates: [
      (p) => `CAR-04 // THE LINE OF ASH`,
      (p) => `WAYSTATION ${p.choice(['ZVEZDA-9', 'TUNDRA-4', 'PERVOMAYSK', 'SEVER-12'])} TELEGRAPH`,
      (p) => `SIBERIAN TUBE-SWITCH REGISTER ${p.int(10, 88)}`,
      (p) => `THE FROSTED SAMOVAR MANIFEST // SECTION ${p.choice(['NORTH', 'SOUTH', 'DEAD-BUFFER'])}`,
      (p) => `NARROW-GAUGE COURIER ${p.int(100, 999)} // BUFFER ZERO`
    ],
    themes: [
      'a stalled armored carriage on an infinite narrow-gauge rail through black tundra; the samovar boils brackish meltwater',
      'a sub-permafrost railway switchbox where telegrams arrive as embossed tin strips and the frost never thaws',
      'the postal caboose of an abandoned locomotive cutting across frozen bogs beneath perpetual aurora',
      'a junction depot at kilometer 800; the tracks behind you have already been swallowed by creeping peat'
    ],
    palettes: [
      ['#0d131a', '#1a2530', '#38b000', '#b7e4c7', '#e5989b'],
      ['#0b0e14', '#182026', '#48cae4', '#e0e1dd', '#9b5de5'],
      ['#11151c', '#212d40', '#364954', '#f5f5f5', '#d64045']
    ],
    keepers: [
      {
        name: 'Conductor Yul',
        personality: 'stamps expired travel tokens with a heavy lead punch; smells of cheap makhorka and cabbage lard; refuses to glance out the window',
        idiom: 'axle grease, delayed departures, rail switches, and frostbite warnings',
        prefix: 'Conductor Yul',
        unknownResponses: [
          (cmd) => `Conductor Yul taps his lead punch against his tin badge: "None of that '${cmd}' foolishness in Car 04. Check the timetable, comrade, or scrape, inspect, switch, stamps, or stoke."`,
          (cmd) => `Conductor Yul blows cigarette ash off the ledger: "'${cmd}' isn't on the ministry transit schedule. Keep to the railway verbs."`
        ]
      },
      {
        name: 'Dispatcher Nina',
        personality: 'speaks through an acoustic horn stuffed with felt; tallies unoccupied passenger berths on a horn-bead abacus',
        idiom: 'telegraph ribbon, semaphore arms, coal rations, and rail clearances',
        prefix: 'Dispatcher Nina',
        unknownResponses: [
          (cmd) => `Nina\'s voice rattles through the horn: "Switchboard rejects command '${cmd}'. Consult timetable or use scrape, inspect, switch, stamps, or stoke."`,
          (cmd) => `Nina slides an abacus bead: "'${cmd}' carries no priority clearance on this line."`
        ]
      }
    ],
    lawsPool: [
      'The train does not stop at any waystation where a lantern is burning.',
      'Ticket numbers ending in zero do not belong to passengers who can be fed.',
      'Frost scraped from the carriage glass must never be allowed to melt in a teacup.',
      'Any telegram received after midnight was written by the locomotive itself.',
      'Passengers who sleep with their boots off forfeit their berth to the ballast.',
      'The narrow gauge narrows by one millimeter for every hundred versts traveled.'
    ],
    helpVerb: 'timetable',
    reseedVerb: 'derail',
    verbsPool: [
      { name: 'scrape', help: 'scrape [window/pipe] — clear black rime or coal soot from an apparatus to read markings.' },
      { name: 'inspect', help: 'inspect [manifest/trunk] — examine passenger papers, baggage, or mechanical linkages.' },
      { name: 'switch', help: 'switch [lever/wire] — throw track switch or redirect pneumatic telegraph line.' },
      { name: 'stamps', help: 'stamps [token/docket] — validate transit voucher with the lead conductor punch.' },
      { name: 'stoke', help: 'stoke [stove/boiler] — shovel anthracite or dried peat into the cast-iron carriage stove.' },
      { name: 'timetable', help: 'timetable — inspect current transit schedule and carriage operation verbs.' },
      { name: 'derail', help: 'derail — yank the emergency Westinghouse valve into total darkness (reboot world).' }
    ],
    entitiesPool: [
      {
        name: 'frosted-pane',
        title: 'Frosted Pane',
        aliases: ['pane', 'window', 'glass', 'frost'],
        kind: 'double-glazed carriage window',
        desc: 'A heavy double-glazed window thick with black, fern-like ice crystals that obscure the tundra outside.',
        reachVerbs: ['scrape', 'inspect', 'stoke'],
        responses: {
          scrape: 'You scrape a thumb-track through the rime. Outside, under a sickly mauve sky, three telegraph poles with cut wires are passing backward in absolute silence.',
          inspect: 'The ice ferns do not grow from water; they smell of kerosene and have formed the geometric pattern of a city street map.',
          stoke: 'Heat from the iron stove warms the bottom corner. The black frost thaws into oily yellow drops that run down the mahogany sill.'
        }
      },
      {
        name: 'samovar-spigot',
        title: 'Samovar Spigot',
        aliases: ['samovar', 'spigot', 'tea', 'valve'],
        kind: 'brass water heater valve',
        desc: 'A massive tarnished brass samovar bolted to the floor; its spigot drips scalding meltwater that smells of bog peat.',
        reachVerbs: ['inspect', 'scrape', 'stoke', 'stamps'],
        responses: {
          inspect: 'The samovar is stamped with the Imperial double-headed eagle, crossed out with three chisel-gashes. The charcoal core inside is rumbling like a sleeping hound.',
          scrape: 'You scrape green verdigris off the brass turncock. Beneath it, someone has scratched: "DO NOT DRINK WHILE CROSSING THE RIVER."' ,
          stoke: 'You drop two lumps of pine charcoal down the central flue. The water comes to a furious boil, whistling through the steam valve in three distinct minor notes.',
          stamps: 'You press your metal stamp against the hot brass belly; the imprint cools into a sharp silver square.'
        }
      },
      {
        name: 'passenger-ledger',
        title: 'Passenger Ledger',
        aliases: ['ledger', 'manifest', 'book', 'names'],
        kind: 'canvas-bound passenger register',
        desc: 'A canvas-bound manifest listing twenty-four berths; all berths are registered to the same family name.',
        reachVerbs: ['inspect', 'stamps', 'scrape'],
        responses: {
          inspect: 'You read berth 7: "Vane, Anton — destination: Kilometre Zero — baggage: one wooden box of dry soil." The signature is written in indelible copying-pencil.',
          stamps: 'You drive the lead punch through the margin of the latest page. A small cardboard circle falls out, printed with the letter Z.',
          scrape: 'You scrape away a smudge of dried tea. Underneath, a handwritten note reads: "The conductor died at Omsk; the one now punching tickets is the fireman."'
        }
      },
      {
        name: 'switch-lever-3',
        title: 'Switch Lever 3',
        aliases: ['lever', 'switch', 'lever-3', 'handle'],
        kind: 'iron track switch throw',
        desc: 'An iron switch handle protruding through the floorboards, secured by a lead seal and insulated copper wire.',
        reachVerbs: ['switch', 'inspect', 'scrape'],
        responses: {
          switch: 'You throw your weight against the lever. With a screech of frozen steel beneath the car, the points throw; the carriage lurches hard to port onto the siding of ash.',
          inspect: 'The lever handle is wrapped in coarse rags to prevent frozen skin from bonding to the iron. The linkage rod vanishes into the snow beneath the carriage floor.',
          scrape: 'You scrape rust off the brass sector plate: POSITIONS: (1) SIDING (2) BUFFER (3) GLACIER.'
        }
      },
      {
        name: 'telegraph-punch',
        title: 'Telegraph Punch',
        aliases: ['punch', 'telegraph', 'ticker', 'ribbon'],
        kind: 'pneumatic message apparatus',
        desc: 'A clockwork telegraph instrument that punches holes in dried sausage casing instead of paper ribbon.',
        reachVerbs: ['inspect', 'scrape', 'switch'],
        responses: {
          inspect: 'The ticker springs to life with a dry chatter. The punched casing scrolls into the bin: ".. -- .--. --- ... ... .. -... .-.. ." (IMPOSSIBLE).',
          scrape: 'You scrape dried tallow from the feed spindle. The tiny brass gears rotate with frantic speed.',
          switch: 'You flip the line-selector switch. The ticking frequency drops to a slow, mournful tap... tap... tap.'
        }
      },
      {
        name: 'under-berth-trunk',
        title: 'Under-Berth Trunk',
        aliases: ['trunk', 'box', 'chest', 'baggage'],
        kind: 'iron-strapped wooden footlocker',
        desc: 'A heavy pine trunk tucked under berth 4, bound with telegraph wire; something inside settles with a soft thud whenever the train rocks.',
        reachVerbs: ['inspect', 'scrape', 'stamps'],
        responses: {
          inspect: 'You pull the trunk out an inch. The stencil on the lid reads: "PROPERTY OF THE GEODETIC SURVEY — NOT TO BE OPENED UNDER ARTIFICIAL LIGHT."',
          scrape: 'You scrape frost from the wire binding. The twisted copper wire is ice-cold, yet you feel a faint rhythmic vibration inside the wood.',
          stamps: 'You affix an inspection seal to the hasp. The lead tag settles flat against the fir plank.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[TRANSIT DISPATCH // CAR-04 // KILOMETRE ${p.int(400, 990)}]`,
      `${keeper.prefix.toUpperCase()}: "Sit down, traveler, and keep your elbows inside the berth. The bog-frost will take the skin right off your coat."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} is rattling in its bracket; don't touch the iron without your wool mittens."`,
      `${keeper.prefix.toUpperCase()}: "We passed the last border post forty versts ago. From here to the buffer, there are no stations—only peat."`,
      `[TRACK SOUND: the rhythmic clack-clack of frozen narrow-gauge steel vibrates through your boots]`
    ]
  },
  {
    id: 'monastic_loom',
    nameTemplates: [
      (p) => `THE WEFT OF OUR LADY OF SHROUDS // FRAME ${p.choice(['III', 'VII', 'IX'])}`,
      (p) => `CLOISTER-LOOM IX // SELVEDGE REGISTRY`,
      (p) => `THE HEMP-BRAID CATECHISM // CELL ${p.int(1, 14)}`,
      (p) => `ABBESS ELEANOR’S UNWOVEN CODEX // BEAM ${p.int(10, 40)}`,
      (p) => `THE FLAXEN LITURGY // TWELFTH THREAD`
    ],
    themes: [
      'a 14th-century cloister loom where prayer is computed in knots of raw unbleached flax; the warp has no visible end',
      'a damp stone cell where blind nuns track planetary conjunctions by measuring the tension on twisted horsehair',
      'an immense oak tapestry frame in an abbey crypt; the figures woven yesterday have all turned their backs',
      'the scriptorium of unspun wool, where heresy is resolved by unpicking knots under candlelight'
    ],
    palettes: [
      ['#141118', '#2a2035', '#d4a373', '#faedcd', '#9d0208'],
      ['#101014', '#1f1e29', '#a5a58d', '#f0ebd8', '#6b705c'],
      ['#19120c', '#332316', '#e09f3e', '#fff3b0', '#9e2a2b']
    ],
    keepers: [
      {
        name: 'Sister Beatrix the Weaver',
        personality: 'fingers stained permanently indigo; has counted twelve thousand knots since matins without raising her eyes',
        idiom: 'warp tension, shuttles, flax grading, and monastic horarium',
        prefix: 'Sister Beatrix',
        unknownResponses: [
          (cmd) => `Sister Beatrix does not let the shuttle pause: "'${cmd}' is a tangled thread that belongs in no cloth. Speak the pattern, or shuttle, unpick, knot, feel, or card."`,
          (cmd) => `Sister Beatrix catches a dropped stitch with an iron pin: "'${cmd}' will only fray the selvedge. Keep your speech to the weave."`
        ]
      },
      {
        name: 'The Abbess’s Proxy',
        personality: 'whispers from behind a pierced cedar screen; judges whether a visitor is lying by the rhythm of the wooden treadles',
        idiom: 'selvedge edges, carding combs, unpicking, and liturgical vows',
        prefix: 'The Proxy',
        unknownResponses: [
          (cmd) => `The cedar screen rattles softly: "'${cmd}' violates the cloister draft. Inquire of the pattern, or shuttle, unpick, knot, feel, or card."`,
          (cmd) => `A dry cough from behind the cedar: "The loom rejects '${cmd}'. Knot your tongue or weave in truth."`
        ]
      }
    ],
    lawsPool: [
      'Every dropped stitch unravels a name spoken within the chapter house.',
      'Gold thread cannot be touched by anyone who has looked into a mirror since dawn.',
      'The shuttle must never pass from right to left while a prayer is left incomplete.',
      'Whatever is woven in total silence unravels the moment the chapel bell strikes.',
      'Knots tied with wet linen outlive the stone walls that shelter them.',
      'The pattern only becomes legible when viewed from the shadow of the crucifix.'
    ],
    helpVerb: 'pattern',
    reseedVerb: 'shear',
    verbsPool: [
      { name: 'shuttle', help: 'shuttle [thread/bobbin] — drive the boxwood shuttle through the shed to bind warp and weft.' },
      { name: 'unpick', help: 'unpick [knot/seam] — use the bone bodkin to undo tangled or heretical stitches.' },
      { name: 'knot', help: 'knot [target] — tie off a thread, count a liturgical bead, or bind an entity.' },
      { name: 'feel', help: 'feel [cloth/warp] — run blind fingertips across the tension of the linen cords.' },
      { name: 'card', help: 'card [wool/distaff] — comb raw wool or flax with iron teeth to align fibers.' },
      { name: 'pattern', help: 'pattern — inspect the sacred textile draft and monastic working verbs.' },
      { name: 'shear', help: 'shear — cut the finished shroud from the beam with iron shears (reboot world).' }
    ],
    entitiesPool: [
      {
        name: 'boxwood-shuttle',
        title: 'Boxwood Shuttle',
        aliases: ['shuttle', 'boxwood', 'bobbin'],
        kind: 'hollow wooden weaving shuttle',
        desc: 'A heavy boat-shaped shuttle carved of boxwood, worn glass-smooth by grease and friction, holding a quill of black silk.',
        reachVerbs: ['shuttle', 'feel', 'unpick', 'knot'],
        responses: {
          shuttle: 'You shoot the shuttle through the parted warp threads. It flies with a swift clack-thud, leaving a hair-thin line of cold black silk across the white linen.',
          feel: 'The wood is warm, almost feverish, and polished so slick it nearly slips from your grip. The quill inside smells of lavender and well-water.',
          unpick: 'You pull the bobbin free. The black silk thread unwinds backward on its own for five inches, humming like a tiny cricket.',
          knot: 'You knot the leading end of the silk to the shuttle eye. The thread tightens with a chime like a harpsichord wire.'
        }
      },
      {
        name: 'selvedge-border',
        title: 'Selvedge Border',
        aliases: ['selvedge', 'border', 'edge', 'margin'],
        kind: 'densely woven textile margin',
        desc: 'The left-hand border of the great cloth; the embroidered figures depicted there have their hoods pulled down and faces turned away.',
        reachVerbs: ['feel', 'unpick', 'knot', 'card'],
        responses: {
          feel: 'Your fingers brush the tight ribbing. The threads under your skin feel surprisingly cold, like wet slate in winter.',
          unpick: 'You slide the bone needle under the outermost border thread. As the stitch pops, a faint sigh of draft escapes through the warp.',
          knot: 'You bind a loose end into the edge; the figures in the tapestry lean closer together, as if whispering in the wind.',
          card: 'You comb the fringed hem. Tiny fragments of dried rose petals and incense ash fall onto the flagstones.'
        }
      },
      {
        name: 'treadle-pedals',
        title: 'Treadle Pedals',
        aliases: ['treadles', 'pedals', 'treadle', 'oak'],
        kind: 'grooved oak foot levers',
        desc: 'Four oak levers wrapped in coarse hemp cords, worn into deep foot-shaped hollows by centuries of bare Franciscan heels.',
        reachVerbs: ['feel', 'shuttle', 'knot'],
        responses: {
          feel: 'You press your palm to the oak. The grain is impregnated with lanolin and candle-tallow, yielding slightly under heavy pressure.',
          shuttle: 'You depress the second pedal. Above your head, four harness frames clatter upward, opening a clean shed four inches wide.',
          knot: 'You lash the tension cord tighter to the lever peg. The warp above groans in three distinct harmonic intervals.'
        }
      },
      {
        name: 'distaff-of-flax',
        title: 'Distaff of Flax',
        aliases: ['distaff', 'flax', 'bundle', 'fibers'],
        kind: 'dressed bundle of raw flax',
        desc: 'A bundle of unspun Flemish flax tied with red ribbon, smelling of river silt and dried chamomile.',
        reachVerbs: ['card', 'feel', 'unpick', 'knot'],
        responses: {
          card: 'You draw the iron carding teeth through the flax. The pale fibers separate like clean golden hair, static sparks jumping to your wrists.',
          feel: 'The raw fibers are long and strong as bowstrings, surprisingly heavy in the hand.',
          unpick: 'You untie the red ribbon. Inside the core of the bundle rests a folded scrap of sheepskin parchment.',
          knot: 'You twist a handful of fibers into a tight cord; it resists even your full two-handed tug.'
        }
      },
      {
        name: 'counting-beads',
        title: 'Counting Beads',
        aliases: ['beads', 'rosary', 'counter'],
        kind: 'carved bone tally rosary',
        desc: 'Fifty-four beads carved from sheep knucklebones strung on twisted catgut, keeping count of the dropped stitches.',
        reachVerbs: ['feel', 'knot', 'unpick'],
        responses: {
          feel: 'You slide three beads along the cord. Each bone bead is warm and inscribed with a different Latin consonant.',
          knot: 'You tie an extra knot between the fourth and fifth beads; a bell in the convent tower tolls once.',
          unpick: 'You loosen the catgut stopper; the beads settle together with the dry click of teeth.'
        }
      },
      {
        name: 'shear-blades',
        title: 'Shear Blades',
        aliases: ['shears', 'blades', 'scissors', 'iron'],
        kind: 'spring-iron cloth shears',
        desc: 'A pair of one-piece iron shears wrapped in greased linen to keep monastery moisture from tasting the cutting edge.',
        reachVerbs: ['feel', 'card', 'unpick'],
        responses: {
          feel: 'The iron is heavy and cold. When squeezed, the blades meet with a terrifyingly clean, shearing hiss.',
          card: 'You scrape the blade flat across the carding board; rust flakes off like red dust.',
          unpick: 'You use the tip to slice through a knot of bleached linen; the cut ends spring apart instantly.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[CLOISTER HORARIUM // WEFT WATCH: HOUR OF TIERCE]`,
      `${keeper.prefix.toUpperCase()}: "Keep your skirts clear of the lower treadles. The warp is strung with ninety pounds of tension."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} was blessed this morning with salted holy water; handle it only by the boxwood horn."`,
      `${keeper.prefix.toUpperCase()}: "We do not weave cloth to clothe men. We weave to keep the sky from coming unstitched at the hem."`,
      `[LOOM SOUND: a rhythmic, hollow clack-thud echoes off damp limestone vaults]`
    ]
  },
  {
    id: 'flooded_kitchen',
    nameTemplates: [
      (p) => `THE TABLE AT 44 MARSH LANE (1974)`,
      (p) => `THE OILCLOTH REGISTRY // FLOODLINE ${p.int(2, 9)}`,
      (p) => `TRANSISTOR ARCHIVE // THREE INCHES OF WATER`,
      (p) => `THE LINOLEUM DRIFT // TEA AT ${p.choice(['FOUR', 'FIVE', 'DUSK'])}`,
      (p) => `PARLOUR REGISTER // SECTOR ${p.choice(['SCULLERY', 'PANTRY', 'CANAL-SIDE'])}`
    ],
    themes: [
      'the linoleum floor is covered in two inches of dark tap water; an inductive radio murmurs football scores from 1968',
      'a yellow Formica kitchen where tea cools forever and every cupboard door opens directly onto the canal',
      'a flooded scullery in an east-end terrace, 1974; the wallpaper peels in long strips of floral damp',
      'a kitchen table adrift in lukewarm tea water; the wall clock has had its minute hand removed with pliers'
    ],
    palettes: [
      ['#1c1917', '#292524', '#d97706', '#fef3c7', '#059669'],
      ['#181512', '#2c221a', '#e76f51', '#f4a261', '#2a9d8f'],
      ['#141916', '#222e28', '#84a98c', '#cad2c5', '#52796f']
    ],
    keepers: [
      {
        name: 'Uncle George',
        personality: 'wears a soaking wool cardigan; stirs lukewarm tea with the handle of a teaspoon; remembers where everyone put their hats fifty years ago',
        idiom: 'drowned gardens, whistling kettles, radio valves, and ration stamps',
        prefix: 'Uncle George',
        unknownResponses: [
          (cmd) => `Uncle George taps his tin mug: "Never heard that word '${cmd}' in all my days in this scullery. Try your chores, or tune, open, pour, remember, or scrape."`,
          (cmd) => `Uncle George sighs as water ripples against his slippers: "'${cmd}' won't dry the carpet, son. Mind your manners and use proper kitchen words."`
        ]
      },
      {
        name: 'The Voice in the Bakelite Set',
        personality: 'a crackling wireless announcer reading lost-dog notices between bursts of accordion dance tunes',
        idiom: 'shipping forecasts, canal water levels, valve hum, and grocery lists',
        prefix: 'The Wireless',
        unknownResponses: [
          (cmd) => `A burst of static crackles from the speaker: "We have no transmission under '${cmd}'. Listen to the chores, or tune, open, pour, remember, or scrape."`,
          (cmd) => `The wireless hums in 50 Hertz: "'${cmd}' is lost in the atmospheric mush."`
        ]
      }
    ],
    lawsPool: [
      'Mother is always in the pantry, but you may not look into it twice in one evening.',
      'The water rises by half an inch whenever someone mentions tomorrow.',
      'The radio will only report the weather for towns that have ceased to exist.',
      'You cannot butter the bread until all the silver spoons are dry.',
      'Whatever falls into the linoleum puddle belongs to the canal by morning.',
      'The kettle will not boil if anyone is sitting in the grandfather chair.'
    ],
    helpVerb: 'chores',
    reseedVerb: 'sleep',
    verbsPool: [
      { name: 'tune', help: 'tune [radio/dial] — turn the bakelite knob across crackling longwave frequencies.' },
      { name: 'open', help: 'open [drawer/tin] — pull open stuck kitchen drawers or rusted tin containers.' },
      { name: 'pour', help: 'pour [tea/kettle] — draw dark steeped tea or rainwater across an entity.' },
      { name: 'remember', help: 'remember [target] — peer into water reflections or watermark stains to recall faces.' },
      { name: 'scrape', help: 'scrape [oilcloth/tin] — scrape hardened grease, sugar crust, or rust with a butter knife.' },
      { name: 'chores', help: 'chores — check the list of kitchen duties and acceptable household verbs.' },
      { name: 'sleep', help: 'sleep — put your head down on the damp oilcloth and wake in another year (reboot).' }
    ],
    entitiesPool: [
      {
        name: 'bakelite-radio',
        title: 'Bakelite Radio',
        aliases: ['radio', 'bakelite', 'wireless', 'set'],
        kind: 'brown valve radio receiver',
        desc: 'A heavy brown valve receiver resting on two soggy phone directories; its tuning scale glows faint amber.',
        reachVerbs: ['tune', 'remember', 'scrape', 'open'],
        responses: {
          tune: 'You twist the bakelite knob. Between gusts of white noise, a woman\'s voice sings: "...and the coal-man will never come back to the lane..." followed by the shipping forecast for Dogger and Fisher: "Visibility zero, pressure falling."',
          remember: 'Looking into the warm yellow glow of the dial, you remember the summer before the water came up through the cellar—the smell of freshly cut lawn and warm bitumen.',
          scrape: 'You scrape dried salt off the speaker grille. The valve hum shifts into a higher, sweeter tone.',
          open: 'You pry off the cardboard backing. Two glass valves glow like miniature lighthouses in the dust.'
        }
      },
      {
        name: 'oilcloth-surface',
        title: 'Oilcloth Surface',
        aliases: ['oilcloth', 'table', 'tablecloth', 'surface'],
        kind: 'checkered kitchen table cover',
        desc: 'A cracked yellow-and-white checkered tablecloth patterned with brown tea rings and grease pencil tallies.',
        reachVerbs: ['scrape', 'remember', 'pour'],
        responses: {
          scrape: 'You scrape at an old ring with your thumbnail. Under the grease, someone has penciled: "Milk bill paid 14th Oct — don\'t let him in."',
          remember: 'You lay your palms flat on the oilcloth. The coolness of the table brings back the taste of barley sugar and the sound of rain on the zinc roof.',
          pour: 'You pour a few drops of cold tea onto the vinyl. The dark liquid runs into the cracks, mapping miniature black rivers between the yellow squares.'
        }
      },
      {
        name: 'cutlery-drawer',
        title: 'Cutlery Drawer',
        aliases: ['drawer', 'cutlery', 'spoons', 'silver'],
        kind: 'jammed deal kitchen drawer',
        desc: 'A swollen pine drawer stuck half-open, rattling with lead teaspoons, bone-handled knives, and foil milk caps.',
        reachVerbs: ['open', 'scrape', 'remember'],
        responses: {
          open: 'You give the drawer a sharp tug. It groans open another two inches, revealing a silver fish knife engraved with a monogram that belongs to no one in this family.',
          scrape: 'You scrape black tarnish off a soup spoon. The bowl of the spoon mirrors the kitchen upside-down, but the window behind you shows water instead of the yard.',
          remember: 'Rattling the spoons sounds like your grandmother laying the table on Sunday afternoons while the stew simmered.'
        }
      },
      {
        name: 'condensed-milk-tin',
        title: 'Condensed Milk Tin',
        aliases: ['tin', 'milk', 'can'],
        kind: 'punctured blue-and-white tin',
        desc: 'A blue tin with two rusty nail-holes punched in the top, slowly oozing thick, sugary yellow cream into the puddle.',
        reachVerbs: ['pour', 'open', 'scrape'],
        responses: {
          pour: 'You tip the tin over your saucer. A rope of thick, caramel-sweet cream ribbons down, smelling of vanilla and nursery tea.',
          open: 'You widen one of the nail-holes with a teaspoon handle; the tin burps sweet condensed vapor into the damp room.',
          scrape: 'You scrape crystallized sugar from the rim; it crunches like fine beach sand between your teeth.'
        }
      },
      {
        name: 'drowned-carpet',
        title: 'Drowned Carpet',
        aliases: ['carpet', 'rug', 'floor', 'puddle'],
        kind: 'waterlogged Axminster runner',
        desc: 'A faded wool runner submerged beneath two inches of brackish water, harboring small pale minnows among its fringes.',
        reachVerbs: ['remember', 'pour', 'scrape'],
        responses: {
          remember: 'Staring into the murky water, you see the floral pattern beneath: red cabbage roses floating under the surface like drowned bouquets.',
          pour: 'You splash a mug of water across the surface; the ripple makes the submerged wool tassels sway like pond weed.',
          scrape: 'You drag your heel across the pile; mud rises in brown clouds, smelling of canal dredgings.'
        }
      },
      {
        name: 'steeped-pot',
        title: 'Steeped Pot',
        aliases: ['pot', 'teapot', 'tea', 'brown-betty'],
        kind: 'brown Betty glazed teapot',
        desc: 'A heavy brown ceramic teapot that never runs empty, though the tea it pours tastes slightly of peppermint and rain.',
        reachVerbs: ['pour', 'open', 'remember'],
        responses: {
          pour: 'You lift the steaming pot and pour. A dark amber stream splashes into the cup, curling into fragrant white steam that touches the ceiling.',
          open: 'You lift the ceramic lid. Inside, the black tea leaves have arranged themselves into the distinct shape of an open hand.',
          remember: 'The warmth of the clay against your fingers feels like someone holding your wrists on a freezing morning.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[TRANSISTOR MEMORY LOG // MARSH LANE // 1974]`,
      `${keeper.prefix.toUpperCase()}: "Mind the puddle around the legs of the table. The water came up through the floorboards while you were sleeping."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} has been running all morning; they're reading the racing results from Kempton Park, but that track shut before the war."`,
      `${keeper.prefix.toUpperCase()}: "Don't go opening the pantry door, whatever you do. Mother's in there sorting the jars, and she doesn't like the light."`,
      `[WATER SOUND: a gentle lap-lap against the skirting board; radio valves humming softly]`
    ]
  },
  {
    id: 'orbital_solarium',
    nameTemplates: [
      (p) => `SOLARIUM-XII // SEVENTH APOGEE`,
      (p) => `THE WILTING GREENHOUSE OF EMPEROR ${p.choice(['CYRUS', 'AUREL', 'VALENS', 'SEVERUS'])}`,
      (p) => `ORBITAL BOTANICA // PRISM TRAY ${p.int(3, 19)}`,
      (p) => `THE JASMINE DOME TELEMETRY // ORBIT ${p.int(100, 999)}`,
      (p) => `LAGRANGE RETORT // FLORA VACUUM`
    ],
    themes: [
      'microgravity glass observatory filled with untrimmed night-blooming jasmine; the star outside is swelling purple',
      'a brass solarium drifting in Lagrange point 5, where dead courtiers are composted in orchid moss',
      'the imperial glass conservatory in high orbit; zero-gravity water globules hover among wilting camellias',
      'a hydroponic void-station where royal decrees are read to dying ferns through silver speaking tubes'
    ],
    palettes: [
      ['#0a0c0e', '#18231c', '#d4af37', '#f4e8c1', '#2d6a4f'],
      ['#0b131f', '#1b263b', '#778da9', '#e0e1dd', '#c08552'],
      ['#0e1111', '#1f2421', '#99e2b4', '#d8f3dc', '#679436']
    ],
    keepers: [
      {
        name: 'Gardener-Vizier Seth',
        personality: 'wears emerald silk blindfolds to save his sight for the eclipse; whispers reprimands to drooping white camellias',
        idiom: 'solar filters, capillary sap, pruning shears, nectar ampoules, and court titles',
        prefix: 'Vizier Seth',
        unknownResponses: [
          (cmd) => `Vizier Seth snips the air with silver shears: "'${cmd}' is not in the botanical court decree. Inquire of the almanac, or prune, angle, inhale, water, or graft."`,
          (cmd) => `Vizier Seth shakes his emerald silk veil: "'${cmd}' has cast a shadow on the imperial buds. Speak in horticultural terms."`
        ]
      },
      {
        name: 'Hydroponic Maiden Lyra',
        personality: 'hair floats in zero gravity like black river grass; speaks in sap circulation rates and vacuum seal leakages',
        idiom: 'osmotic pressure, prism refraction, star-burn, and wilting symptoms',
        prefix: 'Lyra',
        unknownResponses: [
          (cmd) => `Lyra floats back an inch: "'${cmd}' disrupts the nutrient mist. Consult the almanac, or prune, angle, inhale, water, or graft."`,
          (cmd) => `Lyra tests the leaf pH with a slip of paper: "'${cmd}' carries no valence in this dome."`
        ]
      }
    ],
    lawsPool: [
      'Green leaves must never be turned toward the blind side of the dead star.',
      'Sunlight reflected through three quartz prisms produces frost instead of warmth.',
      'The Vizier is forbidden to prune any vine that has cast its shadow upon the throne.',
      'Flowers blooming in vacuum emit no fragrance, only shortwave static.',
      'Sap circulating in zero gravity moves counter-clockwise on imperial birthdays.',
      'Any fruit harvested while the star is eclipsed turns to bitter lead-shot.'
    ],
    helpVerb: 'almanac',
    reseedVerb: 'eclipse',
    verbsPool: [
      { name: 'prune', help: 'prune [vine/leaf] — cut back wild overgrowth or dead leaves with silver shears.' },
      { name: 'angle', help: 'angle [prism/mirror] — turn quartz prisms or brass louvers toward the swelling purple sun.' },
      { name: 'inhale', help: 'inhale [target] — sample the scented vapor, spores, or ozone hovering around an entity.' },
      { name: 'water', help: 'water [roots/tray] — release nutrient mist or guide floating water spheres into root fibers.' },
      { name: 'graft', help: 'graft [stem/bulb] — splice two living tissues together with waxed silk thread.' },
      { name: 'almanac', help: 'almanac — consult the imperial celestial calendar and gardening directives.' },
      { name: 'eclipse', help: 'eclipse — close the outer brass shutters and reboot the station in cold darkness.' }
    ],
    entitiesPool: [
      {
        name: 'jasmine-trellis',
        title: 'Jasmine Trellis',
        aliases: ['jasmine', 'trellis', 'vine', 'blossoms'],
        kind: 'floating brass plant lattice',
        desc: 'A tangled brass lattice covered in fragrant star-shaped white blossoms that drift weightlessly from their stems.',
        reachVerbs: ['prune', 'inhale', 'water', 'graft'],
        responses: {
          prune: 'You snip a withered tendril with your shears. A drop of clear, fragrant sap wells up and floats away like a miniature glass bead.',
          inhale: 'The fragrance is overwhelming—heavy jasmine laced with ozone and the faint metallic tang of unfiltered solar radiation.',
          water: 'You guide a floating globe of water into the moss mat; the roots drink greedily, turning bright emerald in seconds.',
          graft: 'You bind a sliver of dark plum-vine into the wood; the seam pulses with pale green light.'
        }
      },
      {
        name: 'amethyst-prism',
        title: 'Amethyst Prism',
        aliases: ['prism', 'amethyst', 'crystal', 'lens'],
        kind: 'faceted orbital quartz optic',
        desc: 'A hand-cut hexagonal amethyst crystal splitting the dying purple star\'s rays into three violet bands across the floor.',
        reachVerbs: ['angle', 'inhale', 'prune'],
        responses: {
          angle: 'You pivot the brass gimbals. The violet beam shifts across the moss bed; where the light touches, small nocturnal buds snap open with audible pops.',
          inhale: 'Near the warm crystal face, the air smells of heated glass and scorched sugar.',
          prune: 'You wipe away a film of dried condensation; the refracted beam sharpens into razor-edged violet geometry.'
        }
      },
      {
        name: 'water-droplet',
        title: 'Water Droplet',
        aliases: ['droplet', 'water', 'sphere', 'globule'],
        kind: 'floating microgravity water sphere',
        desc: 'A six-inch sphere of jasmine-scented water hovering above the console, reflecting the entire dome in curved miniature.',
        reachVerbs: ['inhale', 'water', 'angle'],
        responses: {
          inhale: 'You lean your face toward the sphere. As your breath ripples its skin, a faint sweet scent of mint and wet stone fills your nose.',
          water: 'You gently push the sphere toward the root-box; it impacts the peat with a soft plop and is drawn into the soil by capillary greed.',
          angle: 'Through the floating sphere, the purple star looks like an inverted violet droplet hanging in an obsidian well.'
        }
      },
      {
        name: 'compost-retort',
        title: 'Compost Retort',
        aliases: ['retort', 'compost', 'vessel', 'urn'],
        kind: 'bronze imperial decomposition vessel',
        desc: 'A steaming sealed bronze vessel digesting the remains of the imperial library and dried camellia leaves into black humus.',
        reachVerbs: ['inhale', 'water', 'prune'],
        responses: {
          inhale: 'You open the sampling valve. The vapor smells of rich autumnal forest earth, decaying calfskin bindings, and dried cloves.',
          water: 'You inject half a litre of saline into the intake; the bronze vessel rumbles with biological contentment.',
          prune: 'You scrape charred carbon crust off the relief carvings; underneath, a bronze bas-relief shows the coronation of a seven-eyed child.'
        }
      },
      {
        name: 'mercury-manometer',
        title: 'Mercury Manometer',
        aliases: ['manometer', 'gauge', 'pressure', 'tube'],
        kind: 'curved glass vacuum pressure indicator',
        desc: 'A U-shaped glass tube filled with quicksilver measuring the root-bed pressure against the vacuum of space.',
        reachVerbs: ['angle', 'inhale', 'prune'],
        responses: {
          angle: 'Tapping the glass makes the silvery meniscus bounce; the vacuum seal holds at four atmospheres, precisely.',
          inhale: 'The glass column is icy cold; no gas leaks past the lead-soldered flanges.',
          prune: 'You clear away climbing moss that was attempting to wrap itself around the measurement scale.'
        }
      },
      {
        name: 'imperial-graft',
        title: 'Imperial Graft',
        aliases: ['graft', 'rose', 'orchid', 'hybrid'],
        kind: 'spliced botanical curiosity',
        desc: 'A white damask rose stem surgically spliced into an obsidian orchid bulb, sweating droplets of dark crimson nectar.',
        reachVerbs: ['graft', 'inhale', 'prune', 'water'],
        responses: {
          graft: 'You tighten the silk binding around the join. The plant shivers; two pale thorns lengthen by half an inch.',
          inhale: 'The crimson nectar smells of myrrh and iron—rich, sickeningly sweet, and dangerous.',
          prune: 'You clip away an infected petal; the severed tissue curls into ash before it drifts three inches.',
          water: 'Misting the graft causes the obsidian bulb to flex like a waking toad.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[SOLARIUM LOG // APOGEE ORBIT ${p.int(100, 999)} // STAR STATUS: PURPLE DWARF]`,
      `${keeper.prefix.toUpperCase()}: "Keep your boots clamped to the magnetic rail. If you float into the rose trellis, the thorns will unlace your pressure suit."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} is blooming out of turn again; the dying star is exciting the root-beds."`,
      `${keeper.prefix.toUpperCase()}: "His Imperial Majesty has been composted in the retort these twenty years, but his jasmine still expects water at noon."`,
      `[ATMOSPHERIC SOUND: the gentle hiss of microgravity air scrubbers and floating leaves brushing against glass]`
    ]
  },
  {
    id: 'glacial_scriptorium',
    nameTemplates: [
      (p) => `LEDGER-ROOM 81 // BLUE-ICE VAULT`,
      (p) => `SUB-ARCTIC CHANCERY OF REJECTED PETITIONS`,
      (p) => `THE PERMAFROST PIGEONHOLE ARCHIVE // SECTION ${p.choice(['IV', 'VII', 'X'])}`,
      (p) => `COLD-OFFICE K-${p.int(1, 19)} // SEALED FOLIOS`,
      (p) => `THE ICE-BORE REGISTRY // DOCKET ${p.int(100, 999)}`
    ],
    themes: [
      'a clerk\'s cubicle chiseled three hundred feet into glacial blue ice; carbon paper freezes before the ink dries',
      'an underground administrative vault beneath the ice cap where grievances are weighed against tallow rations',
      'the archive of an unrecorded empire preserved in permafrost; petitions are indexed by their frost-crystal structure',
      'a subterranean chancery where clerks wear three pairs of sheepskin mittens and write with heated bronze needles'
    ],
    palettes: [
      ['#0c1015', '#16202a', '#8da9c4', '#eef4f8', '#9e2a2b'],
      ['#090d12', '#141e28', '#64dfdf', '#caf0f8', '#48cae4'],
      ['#0b131a', '#1c2d37', '#a8dadc', '#f1faee', '#e63946']
    ],
    keepers: [
      {
        name: 'Deputy Clerk Aris',
        personality: 'wears three pairs of fingerless mittens; breathes onto his steel pen-nib every four words; hates sudden movement',
        idiom: 'docket numbers, wax seals, carbon paper smudges, blue ice faults, and tallow rations',
        prefix: 'Clerk Aris',
        unknownResponses: [
          (cmd) => `Clerk Aris dips his frozen nib into sludge: "'${cmd}' is not an authorized chancery action. Consult the index, or thaw, file, audit, scratch, or stamp."`,
          (cmd) => `Clerk Aris taps a cold ruler: "Command '${cmd}' lacks an official revenue stamp. Stick to vault protocols."`
        ]
      },
      {
        name: 'Registrar Ksenia',
        personality: 'perched atop a tall walnut ladder; drops lead balance weights onto dockets to verify if their legal weight holds',
        idiom: 'chancery dockets, ice creep, gall ink, and rejected petitions',
        prefix: 'Registrar Ksenia',
        unknownResponses: [
          (cmd) => `Ksenia adjusts her fur cowl: "'${cmd}' is missing from the imperial index. Try index, or thaw, file, audit, scratch, or stamp."`,
          (cmd) => `Ksenia frowns from her ladder: "'${cmd}' will not satisfy the ice auditors."`
        ]
      }
    ],
    lawsPool: [
      'Entries recorded in red ink freeze at a higher temperature than black ink.',
      'Any petition touched without mittens must be recopied from memory before sunset.',
      'No clerk may speak aloud the name of a town that has fewer than three chimneys.',
      'The glacial walls move two inches inward during every official audit.',
      'Carbon paper used three times begins to record thoughts the clerk omitted.',
      'A seal broken without witnesses remains legally intact until thawed.'
    ],
    helpVerb: 'index',
    reseedVerb: 'blizzard',
    verbsPool: [
      { name: 'thaw', help: 'thaw [ledger/inkwell] — warm frozen parchment or ink over the charcoal embers to reveal text.' },
      { name: 'file', help: 'file [docket/paper] — lodge a record into the cold iron pigeonholes.' },
      { name: 'audit', help: 'audit [target] — examine signatures, wax seals, or calculations for fraudulent discrepancies.' },
      { name: 'scratch', help: 'scratch [vellum/ice] — write with cold steel nib or etch markings into the frozen wall.' },
      { name: 'stamp', help: 'stamp [folio/docket] — apply the heavy brass chancery seal to an entity.' },
      { name: 'index', help: 'index — consult the chancery filing catalog and clerk regulations.' },
      { name: 'blizzard', help: 'blizzard — open the surface vents and let the blue drift bury the archive (reboot).' }
    ],
    entitiesPool: [
      {
        name: 'frozen-ledger-1891',
        title: 'Frozen Ledger 1891',
        aliases: ['ledger', 'book', 'folio', '1891'],
        kind: 'vellum folio welded shut by blue ice',
        desc: 'A massive calfskin registry whose pages are frozen solid into a brick of blue ice; its edges have been shaved with a drawknife.',
        reachVerbs: ['thaw', 'audit', 'scratch', 'stamp'],
        responses: {
          thaw: 'You hold the ledger over the embers. The ice turns transparent, revealing cramped iron-gall writing: "Item: 400 versts of uninhabited marsh ceded to the glacier in exchange for quiet."',
          audit: 'You inspect the shaved margins. Every column has been balanced down to the last tallow wick, but the sums do not account for the year 1888.',
          scratch: 'You etch your initials into the frosty vellum; the ice crystals bloom around the steel tip like white lichen.',
          stamp: 'You bring the heavy brass seal down on the frozen cover; it leaves a crisp, frosted relief of the double-headed seal.'
        }
      },
      {
        name: 'charcoal-brazier',
        title: 'Charcoal Brazier',
        aliases: ['brazier', 'embers', 'fire', 'pot'],
        kind: 'cast-iron heating pot',
        desc: 'A shallow iron bowl holding three embers of birch coal that shed no warmth further than six inches, only pale gray ash.',
        reachVerbs: ['thaw', 'audit', 'scratch'],
        responses: {
          thaw: 'You blow upon the gray embers. A dull red glow wakes in the coal; a thin streamer of fragrant birch smoke curls toward the ice ceiling.',
          audit: 'The coals have burned for three days without shrinking. The fuel is not birch; it is petrified bone.',
          scratch: 'You stir the ash with your pen-handle; among the coals rests a melted brass seal ring.'
        }
      },
      {
        name: 'lead-pigeonhole',
        title: 'Lead Pigeonhole',
        aliases: ['pigeonhole', 'cubby', 'files', 'shelf'],
        kind: 'honeycomb sheet-lead document shelf',
        desc: 'A wall of miniature square compartments stuffed with curled petitions tied with black wool ribbon, smelling of cellar damp.',
        reachVerbs: ['file', 'audit', 'thaw'],
        responses: {
          file: 'You tuck a rolled document into cubby 44. The lead walls groan softly as the glacier behind the shelf settles.',
          audit: 'You pull a docket from cubby 12: "Petition of the Widow S. regarding the disappearance of the sun over Lake Ladoga — DISMISSED AS FRIVOLOUS."',
          thaw: 'Warming the compartment releases the sharp, vinegar smell of ancient ink.'
        }
      },
      {
        name: 'gall-inkwell',
        title: 'Gall Inkwell',
        aliases: ['inkwell', 'ink', 'gall', 'well'],
        kind: 'soapstone oak-gall ink reservoir',
        desc: 'A heavy carved soapstone pot of purple-black ink, capped with a crust of delicate hexagonal ice needles.',
        reachVerbs: ['thaw', 'scratch', 'audit'],
        responses: {
          thaw: 'Holding your thumb over the stone well melts the crust. The liquid beneath is glossy black and smells of iron filings and crushed acorns.',
          scratch: 'You dip your steel nib through the ice crust; it emerges loaded with viscous black fluid that writes with clinical sharpness.',
          audit: 'The ink level in the well has not dropped, despite four thousand pages of audit transcripts.'
        }
      },
      {
        name: 'parchment-press',
        title: 'Parchment Press',
        aliases: ['press', 'screw', 'clamp'],
        kind: 'cast-iron screw flatten press',
        desc: 'A tabletop screw press holding flat a water-stained map of an empire whose borders melted seventy years ago.',
        reachVerbs: ['audit', 'thaw', 'scratch', 'stamp'],
        responses: {
          audit: 'You examine the coastline on the map. Every port town is marked with a tiny red wax dot, indicating abandoned quarantine.',
          thaw: 'Warming the iron screw allows you to loosen the wheel two turns; the parchment beneath expands with a dry sigh.',
          scratch: 'You trace the forgotten frontier with your nail; the vellum is brittle as dried horn.',
          stamp: 'You clamp the seal block down with the screw; the paper takes the impression with a satisfying crunch.'
        }
      },
      {
        name: 'brass-clerks-bell',
        title: 'Brass Clerk’s Bell',
        aliases: ['bell', 'counter-bell', 'chime'],
        kind: 'tarnished service counter bell',
        desc: 'A counter bell whose interior dome is stuffed with raw sheep wool so that ringing it will not trigger ice faults in the vault.',
        reachVerbs: ['audit', 'thaw', 'scratch'],
        responses: {
          audit: 'You inspect the underside. The wool muffling the clapper is stiff with grease and dried wax.',
          thaw: 'You hold the bell over the embers until the brass warms; the metal emits a high, faint singing tone like a mosquito.',
          scratch: 'You scratch the base with your knife; the number 14 is stamped next to the inspector\'s hallmark.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[COLD-ARCHIVE TRANSCRIPT // SECTION 14-B // TEMPERATURE: -8° C]`,
      `${keeper.prefix.toUpperCase()}: "Keep your voice low. The ice above us has three stress fractures that ring when someone clears their throat."`,
      `${keeper.prefix.toUpperCase()}: "The ${entities[0].title} has been requisitioned by the High Chancery; do not attempt to crack the ice until the audit opens."`,
      `${keeper.prefix.toUpperCase()}: "If you have come to petition for coal, turn back. The coal barges were frozen in the gulf before you were born."`,
      `[ICE SOUND: a sharp, distant crack reverberates through the blue glacial walls]`
    ]
  },
  {
    id: 'chime_foundry',
    nameTemplates: [
      (p) => `THE RESONATOR PIT // ELEVENTH TUNING`,
      (p) => `BRONZE-WELL OF THE FOUNDRY MASTERS // VAULT ${p.choice(['ALPHA', 'OMEGA', 'VII'])}`,
      (p) => `ACOUSTIC DAMPENING CHAMBER C-${p.int(1, 16)}`,
      (p) => `THE CHIME-CISTERN AT DEEP QUARRY`,
      (p) => `HARMONIC FORGE ${p.int(10, 88)} // SECTOR BELL`
    ],
    themes: [
      'a dry subterranean foundry pit hung with twenty-ton inverted bronze bowls; sound travels three seconds too slow',
      'a cavern workshop where monks tune church bells by chipping away cooled bronze with diamond-tipped chisels',
      'an acoustic cistern where long-dead foundry masters catalogued harmonics that cause tooth decay',
      'an underground bell-tuning gallery where silence is measured with mercury balances and lead weights'
    ],
    palettes: [
      ['#121110', '#241e1b', '#c97a3e', '#f2e2ba', '#52796f'],
      ['#0f0e11', '#1d1924', '#b08968', '#ede0d4', '#7f5539'],
      ['#14120e', '#2b2118', '#dd6e42', '#e8dab2', '#4f6d7a']
    ],
    keepers: [
      {
        name: 'Tuning Master Orlo',
        personality: 'deaf in the left ear; strikes tuning forks against his own teeth to verify pitch; speaks strictly in overtone intervals',
        idiom: 'bell-metal proportions, verdigris crust, strike notes, acoustic dampening, and hum frequencies',
        prefix: 'Master Orlo',
        unknownResponses: [
          (cmd) => `Master Orlo strikes a fork on his incisor: "'${cmd}' is a flat discord. Consult the chimes, or strike, tune, dampen, listen, or sand."`,
          (cmd) => `Master Orlo cups his right ear: "That word '${cmd}' has no strike note in this pit."`
        ]
      },
      {
        name: 'Bell-Founder Vane',
        personality: 'face pitted from flying droplets of bronze; wears a heavy lead apron; judges visitors by their chest resonance',
        idiom: 'casting sand, tin percentages, clapper swing, and cooling cracks',
        prefix: 'Founder Vane',
        unknownResponses: [
          (cmd) => `Founder Vane leans on his lead mallet: "'${cmd}' won't pour or ring. Stick to the chimes catalog, or strike, tune, dampen, listen, or sand."`,
          (cmd) => `Founder Vane spits into the casting sand: "'${cmd}' is hollow metal."`
        ]
      }
    ],
    lawsPool: [
      'The fifth harmonic only resonates while someone in the chamber is withholding a secret.',
      'Bells poured during a waning moon must never be struck with an iron hammer.',
      'Sound traveling south across the foundry pit loses two vibrations per yard.',
      'A bell that rings in a total vacuum will crack upon returning to atmospheric pressure.',
      'Silence is counted as an octave by the foundry masters.',
      'Any bell whose hum note outlasts the candle must be buried in casting sand.'
    ],
    helpVerb: 'chimes',
    reseedVerb: 'shatter',
    verbsPool: [
      { name: 'strike', help: 'strike [bell/fork] — swing mallet or tap knuckles against bronze or stone to test resonance.' },
      { name: 'tune', help: 'tune [chime/metal] — shave microtones from the inner rim using the diamond chisel.' },
      { name: 'dampen', help: 'dampen [target] — apply thick boiled felt to silence wild or dangerous overtones.' },
      { name: 'listen', help: 'listen [target] — close eyes and track the decaying acoustic tail in the chamber.' },
      { name: 'sand', help: 'sand [bronze/sand] — sift cooling sand or polish verdigris from a bell surface.' },
      { name: 'chimes', help: 'chimes — list the foundry\'s harmonic registers and acoustic verbs.' },
      { name: 'shatter', help: 'shatter — strike the fatal dissonant chord and collapse the chamber (reboot world).' }
    ],
    entitiesPool: [
      {
        name: 'master-chime-alpha',
        title: 'Master Chime Alpha',
        aliases: ['chime', 'bell', 'alpha', 'bowl'],
        kind: 'twelve-ton inverted bronze bowl',
        desc: 'An enormous bronze bell suspended from charred oak beams; it rings with a low hum whenever a horse passes on the road eighty feet above.',
        reachVerbs: ['strike', 'tune', 'dampen', 'listen', 'sand'],
        responses: {
          strike: 'You strike the rim with the lead-headed mallet. A sound like an iron sea breaking against cliffs rolls through the chamber; your ribs ache with the low C-sharp for two minutes.',
          tune: 'You touch the chisel to the inner waist. A bright curl of bronze shavings falls into the dust; the hum note rises by a quarter-tone.',
          dampen: 'You press the rabbit-felt pad against the rim. The vibration stops with a groan like a ship grounding in sand.',
          listen: 'You lean your temple near the cold bronze. Inside the curve, the bell is humming the harmonic of a choir fifty years dead.',
          sand: 'You buff the verdigris with emery cloth; golden bell metal emerges, glowing in the torchlight.'
        }
      },
      {
        name: 'cooling-sand-trough',
        title: 'Cooling Sand Trough',
        aliases: ['sand', 'trough', 'pit', 'molds'],
        kind: 'black silicate casting bed',
        desc: 'A wide trench of fine black casting sand still radiating dry heat from yesterday\'s pour, smelling of burned loam.',
        reachVerbs: ['sand', 'listen', 'strike'],
        responses: {
          sand: 'You run your fingers through the black sand. It is hot as fresh bread, yielding smoothly like silk flour.',
          listen: 'Leaning over the trough, you hear tiny cracks—the cooling bell deep in the sand contracting millimeter by millimeter.',
          strike: 'You thrust the mallet handle into the sand; a buried copper core rings with a muffled, sweet ping.'
        }
      },
      {
        name: 'obsidian-fork',
        title: 'Obsidian Fork',
        aliases: ['fork', 'obsidian', 'tuning-fork'],
        kind: 'volcanic glass pitch standard',
        desc: 'A pitch-tuning fork carved of jet-black volcanic glass; it makes no sound in air, but sings when dipped in water.',
        reachVerbs: ['strike', 'listen', 'tune', 'dampen'],
        responses: {
          strike: 'You tap the obsidian tines on your boot heel. In the air it is totally silent, but your skull rings with a sharp, cold octave.',
          listen: 'You dip the fork into a tin cup of water. The surface erupts into thousands of ultrasonic droplets dancing in a mandala.',
          tune: 'The glassy tines are cut with absolute perfection; not even a jeweler\'s file could take a micron from them.',
          dampen: 'You grip the tines with your bare palm; the silent ringing in your molars ceases instantly.'
        }
      },
      {
        name: 'tuning-chisel',
        title: 'Tuning Chisel',
        aliases: ['chisel', 'tool', 'blade'],
        kind: 'diamond-faced alloy scraper',
        desc: 'A heavy tool-steel scraper tipped with industrial black diamond, used to shave microtones from cast bronze rims.',
        reachVerbs: ['strike', 'tune', 'sand'],
        responses: {
          strike: 'The tool rings with a high, clear whistle when rapped against stone.',
          tune: 'The diamond edge bites cleanly into bell metal, throwing off spirals of bright copper hair.',
          sand: 'You wipe tallow and bronze dust from the shank with a leather scrap.'
        }
      },
      {
        name: 'chalk-register',
        title: 'Chalk Register',
        aliases: ['register', 'chalk', 'slate', 'board'],
        kind: 'slate tablet of harmonic waveforms',
        desc: 'A slab of gray Welsh slate covered in chalk sine-waves and frequency ratios of bells that cracked during the plague year.',
        reachVerbs: ['sand', 'listen', 'tune'],
        responses: {
          sand: 'You smudge away an erroneous vibration ratio with your sleeve; chalk dust smells of quarry rain.',
          listen: 'Reading the wave-forms makes your inner ear simulate the terrible dissonances cataloged there.',
          tune: 'You chalk in a new frequency: 108.4 Hz — the resonance of empty vaults.'
        }
      },
      {
        name: 'felt-damper',
        title: 'Felt Damper',
        aliases: ['damper', 'felt', 'pad', 'muffler'],
        kind: 'boiled rabbit-fur acoustic suppressor',
        desc: 'A thick pad of boiled rabbit fur mounted on an ash pole, used to choke wild overtones before they crack the stone vault.',
        reachVerbs: ['dampen', 'strike', 'sand'],
        responses: {
          dampen: 'You rest the soft fur against the vibrating floorboards; the room immediately grows eerily still.',
          strike: 'Striking the felt produces only a soft puff of chalk dust and dry silence.',
          sand: 'You shake the damper; bronze filings rain out onto the flagstones like glitter.'
        }
      }
    ],
    scriptGenerator: (keeper, entities, p) => [
      `[FOUNDRY PIT TELEMETRY // TUNING REGISTER ${p.int(10, 99)}]`,
      `${keeper.prefix.toUpperCase()}: "Cover your ears when you walk past the pit. The ${entities[0].title} is cooling, and when the core splits it sounds like a cannon."`,
      `${keeper.prefix.toUpperCase()}: "Every bell cast here is tuned to a human voice that ceased talking before the casting commenced."`,
      `${keeper.prefix.toUpperCase()}: "Do not strike the metal with iron. We use lead, bone, or the heel of the hand."`,
      `[ACOUSTIC RESONANCE: a deep, slow hum vibrates through your collarbones and knees]`
    ]
  }
];

// Wire openVerb, homeVerb, and apps into ARCHETYPES
for (const arch of ARCHETYPES) {
  const meta = ARCHETYPE_META[arch.id];
  if (meta) {
    arch.openVerb = meta.openVerb;
    arch.homeVerb = meta.homeVerb;
    for (const ev of meta.extraVerbs) {
      if (!arch.verbsPool.some(v => v.name === ev.name)) {
        arch.verbsPool.push(ev);
      }
    }
  }
  for (const ent of arch.entitiesPool) {
    const appDef = ENTITY_APPS[ent.name];
    if (appDef) {
      ent.app = {
        title: appDef.title,
        format: appDef.format,
        screen: appDef.screen,
        element: { ...appDef.element },
        elements: [{ ...appDef.element }]
      };
    } else {
      ent.app = {
        title: ent.title.toUpperCase(),
        format: 'apparatus',
        screen: ent.desc,
        element: {
          name: `${ent.name}-switch`,
          label: `Operate ${ent.title}`,
          type: 'button',
          state: 'primed',
          action: 'operate',
          responses: { operate: `You operate the ${ent.title}. ${ent.desc}` }
        },
        elements: []
      };
    }
  }
}



const ARCHETYPE_BINS = {
  brine_beacon: [
    { name: 'depth-ping', behavior: 'Emits an acoustic sounding wave forty fathoms into the glassy void.' },
    { name: 'trim-wick', behavior: 'Scrapes tallow carbon from the burner mantle.' }
  ],
  dead_god_cranium: [
    { name: 'trepan-vent', behavior: 'Opens cranial relief cock to release amber steam.' },
    { name: 'galvanic-tick', behavior: 'Applies copper current to the coronal seam.' }
  ],
  ash_railway: [
    { name: 'whistle', behavior: 'Blows the pressurized steam horn across the permafrost.' },
    { name: 'stoke-chute', behavior: 'Feeds three shovels of anthracite into Car 04 stove.' }
  ],
  monastic_loom: [
    { name: 'weft-tally', behavior: 'Counts liturgical knot rows woven since matins.' },
    { name: 'bodkin-pass', behavior: 'Clears tangled linen fibers from the reed.' }
  ],
  flooded_kitchen: [
    { name: 'scupper-kick', behavior: 'Dislodges grease from the floor drain to swirl floodwater.' },
    { name: 'tea-pour', behavior: 'Pours boiling chicory water into an enamel cup.' }
  ],
  orbital_solarium: [
    { name: 'starlight-steer', behavior: 'Focuses refracted violet beams onto the algae bed.' },
    { name: 'mist-blast', behavior: 'Releases pressurized jasmine aerosol across the trellis.' }
  ],
  glacial_scriptorium: [
    { name: 'bell-strike', behavior: 'Rings the brass clerk hand-bell down the blue-ice hallway.' },
    { name: 'thaw-wire-pulse', behavior: 'Warms nichrome wire to release a frozen vellum folio.' }
  ],
  chime_foundry: [
    { name: 'strike-core', behavior: 'Taps the lead mallet against the twelve-ton master bell.' },
    { name: 'sand-sift', behavior: 'Tests cooling silicate loam for acoustic cracks.' }
  ]
};

function generateWorld(seedInput, conceptInput) {
  const prng = new PRNG(seedInput);

  let concept = 'random';
  if (conceptInput && typeof conceptInput === 'string' && conceptInput.trim() && conceptInput.trim().toLowerCase() !== 'random') {
    concept = conceptInput.trim();
  }

  // Concept steering for archetype selection
  let archetype = null;
  if (concept !== 'random') {
    const cLow = concept.toLowerCase();
    const matches = [];
    if (/\b(lighthouse|pharos|beacon|sea|ocean|brine|salt|tallow|foghorn|underwater|submarine|water|nautical|mariner|coast|reef|glass)\b/i.test(cLow)) {
      matches.push('brine_beacon');
    }
    if (/\b(cranium|skull|bone|god|angel|seraph|marrow|titan|autopsy|trepan|ossuary|corpse|spine|nerve|head|celestial)\b/i.test(cLow)) {
      matches.push('dead_god_cranium');
    }
    if (/\b(railway|train|locomotive|carriage|rail|track|caboose|snow|frost|permafrost|tundra|siberia|coal|samovar|station|bog)\b/i.test(cLow)) {
      matches.push('ash_railway');
    }
    if (/\b(loom|weave|weaver|cloth|shuttle|thread|wool|silk|tapestry|monk|monastery|monastic|cloister|abbess|church|nun|linen)\b/i.test(cLow)) {
      matches.push('monastic_loom');
    }
    if (/\b(kitchen|flood|cook|table|oilcloth|stove|kettle|tea|broth|soup|pantry|cellar|grandmother|house|domestic|lard|radio)\b/i.test(cLow)) {
      matches.push('flooded_kitchen');
    }
    if (/\b(orbital|space|solarium|sun|solar|star|greenhouse|hydroponic|botanic|garden|plant|flower|orbit|satellite|dome|leaf)\b/i.test(cLow)) {
      matches.push('orbital_solarium');
    }
    if (/\b(glacier|ice|cold|scriptorium|scribe|ink|paper|archive|bureau|chancery|ledger|frost|vellum|library|audit)\b/i.test(cLow)) {
      matches.push('glacial_scriptorium');
    }
    if (/\b(chime|bell|foundry|bronze|cast|furnace|sound|acoustic|resonate|hammer|forge|metallurgy|tone|pitch|tuning)\b/i.test(cLow)) {
      matches.push('chime_foundry');
    }

    if (matches.length > 0) {
      const targetId = prng.choice(matches);
      archetype = ARCHETYPES.find(a => a.id === targetId);
    }
  }

  if (!archetype) {
    archetype = prng.choice(ARCHETYPES);
  }

  // Steer interface paradigm (gui / tui / device / scene)
  let iface = null;
  if (concept !== 'random') {
    const cLow = concept.toLowerCase();
    if (/\b(terminal|tui|cli|shell|console|curses|matrix|bbs)\b/i.test(cLow)) {
      iface = 'tui';
    } else if (/\b(cockpit|device|gauge|submarine|machine|instrument|meter|analog|valve|dial)\b/i.test(cLow)) {
      iface = 'device';
    } else if (/\b(room|scene|dream|kitchen|monastery|forest|bog|table|shrine|hall)\b/i.test(cLow)) {
      iface = 'scene';
    } else if (/\b(desktop|gui|window|windows|office|system|workbench|workstation|panel)\b/i.test(cLow)) {
      iface = 'gui';
    }
  }
  if (!iface) {
    const archeDefault = {
      brine_beacon: 'device',
      dead_god_cranium: 'scene',
      ash_railway: 'device',
      monastic_loom: 'scene',
      flooded_kitchen: 'scene',
      orbital_solarium: 'gui',
      glacial_scriptorium: 'tui',
      chime_foundry: 'device'
    }[archetype.id] || 'device';
    iface = prng.choice(['device', 'tui', 'gui', 'scene', archeDefault]);
  }

  const name = archetype.nameTemplates[prng.int(0, archetype.nameTemplates.length - 1)](prng);
  let theme = prng.choice(archetypes(archetype.id).themes || archetype.themes);
  if (concept !== 'random') {
    theme = `${theme} — shaped by concept "${concept}"`;
  }
  const palette = prng.choice(archetype.palettes);
  const keeperTemplate = prng.choice(archetype.keepers);

  // Entities: select 4-6 entities from the pool
  const entityCount = Math.min(archetype.entitiesPool.length, prng.int(4, Math.min(6, archetype.entitiesPool.length)));
  const selectedEntities = prng.sample(archetype.entitiesPool, entityCount).map(e => ({
    name: e.name,
    title: e.title,
    aliases: e.aliases ? [...e.aliases] : [],
    kind: e.kind,
    desc: e.desc,
    reachVerbs: e.reachVerbs ? [...e.reachVerbs] : [],
    responses: e.responses ? { ...e.responses } : {},
    app: {
      title: e.app.title,
      format: e.app.format,
      screen: e.app.screen,
      element: { ...e.app.element },
      elements: [{ ...e.app.element }]
    }
  }));

  // Laws: select 2-4 laws from the pool
  const lawCount = prng.int(2, Math.min(4, archetype.lawsPool.length));
  const selectedLaws = prng.sample(archetype.lawsPool, lawCount);

  // Bin commands
  const binCommands = (ARCHETYPE_BINS[archetype.id] || []).map(b => ({ ...b }));

  // Verbs: select 5-8 verbs
  const allVerbs = archetype.verbsPool.slice();
  const helpVerbObj = allVerbs.find(v => v.name === archetype.helpVerb);
  const reseedVerbObj = allVerbs.find(v => v.name === archetype.reseedVerb);
  const openVerbObj = allVerbs.find(v => v.name === archetype.openVerb);
  const homeVerbObj = allVerbs.find(v => v.name === archetype.homeVerb);

  const mandatory = [helpVerbObj, reseedVerbObj, openVerbObj, homeVerbObj].filter(Boolean);
  const mandatoryNames = new Set(mandatory.map(v => v.name));
  const otherVerbs = allVerbs.filter(v => !mandatoryNames.has(v.name));

  const targetVerbCount = prng.int(5, Math.min(8, allVerbs.length));
  const neededOthers = Math.max(1, targetVerbCount - mandatory.length);
  const selectedOthers = prng.sample(otherVerbs, neededOthers);

  const verbs = [...mandatory, ...selectedOthers];

  // Script
  const script = archetype.scriptGenerator(keeperTemplate, selectedEntities, prng);

  const keeper = {
    name: keeperTemplate.name,
    personality: keeperTemplate.personality,
    idiom: keeperTemplate.idiom,
    prefix: keeperTemplate.prefix
  };

  const world = {
    name,
    theme,
    concept,
    interface: iface,
    palette,
    keeper,
    entities: selectedEntities,
    laws: selectedLaws,
    verbs,
    bin: binCommands,
    script,
    seed: prng.hexSeed,
    archetypeId: archetype.id,
    helpVerb: archetype.helpVerb,
    reseedVerb: archetype.reseedVerb,
    openVerb: archetype.openVerb,
    homeVerb: archetype.homeVerb,
    unknownResponseGenerators: keeperTemplate.unknownResponses
  };

  try {
    writeWorldLarp(world);
  } catch (_) {}

  return world;
}
function interpretAppCombinatorial(world, entityQuery) {
  const clean = String(entityQuery || '').toLowerCase().trim();
  let entity = (world.entities || []).find(e =>
    e.name.toLowerCase() === clean ||
    (e.title && e.title.toLowerCase() === clean) ||
    (e.aliases && e.aliases.some(a => a.toLowerCase() === clean))
  );

  if (!entity && world.entities && world.entities.length > 0) {
    entity = world.entities[0];
  }

  if (!entity) {
    return createDamagedAppShell(world, entityQuery, 'No entity found');
  }

  const app = entity.app || {
    title: entity.title.toUpperCase(),
    format: 'gauge',
    screen: entity.desc,
    element: {
      name: `${entity.name}-control`,
      label: `Inspect ${entity.title}`,
      type: 'dial',
      state: 'calibrated',
      action: 'turn',
      responses: { turn: `You turn the dial on the ${entity.title}. ${entity.desc}` }
    }
  };

  const elem = app.element || (app.elements && app.elements[0]) || {
    name: `${entity.name}-control`,
    label: `Engage ${entity.title}`,
    type: 'button',
    state: 'primed',
    action: 'engage',
    responses: { engage: `You engage the apparatus.` }
  };

  return {
    entityName: entity.name,
    title: app.title || entity.title.toUpperCase(),
    format: app.format || 'apparatus',
    screen: app.screen || entity.desc,
    statusLine: `[${world.name} // ${app.format ? app.format.toUpperCase() : 'APPARATUS'} // STATE: ${elem.state.toUpperCase()}]`,
    element: {
      ...elem,
      currentValue: elem.state
    },
    elements: [elem],
    palette: world.palette
  };
}

function createDamagedAppShell(world, entityQuery, rawContent = '') {
  const clean = String(entityQuery || '').toLowerCase().trim();
  const entity = (world && world.entities ? world.entities.find(e => e.name.toLowerCase() === clean) : null) || (world && world.entities ? world.entities[0] : null);
  const entityTitle = entity ? entity.title : (entityQuery || 'APPARATUS');
  const entityName = entity ? entity.name : 'damaged-apparatus';

  return {
    entityName,
    title: `${entityTitle.toUpperCase()} [DAMAGED CASING]`,
    format: 'fractured-casing',
    screen: `[SYSTEM COHERENCE DECAY] The apparatus housing for ${entityTitle} has fractured under atmospheric stress. Pale static bleeds through hairline cracks in the enamel. Internal linkages hang loose, twitching with residual galvanic pulse.`,
    statusLine: `STATUS: DAMAGED // CASING FAULT // CORRUPTION DENSITY: HIGH`,
    element: {
      name: 'emergency-bypass',
      label: 'Force Fracture Bypass',
      type: 'lever',
      state: 'jammed',
      action: 'force',
      responses: {
        force: 'You wrench the cracked bypass lever against its bent pins. A shower of cold sparks answers, and the needle shudders back into baseline alignment.'
      },
      currentValue: 'jammed'
    },
    elements: [{
      name: 'emergency-bypass',
      label: 'Force Fracture Bypass',
      type: 'lever',
      state: 'jammed',
      action: 'force',
      responses: {
        force: 'You wrench the cracked bypass lever against its bent pins. A shower of cold sparks answers, and the needle shudders back into baseline alignment.'
      }
    }],
    palette: world ? world.palette : ['#09131b', '#0f2537', '#4ecdc4', '#cbe3db', '#e07a5f'],
    damaged: true
  };
}

function archetypes(id) {
  return ARCHETYPES.find(a => a.id === id) || ARCHETYPES[0];
}

module.exports = {
  ARCHETYPES,
  generateWorld,
  interpretAppCombinatorial,
  createDamagedAppShell
};

