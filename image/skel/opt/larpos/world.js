// app/world.js — Neutral Seeded Operating System Generator for LarpOS
// Zero dependencies. Framework to make an OS with zero pre-baked content bias.
// Conforms to Spec §12 (Zero Pre-baked Content, Novel Combinatorial Generator).

const { PRNG } = require('./prng');
const palettes = require('./banks/palettes');

// Structural Primitives for Name Composition
const PREFIXES = [
  'Apex', 'Nova', 'Aura', 'Summit', 'Vanguard', 'Core', 'Zenith', 'Prism',
  'Orbit', 'Pulse', 'Stratum', 'Vector', 'Atlas', 'Helix', 'Nexus', 'Echo',
  'Horizon', 'Aero', 'Sol', 'Lumen', 'Krypton', 'Argon', 'Quartz', 'Onyx'
];

const SUBMARINE_NOUNS = [
  'Submersible Console', 'HydroStation', 'Bathysphere Control', 'DeepNav Platform',
  'Nautilus Deck', 'Aquanaut Workstation', 'Oceanic System', 'SeaGate Terminal'
];

const RAILWAY_NOUNS = [
  'Rail Dispatcher', 'Locomotive Control', 'Transit Matrix', 'Trackway System',
  'Switchboard Console', 'Metropolitan Express', 'Interlock Station'
];

const DESKTOP_NOUNS = [
  'Workstation', 'Desktop OS', 'Workspace', 'Linux Environment',
  'System Platform', 'Operating Console', 'Productivity Suite', 'Desktop Environment'
];

const SPACE_NOUNS = [
  'Orbital Station', 'Stellar Observatory', 'AstroConsole', 'Telemetry Deck',
  'Starbound System', 'Cosmic Relay'
];

const BOTANY_NOUNS = [
  'Biosphere Control', 'Greenhouse System', 'Flora Station', 'Arboretum Console',
  'Canopy Monitor'
];

const GENERAL_NOUNS = [
  'Workstation', 'Operating System', 'System Platform', 'Console',
  'Workspace Environment', 'Compute Matrix', 'Terminal Host', 'Compute Node'
];

const SUFFIXES = [
  'v1.0', 'v2.4', 'v3.2', 'v4.0', 'Release 2', 'Release 5',
  'Build 80', 'Build 240', 'Build 512', 'Edition', 'Pro', 'SE', 'Standard'
];

function generateName(prng, concept) {
  const cLow = (concept || '').toLowerCase();
  let nounPool = GENERAL_NOUNS;
  if (/\b(submarine|underwater|sea|ocean|nautical|brine|diving|sonar)\b/i.test(cLow)) {
    nounPool = SUBMARINE_NOUNS;
  } else if (/\b(railway|train|locomotive|rail|track|transit)\b/i.test(cLow)) {
    nounPool = RAILWAY_NOUNS;
  } else if (/\b(space|orbital|astronomy|star|satellite|observatory)\b/i.test(cLow)) {
    nounPool = SPACE_NOUNS;
  } else if (/\b(garden|greenhouse|plant|botanical|flora|biosphere)\b/i.test(cLow)) {
    nounPool = BOTANY_NOUNS;
  } else if (/\b(practical|desktop|linux|workstation|office|pc|minimal)\b/i.test(cLow)) {
    nounPool = DESKTOP_NOUNS;
  }

  const prefix = prng.choice(PREFIXES);
  const noun = prng.choice(nounPool);
  const suffix = prng.choice(SUFFIXES);

  const roll = prng.int(0, 2);
  if (roll === 0) return `${prefix} ${noun} ${suffix}`;
  if (roll === 1) return `${prefix} ${noun}`;
  return `${noun} ${suffix}`;
}

const GENERAL_THEMES = [
  'General-purpose multitasking workstation operating system',
  'Modular lightweight computing environment with virtual process isolation',
  'Streamlined workstation console for systems engineering and management',
  'Distributed desktop environment for technical operations and utilities',
  'High-reliability system platform for interactive process supervision'
];

// Structural Application Archetypes (file-manager, terminal, settings, monitor, editor, network, scheduler, audio, devices, journal)
const GENERAL_ENTITY_TEMPLATES = [
  {
    name: 'file-manager',
    title: 'File Manager',
    kind: 'tool',
    desc: 'Hierarchical file tree browser with permissions, volume stats, and mount indicators.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'You inspect the File Manager. Storage volumes /bin, /apps, /etc, /log, /dev are active.',
      open: 'You launch the File Manager in the primary workspace.',
      query: 'Querying filesystem status: root filesystem mounted read-only, workspace scratch volume writable.'
    },
    app: {
      title: 'FILE MANAGER',
      format: 'browser',
      screen: 'Hierarchical directory view displaying active mounts and stored system files. Storage utilization is nominal.',
      element: {
        name: 'scan-dirs',
        label: 'Scan Directory Tree',
        type: 'button',
        state: 'ready',
        action: 'scan',
        responses: { scan: 'Directories scanned: 6 mount points verified, 0 filesystem errors detected.' }
      }
    }
  },
  {
    name: 'terminal',
    title: 'Terminal Console',
    kind: 'shell',
    desc: 'Interactive virtual teletype with VT100 emulation and process execution pipeline.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The Terminal Console is idling on the primary virtual pseudo-terminal.',
      open: 'You focus the Terminal Console window.',
      query: 'Shell environment is responsive with standard POSIX commands available.'
    },
    app: {
      title: 'TERMINAL CONSOLE',
      format: 'terminal',
      screen: 'Monospace shell buffer awaiting user instructions. Standard built-in commands are active in /bin.',
      element: {
        name: 'run-diagnostics',
        label: 'Run System Diagnostics',
        type: 'button',
        state: 'idle',
        action: 'diagnose',
        responses: { diagnose: 'Subsystem diagnostics passed: process table clean, memory allocation stable.' }
      }
    }
  },
  {
    name: 'settings',
    title: 'System Settings',
    kind: 'config',
    desc: 'Central control panel for configuring display geometry, color schemes, and input devices.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'System Settings register indicates display resolution and font profiles are synchronized.',
      open: 'You open the System Settings panel.',
      query: 'Current profile: standard desktop configuration.'
    },
    app: {
      title: 'SYSTEM SETTINGS',
      format: 'settings',
      screen: 'Configuration matrix for user preferences, display resolution, keyboard mapping, and network properties.',
      element: {
        name: 'save-config',
        label: 'Apply Changes',
        type: 'button',
        state: 'ready',
        action: 'apply',
        responses: { apply: 'Preferences applied and committed to persistent system sidecar.' }
      }
    }
  },
  {
    name: 'resource-monitor',
    title: 'Resource Monitor',
    kind: 'monitor',
    desc: 'Real-time telemetry measuring CPU load, memory utilization, and block I/O throughput.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Telemetry monitors show CPU load at 8% and memory consumption within baseline limits.',
      open: 'You bring the Resource Monitor to the foreground.',
      query: 'System resources: load average 0.08, memory heap nominal, thread count: 12.'
    },
    app: {
      title: 'RESOURCE MONITOR',
      format: 'gauge',
      screen: 'Visual graphs of processor throughput, memory occupancy, and I/O bandwidth updated at 1Hz.',
      element: {
        name: 'sample-load',
        label: 'Sample Hardware Load',
        type: 'dial',
        state: 'active',
        action: 'sample',
        responses: { sample: 'Hardware metrics sampled: CPU 6%, memory heap 42MB, I/O wait 0ms.' }
      }
    }
  },
  {
    name: 'text-editor',
    title: 'Text Editor',
    kind: 'editor',
    desc: 'Lightweight text editing utility for plain-text notes, configuration files, and scripts.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The Text Editor holds an empty scratch buffer ready for composition.',
      open: 'You launch the Text Editor workspace.',
      query: 'Text buffer is clean with UTF-8 encoding enabled.'
    },
    app: {
      title: 'TEXT EDITOR',
      format: 'editor',
      screen: 'A clean editor window with line numbering and syntax highlighting for local configuration scripts.',
      element: {
        name: 'write-buffer',
        label: 'Save Buffer',
        type: 'button',
        state: 'clean',
        action: 'save',
        responses: { save: 'Buffer contents written to disk storage.' }
      }
    }
  },
  {
    name: 'network-manager',
    title: 'Network Manager',
    kind: 'network',
    desc: 'Monitors Ethernet interfaces, routing tables, DNS resolution, and connection latency.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Network interfaces eth0 and lo are up with link negotiation complete.',
      open: 'You inspect the Network Manager.',
      query: 'Network routing table: default gateway reachable, packet loss 0%.'
    },
    app: {
      title: 'NETWORK MANAGER',
      format: 'network',
      screen: 'Network connection monitor with traffic counters, IP routing table, and socket connection lists.',
      element: {
        name: 'ping-gateway',
        label: 'Test Link Latency',
        type: 'button',
        state: 'connected',
        action: 'ping',
        responses: { ping: 'Round-trip probe to local gateway returned in 0.6ms. Link quality excellent.' }
      }
    }
  },
  {
    name: 'task-scheduler',
    title: 'Task Scheduler',
    kind: 'service',
    desc: 'Cron service and timer manager regulating background maintenance routines.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Scheduled queue contains 4 recurring maintenance jobs, 0 overdue tasks.',
      open: 'You open the Task Scheduler overview.',
      query: 'Cron daemon running with accurate clock synchronization.'
    },
    app: {
      title: 'TASK SCHEDULER',
      format: 'calendar',
      screen: 'Chronological timeline of scheduled background jobs, interval timers, and housekeeping events.',
      element: {
        name: 'trigger-cron',
        label: 'Run Maintenance Tick',
        type: 'button',
        state: 'idle',
        action: 'trigger',
        responses: { trigger: 'Scheduled maintenance tasks executed. All timers refreshed.' }
      }
    }
  },
  {
    name: 'audio-mixer',
    title: 'Audio Mixer',
    kind: 'audio',
    desc: 'Volume control board balancing application channels, system alerts, and notification sounds.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Master audio output is set to 75% across stereo channels.',
      open: 'You access the Audio Mixer console.',
      query: 'Audio hardware responsive; sample rate 44.1kHz, buffer underruns: 0.'
    },
    app: {
      title: 'AUDIO MIXER',
      format: 'mixer',
      screen: 'Graphic equalizer and level sliders for master volume, alert chimes, and background audio.',
      element: {
        name: 'toggle-mute',
        label: 'Mute Audio Channels',
        type: 'toggle',
        state: 'unmuted',
        action: 'toggle',
        responses: { toggle: 'Audio mute state toggled. Output level verified.' }
      }
    }
  },
  {
    name: 'device-manager',
    title: 'Device Manager',
    kind: 'hardware',
    desc: 'Bus topology viewer showing connected USB controllers, display adapters, and storage drives.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Hardware bus enumeration reports all primary controllers mapped without resource conflict.',
      open: 'You launch the Device Manager viewer.',
      query: 'Attached devices: 1 display adapter, 1 keyboard, 1 pointing device, 1 virtual disk.'
    },
    app: {
      title: 'DEVICE MANAGER',
      format: 'hardware',
      screen: 'Hardware device tree displaying connected peripherals, driver statuses, and memory ranges.',
      element: {
        name: 'bus-rescan',
        label: 'Rescan Peripheral Buses',
        type: 'button',
        state: 'ready',
        action: 'rescan',
        responses: { rescan: 'Peripheral bus rescan completed. All devices reported online.' }
      }
    }
  },
  {
    name: 'system-journal',
    title: 'System Journal',
    kind: 'log',
    desc: 'Event viewer displaying kernel log entries, audit records, and boot sequence milestones.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'System Journal tail indicates clean initialization with zero kernel panics.',
      open: 'You open the System Journal.',
      query: 'Log records: boot milestones recorded in /log/boot.log.'
    },
    app: {
      title: 'SYSTEM JOURNAL',
      format: 'viewer',
      screen: 'Structured chronological event log tracking kernel alerts, daemon transitions, and user commands.',
      element: {
        name: 'tail-log',
        label: 'Fetch Latest Entries',
        type: 'button',
        state: 'ready',
        action: 'refresh',
        responses: { refresh: 'Latest 20 journal entries loaded from system ring buffer.' }
      }
    }
  }
];

const SUBMARINE_ENTITY_TEMPLATES = [
  {
    name: 'depth-sounder',
    title: 'Depth Sounder',
    kind: 'gauge',
    desc: 'Acoustic echo sounder measuring depth beneath the keel and hydrostatic pressure.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The Depth Sounder needle registers 84 meters beneath the surface.',
      open: 'You inspect the Depth Sounder console.',
      query: 'Current sounding: 84 meters. Hydrostatic pressure nominal.'
    },
    app: {
      title: 'DEPTH SOUNDER',
      format: 'gauge',
      screen: 'Hydrostatic pressure column and acoustic bathymetry readout tracking distance to sea floor.',
      element: {
        name: 'sample-depth',
        label: 'Ping Keel Sounder',
        type: 'dial',
        state: 'ready',
        action: 'sample',
        responses: { sample: 'Keel sounder ping returned: 84 meters beneath keel, flat silt seabed.' }
      }
    }
  },
  {
    name: 'passive-sonar',
    title: 'Passive Sonar',
    kind: 'scanner',
    desc: 'Hydrophone listening array monitoring underwater acoustic spectrum and propeller signatures.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Hydrophones report ambient oceanic background; zero cavitation contacts.',
      open: 'You open the Passive Sonar console.',
      query: 'Acoustic contact log: background sea noise, zero hostile bearings.'
    },
    app: {
      title: 'PASSIVE SONAR',
      format: 'scanner',
      screen: 'Circular hydrophone bearing display showing ambient oceanic noise and contact tracking lines.',
      element: {
        name: 'sweep-bearing',
        label: 'Sweep Hydrophone Array',
        type: 'button',
        state: 'listening',
        action: 'sweep',
        responses: { sweep: '360-degree acoustic sweep completed: no cavitation contacts within 10 miles.' }
      }
    }
  },
  {
    name: 'ballast-manifold',
    title: 'Ballast Manifold',
    kind: 'valve',
    desc: 'Pneumatic high-pressure air valves governing trim tanks and negative buoyancy chambers.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Ballast tank indicators confirm neutral trim at zero degrees inclination.',
      open: 'You step up to the Ballast Manifold.',
      query: 'Trim tanks balanced; variable ballast pumps holding neutral buoyancy.'
    },
    app: {
      title: 'BALLAST MANIFOLD',
      format: 'valve',
      screen: 'Pneumatic valve manifold for variable buoyancy ballast tanks and trim angle regulators.',
      element: {
        name: 'vent-air',
        label: 'Vent Trim Air Valve',
        type: 'valve',
        state: 'seated',
        action: 'vent',
        responses: { vent: 'Trim air valve cracked open; high-pressure air vents to achieve neutral trim.' }
      }
    }
  },
  {
    name: 'navigation-chart',
    title: 'Hydrographic Chart',
    kind: 'browser',
    desc: 'Dead-reckoning plotting board and bathymetric charts of underwater trenches and ridges.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The chart table displays current plotted course along the designated undersea trench.',
      open: 'You examine the Hydrographic Chart.',
      query: 'Plotting vector: dead-reckoning position aligned with inertial guidance.'
    },
    app: {
      title: 'HYDROGRAPHIC CHART',
      format: 'browser',
      screen: 'Bathymetric depth contour chart displaying waypoints, navigational hazards, and current vector.',
      element: {
        name: 'plot-course',
        label: 'Plot Next Waypoint',
        type: 'button',
        state: 'ready',
        action: 'plot',
        responses: { plot: 'Waypoint plotted at coordinates 54N 12W. Course line updated.' }
      }
    }
  },
  {
    name: 'engine-telemetry',
    title: 'Engine Telemetry',
    kind: 'terminal',
    desc: 'Electric propulsion monitoring panel tracking battery bank voltage, shaft RPM, and motor heat.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Propulsion motor shaft spinning at standard cruising speed of 120 RPM.',
      open: 'You open the Engine Telemetry panel.',
      query: 'Battery banks at 82% capacity, motor armature temperature steady at 45C.'
    },
    app: {
      title: 'ENGINE TELEMETRY',
      format: 'terminal',
      screen: 'Propulsion metrics panel showing main shaft RPM, battery discharge rates, and thrust output.',
      element: {
        name: 'throttle-adjust',
        label: 'Inspect Motor Current',
        type: 'button',
        state: 'running',
        action: 'inspect',
        responses: { inspect: 'Armature current draw steady at 240 amperes. Propulsion output normal.' }
      }
    }
  }
];

const RAILWAY_ENTITY_TEMPLATES = [
  {
    name: 'track-diagram',
    title: 'Track Diagram',
    kind: 'browser',
    desc: 'Illuminated track layout showing turnout switch alignments, track circuits, and route locks.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The diagram shows primary mainline tracks clear with points locked normal.',
      open: 'You view the Track Diagram board.',
      query: 'Track circuits: block section 12 clear, approach section occupied by Train 42.'
    },
    app: {
      title: 'TRACK DIAGRAM',
      format: 'browser',
      screen: 'Schematic track diagram with illuminated lamps indicating switch point positions and route clearance.',
      element: {
        name: 'lock-route',
        label: 'Align Route Interlocking',
        type: 'button',
        state: 'locked',
        action: 'align',
        responses: { align: 'Points aligned and locked to Main Line. Signal clearance granted.' }
      }
    }
  },
  {
    name: 'boiler-gauge',
    title: 'Boiler Telemetry',
    kind: 'gauge',
    desc: 'Steam pressure gauges and boiler water level indicators for the locomotive motive power.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Boiler steam pressure registers 180 psi; water column glass shows half glass.',
      open: 'You step up to the Boiler Telemetry panel.',
      query: 'Boiler state: steam pressure steady, safety valves seated.'
    },
    app: {
      title: 'BOILER TELEMETRY',
      format: 'gauge',
      screen: 'Twin Bourdon tube steam pressure gauges and illuminated water sight glasses monitoring boiler health.',
      element: {
        name: 'sample-pressure',
        label: 'Sample Steam Pressure',
        type: 'dial',
        state: 'optimal',
        action: 'sample',
        responses: { sample: 'Steam pressure verified: 180 psi across steam manifold.' }
      }
    }
  },
  {
    name: 'throttle-quadrant',
    title: 'Throttle Quadrant',
    kind: 'lever',
    desc: 'Steam regulator valve and reversible cutoff quadrant governing locomotive power.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Reverser quadrant is set to 25% forward cutoff; regulator valve cracked two notches.',
      open: 'You access the Throttle Quadrant controls.',
      query: 'Regulator position: 25% cutoff, tractive effort balanced.'
    },
    app: {
      title: 'THROTTLE QUADRANT',
      format: 'lever',
      screen: 'Mechanical quadrant with notched reverser lever and primary steam regulator handle.',
      element: {
        name: 'notch-reverser',
        label: 'Notch Cutoff Quadrant',
        type: 'lever',
        state: 'notched',
        action: 'notch',
        responses: { notch: 'Cutoff lever notched forward one tooth to 22% cutoff.' }
      }
    }
  },
  {
    name: 'timetable-ledger',
    title: 'Timetable Ledger',
    kind: 'calendar',
    desc: 'Master train dispatch sheet recording section clearance, scheduled meets, and train orders.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'The ledger shows all through freights on schedule with zero section delays.',
      open: 'You consult the Timetable Ledger.',
      query: 'Dispatch log: Train 42 cleared through Block 8 at 14:12.'
    },
    app: {
      title: 'TIMETABLE LEDGER',
      format: 'calendar',
      screen: 'Chronological dispatcher ledger displaying train orders, passing loops, and arrival times.',
      element: {
        name: 'log-clearance',
        label: 'Verify Section Clearance',
        type: 'button',
        state: 'ready',
        action: 'verify',
        responses: { verify: 'Section clearance logged on master sheet: next train due in 18 minutes.' }
      }
    }
  },
  {
    name: 'block-telegraph',
    title: 'Block Telegraph',
    kind: 'terminal',
    desc: 'Needle telegraph instrument and single-stroke bells coordinating with adjacent signal boxes.',
    reachVerbs: ['inspect', 'open', 'query'],
    responses: {
      inspect: 'Telegraph needle is resting at Line Clear; bell circuit ready for bell codes.',
      open: 'You check the Block Telegraph console.',
      query: 'Block telegraph protocol: Line Clear acknowledged by downstream tower.'
    },
    app: {
      title: 'BLOCK TELEGRAPH',
      format: 'terminal',
      screen: 'Two-needle block telegraph instrument and bell code annunciator coordinating section blocks.',
      element: {
        name: 'ring-bell',
        label: 'Transmit Bell Code',
        type: 'button',
        state: 'ready',
        action: 'ring',
        responses: { ring: 'Train Approaching bell code (3-1) transmitted and acknowledged by downstream box.' }
      }
    }
  }
];

const GENERAL_LAWS = [
  'Unsaved buffers are flushed to persistent storage during shutdown.',
  'Filesystem modifications require valid path references.',
  'System services maintain active process isolation.',
  'Background tasks execute within allocated time slices.',
  'Virtual memory partitions are synchronized periodically.'
];

const SUBMARINE_LAWS = [
  'Hull integrity hatches must remain dog-latched at depth.',
  'Variable ballast tanks must be balanced prior to propulsion advance.',
  'Hydrophone arrays take priority over active acoustic emissions.',
  'Atmospheric scrubbing systems operate continuously on closed circuit.'
];

const RAILWAY_LAWS = [
  'Block section occupancy must be verified prior to signal clearance.',
  'Boiler water injectors must be tested at every crew shift.',
  'Switches and interlockings must be locked before motive movement.',
  'Timetable orders take precedence over local dispatch improvisation.'
];

const DESKTOP_LAWS = [
  'User processes execute with non-privileged workspace rights.',
  'Virtual directories /bin, /apps, /etc, /log, /dev are mounted read-only by default.',
  'Desktop application states are saved to local session sidecars.',
  'Screen geometry dynamically adapts to window frame constraints.'
];

const STANDARD_VERBS = [
  { name: 'help', help: 'help [verb] — display system guidance and command syntax.' },
  { name: 'open', help: 'open [app] — launch an application into its workspace screen.' },
  { name: 'home', help: 'home — return to the main desktop or overview.' },
  { name: 'reseed', help: 'reseed — reboot the environment with a new concept prompt.' },
  { name: 'status', help: 'status — display overall operating system status.' },
  { name: 'apps', help: 'apps — list all available applications.' },
  { name: 'laws', help: 'laws — inspect core system guidelines.' }
];

const BIN_COMMANDS = [
  { name: 'sysinfo', behavior: 'Prints kernel version, uptime, and system statistics.' },
  { name: 'netstat', behavior: 'Displays active network connections and sockets.' },
  { name: 'sync', behavior: 'Flushes virtual memory buffers to storage.' }
];

const SUPERVISOR_NAMES = [
  'Operator Vance', 'Supervisor Chen', 'Administrator Miller', 'Operator Hayes',
  'Host Daemon', 'System Supervisor', 'Operator Kowalski', 'Supervisor Alvarez'
];

function generateWorld(seedInput, conceptInput) {
  const prng = new PRNG(seedInput);

  let concept = 'random';
  if (conceptInput && typeof conceptInput === 'string' && conceptInput.trim() && conceptInput.trim().toLowerCase() !== 'random') {
    concept = conceptInput.trim();
  }

  const cLow = concept.toLowerCase();
  const isPractical = /\b(practical|lightweight|desktop|fast|minimal|linux|work|office|utility|workstation|pc)\b/i.test(cLow);
  const isSubmarine = /\b(submarine|underwater|sea|ocean|nautical|brine|diving|sonar)\b/i.test(cLow);
  const isRailway = /\b(railway|train|locomotive|rail|track|transit)\b/i.test(cLow);

  let archetypeId = 'workstation';
  if (isPractical) {
    archetypeId = 'practical_desktop';
  } else if (isSubmarine) {
    archetypeId = 'submarine';
  } else if (isRailway) {
    archetypeId = 'railway';
  }

  // Steer Interface Paradigm
  let iface = null;
  if (isPractical) {
    iface = 'gui';
  } else if (concept !== 'random') {
    if (/\b(terminal|tui|cli|shell|console|curses|bash|ncurses)\b/i.test(cLow)) {
      iface = 'tui';
    } else if (/\b(cockpit|device|gauge|machine|instrument|meter|analog|valve|dial)\b/i.test(cLow)) {
      iface = 'device';
    } else if (/\b(room|scene|space|chamber|spatial|hall|cathedral)\b/i.test(cLow)) {
      iface = 'scene';
    } else if (/\b(desktop|gui|window|workspace|system|workbench)\b/i.test(cLow)) {
      iface = 'gui';
    }
  }
  if (!iface) {
    iface = prng.choice(['gui', 'tui', 'device', 'scene']);
  }

  // Generate Name
  const name = generateName(prng, concept);

  // Theme
  let theme;
  if (concept !== 'random') {
    theme = `Operating system environment configured for "${concept}"`;
  } else {
    theme = prng.choice(GENERAL_THEMES);
  }

  // Palette from palette bank generator
  const palGen = palettes.generatePalette(prng.seedInt, concept);
  const palette = palGen.array;

  // Supervisor / Keeper
  const supervisorName = prng.choice(SUPERVISOR_NAMES);
  const keeper = {
    name: supervisorName,
    personality: 'Attentive, technical, and precise',
    idiom: 'Operational telemetry and direct diagnostics',
    prefix: supervisorName.split(' ')[0]
  };

  const unknownResponses = [
    (cmd) => `${keeper.name}: "Unrecognized command '${cmd}'. Type 'help' to review available operational commands."`,
    (cmd) => `${keeper.name}: "The system does not recognize '${cmd}'. Check syntax or consult 'help'."`
  ];

  // Entity Pool Selection
  let entityPool;
  if (isSubmarine) {
    entityPool = SUBMARINE_ENTITY_TEMPLATES;
  } else if (isRailway) {
    entityPool = RAILWAY_ENTITY_TEMPLATES;
  } else {
    entityPool = GENERAL_ENTITY_TEMPLATES;
  }

  let selectedEntities;
  if (isPractical) {
    // Ensure core desktop tools are present
    const coreSlugs = ['file-manager', 'terminal', 'settings', 'resource-monitor', 'text-editor'];
    const coreEntities = GENERAL_ENTITY_TEMPLATES.filter(e => coreSlugs.includes(e.name));
    const optionalEntities = GENERAL_ENTITY_TEMPLATES.filter(e => !coreSlugs.includes(e.name));
    const extraCount = prng.int(0, 1);
    const extra = prng.sample(optionalEntities, extraCount);
    selectedEntities = [...coreEntities, ...extra];
  } else {
    const poolSize = entityPool.length;
    const count = prng.int(Math.min(4, poolSize), Math.min(6, poolSize));
    selectedEntities = prng.sample(entityPool, count);
  }

  // Clone entities to avoid mutating templates
  const entities = selectedEntities.map(e => ({
    name: e.name,
    title: e.title,
    aliases: e.aliases ? [...e.aliases] : [e.name, e.title.toLowerCase()],
    kind: e.kind,
    desc: e.desc,
    reachVerbs: e.reachVerbs ? [...e.reachVerbs] : ['inspect', 'open', 'query'],
    responses: { ...e.responses },
    app: {
      title: e.app.title,
      format: e.app.format,
      screen: e.app.screen,
      element: { ...e.app.element },
      elements: [{ ...e.app.element }]
    }
  }));

  // Laws
  let lawsPool = GENERAL_LAWS;
  if (isPractical) lawsPool = DESKTOP_LAWS;
  else if (isSubmarine) lawsPool = SUBMARINE_LAWS;
  else if (isRailway) lawsPool = RAILWAY_LAWS;

  const lawCount = prng.int(2, Math.min(4, lawsPool.length));
  const laws = prng.sample(lawsPool, lawCount);

  // Verbs
  const verbs = STANDARD_VERBS.map(v => ({ ...v }));

  // Bin commands
  const binCommands = BIN_COMMANDS.map(b => ({ ...b }));

  // Script
  const script = [
    `[KERNEL] Subsystems initialized and virtual memory mapped.`,
    `[SYSTEM] Welcome to ${name}.`,
    `[STATUS] All background services and virtual partitions reporting nominal.`
  ];

  const world = {
    name,
    theme,
    concept,
    interface: iface,
    palette,
    keeper,
    entities,
    laws,
    verbs,
    bin: binCommands,
    script,
    seed: prng.hexSeed,
    archetypeId,
    helpVerb: 'help',
    reseedVerb: 'reseed',
    openVerb: 'open',
    homeVerb: 'home',
    unknownResponseGenerators: unknownResponses
  };

  try {
    const { generateDesignSpec } = require('./design');
    world.designSpec = generateDesignSpec(world);
  } catch (_) {}

  try {
    const { writeWorldLarp } = require('./larp');
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
    format: 'application',
    screen: entity.desc,
    element: {
      name: `${entity.name}-control`,
      label: `Inspect ${entity.title}`,
      type: 'button',
      state: 'ready',
      action: 'run',
      responses: { run: `You run ${entity.title}. ${entity.desc}` }
    }
  };

  const elem = app.element || (app.elements && app.elements[0]) || {
    name: `${entity.name}-control`,
    label: `Run ${entity.title}`,
    type: 'button',
    state: 'ready',
    action: 'run',
    responses: { run: `You run the application.` }
  };

  return {
    entityName: entity.name,
    title: app.title || entity.title.toUpperCase(),
    format: app.format || 'application',
    screen: app.screen || entity.desc,
    statusLine: `[${world.name} - ${app.format ? app.format.toUpperCase() : 'APPLICATION'} - STATE: ${elem.state.toUpperCase()}]`,
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
  const entityTitle = entity ? entity.title : (entityQuery || 'Application');
  const entityName = entity ? entity.name : 'unreadable-app';

  return {
    entityName,
    title: `${entityTitle.toUpperCase()} [SECTION UNREADABLE]`,
    format: 'unreadable-section',
    screen: `SECTION UNREADABLE - rendering in reduced fidelity. The application manifest for ${entityTitle} could not be decoded. System fallback engaged.`,
    statusLine: `STATUS: UNREADABLE - REDUCED FIDELITY`,
    element: {
      name: 'restore-default',
      label: 'Restore Safe Default',
      type: 'button',
      state: 'ready',
      action: 'restore',
      responses: {
        restore: `Default parameters restored for ${entityTitle}. Subsystem operational in safe mode.`
      },
      currentValue: 'ready'
    },
    elements: [{
      name: 'restore-default',
      label: 'Restore Safe Default',
      type: 'button',
      state: 'ready',
      action: 'restore',
      responses: {
        restore: `Default parameters restored for ${entityTitle}. Subsystem operational in safe mode.`
      }
    }],
    palette: world ? world.palette : ['#09131b', '#0f2537', '#4ecdc4', '#cbe3db', '#e07a5f'],
    damaged: true
  };
}

module.exports = {
  ARCHETYPES: [],
  generateWorld,
  interpretAppCombinatorial,
  createDamagedAppShell
};
