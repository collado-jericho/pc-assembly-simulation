import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Canvas,
  useThree,
} from "@react-three/fiber";

import {
  OrbitControls,
  Text,
  RoundedBox,
  Environment,
  ContactShadows,
} from "@react-three/drei";

import * as THREE from "three";

import "./App.css";

/* =========================================================
   PC ASSEMBLY LAB
========================================================= */

/* =========================================================
   CASE
========================================================= */

const CASE = {
  x: 4.0,
  y: 0,
  z: 0,

  width: 4.9,
  height: 6.2,
  depth: 3.6,
};

/* =========================================================
   MOTHERBOARD
========================================================= */

const BOARD = {
  x: -0.35,
  y: 3.35,
  z: -0.92,

  width: 3.65,
  height: 5.15,
};

const WORLD = {
  boardX: CASE.x + BOARD.x,
  boardY: BOARD.y,
  boardZ: BOARD.z,
};

/* =========================================================
   COMPONENT SLOT POSITIONS
========================================================= */

const SLOTS = {
  // Motherboard slots are stored in WORLD coordinates.
  cpu: [WORLD.boardX - 0.85, WORLD.boardY + 1.35, WORLD.boardZ + 0.18],
  cooler: [WORLD.boardX - 0.85, WORLD.boardY + 1.35, WORLD.boardZ + 0.48],

  ram: [WORLD.boardX + 0.45, WORLD.boardY + 1.35, WORLD.boardZ + 0.20],
  ssd: [WORLD.boardX + 0.88, WORLD.boardY + 0.40, WORLD.boardZ + 0.18],

  gpu: [WORLD.boardX + 0.02, WORLD.boardY - 0.80, WORLD.boardZ + 0.18],
  pcieWifi: [WORLD.boardX + 0.02, WORLD.boardY - 1.28, WORLD.boardZ + 0.18],
  pcieSound: [WORLD.boardX + 0.02, WORLD.boardY - 1.76, WORLD.boardZ + 0.18],

  cmos: [WORLD.boardX + 0.00, WORLD.boardY + 0.20, WORLD.boardZ + 0.18],
  chipset: [WORLD.boardX - 0.70, WORLD.boardY + 0.20, WORLD.boardZ + 0.18],
  atx24: [WORLD.boardX - 1.54, WORLD.boardY - 1.28, WORLD.boardZ + 0.18],

  // Power / front-panel connection targets.
  eps8: [WORLD.boardX - 0.93, WORLD.boardY - 2.00, WORLD.boardZ + 0.16],
  cpuFan: [WORLD.boardX - 0.05, WORLD.boardY + 2.20, WORLD.boardZ + 0.18],
  gpuPower: [WORLD.boardX + 1.49, WORLD.boardY - 0.55, WORLD.boardZ + 0.20],
  sataData: [WORLD.boardX + 0.02, WORLD.boardY - 2.00, WORLD.boardZ + 0.16],
  sataPower: [CASE.x - 1.25 + 0.48,0.58, 0.92 + 0.34],
  caseFan: [WORLD.boardX + 1.00, WORLD.boardY - 0.05, WORLD.boardZ + 0.18],
  powerSW: [WORLD.boardX + 1.54, WORLD.boardY - 1.35, WORLD.boardZ + 0.18],

  // Case-local storage locations are converted to world coordinates here.
  psu: [CASE.x + 0.5,0.95, 0.92,],
  fan: [CASE.x + 2.5, 3.1, 0],
  hdd: [CASE.x - 1.25, 0.58, 0.92],
};

/* =========================================================
   PART DATA
========================================================= */

const PARTS = [
  {
    id: "cpu",
    name: "CPU",
    type: "cpu",
    color: "#c9c9c9",
    size: [0.42, 0.08, 0.42],
    start: [-5.80, 0.65, 0.65],
    slot: SLOTS.cpu,
    snap: 0.55,
  },

  {
    id: "cooler",
    name: "CPU Cooler",
    type: "cooler",
    color: "#2d3237",
    size: [0.82, 0.28, 0.82],
    start: [-3.70, 0.65, 0.65],
    slot: SLOTS.cooler,
    snap: 0.60,
    requires: ["cpu", "ram"],
  },

  {
    id: "ram",
    name: "RAM",
    type: "ram",
    color: "#20b967",
    size: [0.12, 0.62, 0.06],
    start: [-1.60, 0.65, 0.65],
    slot: SLOTS.ram,
    snap: 0.45,
    requires: ["cpu"],
  },

  {
    id: "gpu",
    name: "GPU",
    type: "gpu",
    color: "#216bd1",
    size: [1.55, 0.18, 0.58],
    start: [-5.80, 1.95, 0.65],
    slot: SLOTS.gpu,
    snap: 0.65,
    requires: ["cpu", "ram", "psu"],
  },

  {
    id: "ssd",
    name: "M.2 SSD",
    type: "ssd",
    color: "#aaaeb2",
    size: [0.65, 0.05, 0.16],
    start: [-3.70, 1.95, 0.65],
    slot: SLOTS.ssd,
    snap: 0.50,
    requires: ["cpu"],
  },

  {
    id: "psu",
    name: "PSU",
    type: "psu",
    color: "#17191c",
    size: [0.90, 0.65, 1.15],
    start: [-1.60, 1.95, 0.65],
    slot: SLOTS.psu,
    snap: 0.65,
  },

  {
    id: "fan",
    name: "Case Fan",
    type: "fan",
    color: "#343a40",
    size: [0.70, 0.10, 0.70],
    start: [-5.80, 3.25, 0.65],
    slot: SLOTS.fan,
    snap: 1.2,
    requires: ["psu"],
  },

  {
    id: "hdd",
    name: "HDD",
    type: "hdd",
    color: "#5f666d",
    size: [0.80, 0.25, 0.50],
    start: [-3.70, 3.25, 0.65],
    slot: SLOTS.hdd,
    snap: 0.90,
    requires: ["psu"],
  },

  /* =====================================================
     NEW COMPONENTS
  ===================================================== */

  {
    id: "chipset",
    name: "Chipset",
    type: "chipset",
    color: "#252b31",
    size: [0.62, 0.08, 0.48],
    start: [-1.60, 3.25, 0.65],
    slot: SLOTS.chipset,
    snap: 0.45,
    requires: ["cpu"],
  },

  {
    id: "pcieWifi",
    name: "Wi-Fi PCIe Card",
    type: "pcieWifi",
    color: "#1d2730",
    size: [1.65, 0.12, 0.36],
    start: [-5.80, 4.55, 0.65],
    slot: SLOTS.pcieWifi,
    snap: 0.55,
    requires: ["gpu"],
  },

  {
    id: "pcieSound",
    name: "Sound PCIe Card",
    type: "pcieSound",
    color: "#202a31",
    size: [1.65, 0.12, 0.36],
    start: [-3.70, 4.55, 0.65],
    slot: SLOTS.pcieSound,
    snap: 0.55,
    requires: ["pcieWifi"],
  },

  {
    id: "cmos",
    name: "CMOS Battery",
    type: "cmos",
    color: "#c6c9cb",
    size: [0.42, 0.10, 0.42],
    start: [-1.60, 4.55, 0.65],
    slot: SLOTS.cmos,
    snap: 0.45,
    requires: ["cpu"],
  },

  {
    id: "atx24",
    name: "24-Pin ATX Connector",
    type: "atx24",
    color: "#111418",
    size: [0.22, 0.95, 0.16],
    start: [-5.80, 5.85, 0.65],
    slot: SLOTS.atx24,
    snap: 0.50,
    requires: ["psu"],
  },

  /* =====================================================
     POWER / CABLE CONNECTIONS
  ===================================================== */

  {
    id: "eps8",
    name: "8-Pin CPU/EPS Connector",
    type: "eps8",
    color: "#121518",
    size: [0.20, 0.38, 0.16],
    start: [-3.95, 5.85, 0.65],
    slot: SLOTS.eps8,
    snap: 0.45,
    requires: ["cpu", "psu"],
  },

  {
    id: "cpuFan",
    name: "CPU_FAN Connector",
    type: "cpuFan",
    color: "#15191c",
    size: [0.18, 0.28, 0.14],
    start: [-2.05, 5.85, 0.65],
    slot: SLOTS.cpuFan,
    snap: 0.42,
    requires: ["cooler"],
  },

  {
    id: "gpuPower",
    name: "GPU Power Cable",
    type: "gpuPower",
    color: "#0d1013",
    size: [0.18, 0.42, 0.14],
    start: [-0.10, 5.85, 0.65],
    slot: SLOTS.gpuPower,
    snap: 0.48,
    requires: ["gpu", "psu"],
  },

  {
    id: "sataData",
    name: "SATA Data Cable",
    type: "sataData",
    color: "#9b2027",
    size: [0.14, 0.52, 0.10],
    start: [-5.80, 7.05, 0.65],
    slot: SLOTS.sataData,
    snap: 0.48,
    requires: ["hdd", "psu"]
  },

  {
    id: "sataPower",
    name: "SATA Power Cable",
    type: "sataPower",
    color: "#141619",
    size: [0.16, 0.52, 0.12],
    start: [-3.70, 7.05, 0.65],
    slot: SLOTS.sataPower,
    snap: 0.48,
    requires: ["hdd", "psu"],
  },

{
  id: "caseFan",
  name: "Case Fan Connector",
  type: "caseFan",
  color: "#171a1d",
  size: [0.18, 0.28, 0.14],
  start: [-1.60, 7.05, 0.65],
  slot: SLOTS.caseFan,
  snap: 0.85,
  requires: ["fan"],
},

  {
    id: "powerSW",
    name: "Power SW",
    type: "powerSW",
    color: "#20252a",
    size: [0.16, 0.26, 0.12],
    start: [0.50, 7.05, 0.65],
    slot: SLOTS.powerSW,
    snap: 0.42,
    requires: ["atx24"],
  },
];

const getInstallBlockReason = (partId, installed) => {
  const part = PARTS.find((p) => p.id === partId);

  if (!part) return null;

  const missing = (part.requires || []).filter(
    (requiredId) => !installed.includes(requiredId)
  );

  if (missing.length === 0) {
    return null;
  }

  const missingNames = missing.map((id) => {
    const requiredPart = PARTS.find((p) => p.id === id);
    return requiredPart?.name || id;
  });

  return `You must install first: ${missingNames.join(", ")}`;
};

const PART_INFO = {
  cpu: "The CPU is the 'brain' of the computer — it executes instructions and calculations.",
  cooler: "The CPU cooler prevents the processor from overheating during operation.",
  ram: "RAM is fast temporary memory the CPU uses while running programs.",
  gpu: "The GPU renders images and video — essential for gaming, design, or heavy display use.",
  ssd: "The M.2 SSD is fast permanent storage for your operating system and files.",
  psu: "The Power Supply Unit converts wall power into usable power for every component.",
  fan: "Case fans move air through the case to keep everything cool.",
  hdd: "The HDD is a traditional hard drive used for extra long-term storage.",
  chipset: "The chipset manages communication between the CPU and other components.",
  pcieWifi: "This expansion card adds Wi-Fi connectivity to the system.",
  pcieSound: "This expansion card provides higher-quality audio output.",
  cmos: "The CMOS battery keeps the motherboard's clock and settings saved when powered off.",
  atx24: "The 24-pin connector delivers main power from the PSU to the motherboard.",
  eps8: "The 8-pin CPU/EPS connector supplies dedicated power to the CPU area.",
  cpuFan: "The CPU_FAN connector powers and monitors the CPU cooler fan.",
  gpuPower: "The GPU power cable supplies additional power to a graphics card that needs it.",
  sataData: "The SATA data cable carries storage data between the HDD and motherboard.",
  sataPower: "The SATA power cable delivers power from the PSU to the HDD.",
  caseFan: "The case fan connector supplies power to the case fan.",
  powerSW: "The Power SW connector links the case power button to the motherboard header.",
};

/* =========================================================
   FAULT DIAGNOSIS DATA
========================================================= */

const FAULTS = [
  {
    partId: "ram",
    symptom:
      "The fans spin, but there is no display and the motherboard keeps beeping repeatedly.",
    distractors: ["cpuFan", "gpu", "cmos"],
    explanation:
      "RAM that is missing or not fully seated stops the system from finishing POST, so there is no display and the board gives beep codes.",
  },
  {
    partId: "ssd",
    symptom:
      "The PC powers on and reaches the BIOS screen, but no operating system is found. The M.2 drive is not listed.",
    distractors: ["hdd", "ram", "sataData"],
    explanation:
      "An M.2 SSD that is not seated in its socket will not be detected by the BIOS, so there is no drive to boot from.",
  },
  {
    partId: "cpuFan",
    symptom:
      "The PC starts, then shuts down by itself after a few seconds. A \"CPU fan error\" message appears.",
    distractors: ["cooler", "caseFan", "eps8"],
    explanation:
      "When the CPU_FAN header is not connected, the board cannot read the cooler's fan speed and shuts down to protect the CPU from overheating.",
  },
  {
    partId: "atx24",
    symptom:
      "Nothing happens at all. No fans, no lights, and no standby LED on the motherboard, even though the PSU switch is on.",
    distractors: ["powerSW", "eps8", "psu"],
    explanation:
      "The 24-pin ATX connector carries the main power and the standby power from the PSU to the motherboard. Without it the board has no power at all.",
  },
  {
    partId: "eps8",
    symptom:
      "The system will not start up. The main 24-pin cable is already connected, but the CPU receives no power and nothing appears on the display.",
    distractors: ["atx24", "gpuPower", "cpuFan"],
    explanation:
      "The 8-pin CPU/EPS connector gives dedicated power to the CPU. If it is unplugged, the processor cannot run even when the motherboard has power.",
  },
  {
    partId: "gpuPower",
    symptom:
      "The PC powers on and the case fans spin, but the graphics card's fans stay still and there is no display from the graphics card.",
    distractors: ["gpu", "ram", "eps8"],
    explanation:
      "A graphics card that needs extra power will not work if its PCIe power cable is unplugged, even though the card sits in the slot.",
  },
  {
    partId: "sataData",
    symptom:
      "The hard drive spins up normally, but the BIOS does not detect it, so the files stored on it cannot be reached.",
    distractors: ["sataPower", "hdd", "ssd"],
    explanation:
      "The SATA data cable carries information between the drive and the motherboard. The drive has power, but without the data cable it cannot be detected.",
  },
  {
    partId: "sataPower",
    symptom:
      "The hard drive does not spin up at all. There is no sound, no activity light, and the BIOS does not detect it.",
    distractors: ["sataData", "hdd", "psu"],
    explanation:
      "The SATA power cable supplies power from the PSU to the drive. Without it the drive stays completely off.",
  },
  {
    partId: "caseFan",
    symptom:
      "The PC works normally, but the case fan is not spinning and the inside of the case keeps getting hotter.",
    distractors: ["cpuFan", "fan", "psu"],
    explanation:
      "The case fan connector powers the case fan from the motherboard header. If it is unplugged, the fan stops and airflow inside the case drops.",
  },
  {
    partId: "powerSW",
    symptom:
      "The motherboard standby LED is on, but pressing the case power button does nothing.",
    distractors: ["atx24", "psu", "eps8"],
    explanation:
      "The Power SW header links the case power button to the motherboard. Standby power is present, but the board never receives the \"start\" signal.",
  },
];

const pickFault = (excludePartId = null) => {
  const pool = FAULTS.filter((f) => f.partId !== excludePartId);
  return pool[Math.floor(Math.random() * pool.length)];
};

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function KeyboardCameraControls({ dragging }) {
  const { camera } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (dragging) return;

    const keys = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };

    const handleKeyDown = (event) => {
      if (event.key in keys) {
        keys[event.key] = true;
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      if (event.key in keys) {
        keys[event.key] = false;
      }
    };

    const move = () => {
      const speed = 0.12;
      const movement = new THREE.Vector3();

      // ↑ TOP
      if (keys.ArrowUp) {
        movement.z -= speed;
      }

      // ↓ BOTTOM
      if (keys.ArrowDown) {
        movement.z += speed;
      }

      // ← LEFT
      if (keys.ArrowLeft) {
        movement.x -= speed;
      }

      // → RIGHT
      if (keys.ArrowRight) {
        movement.x += speed;
      }

      camera.position.add(movement);

      if (controlsRef.current) {
        controlsRef.current.target.add(movement);
        controlsRef.current.update();
      }

      requestAnimationFrame(move);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const animation = requestAnimationFrame(move);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animation);
    };
  }, [camera, dragging]);

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={!dragging}
      enableRotate
      rotateSpeed={0.35}
      enablePan
      panSpeed={1.5}
      screenSpacePanning={true}
      enableZoom
      zoomSpeed={1}
      minDistance={1.5}
      maxDistance={30}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI - 0.15}
      target={[0.2, 2.5, 0]}
    />
  );
}
/* =========================================================
   MAIN APP
========================================================= */


function PCAssemblyLab({ mode, onFinish }) {
  const [fault, setFault] = useState(() =>
    mode === "diagnose" ? pickFault() : null
  );

  const [installed, setInstalled] = useState(() => {
    if (mode === "disassemble") {
      return PARTS.map((p) => p.id);
    }

    if (mode === "diagnose" && fault) {
      return PARTS.map((p) => p.id).filter(
        (id) => id !== fault.partId
      );
    }

    return [];
  });

  const [powered, setPowered] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [diagnosed, setDiagnosed] = useState(false);
  const [symptomShown, setSymptomShown] = useState(false);
  const [symptomAtSeconds, setSymptomAtSeconds] = useState(0);
  const [diagnoseSeconds, setDiagnoseSeconds] = useState(0);
  const [wrongOptions, setWrongOptions] = useState([]);
  const [panelClosed, setPanelClosed] = useState(true);
  const [hoveredPart, setHoveredPart] = useState(null);
  const [dragging, setDragging] = useState(false);

  const diagnosisOptions = useMemo(
    () =>
      fault
        ? shuffle([fault.partId, ...fault.distractors])
        : [],
    [fault]
  );

  // Timer
  const goalMet =
    mode === "disassemble"
      ? installed.length === 0
      : mode === "diagnose"
      ? installed.length === PARTS.length && powered
      : installed.length === PARTS.length;

  useEffect(() => {
    if (goalMet) return undefined;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [goalMet]);

  // Open the case after a correct diagnosis.
  useEffect(() => {
    if (mode === "diagnose" && diagnosed) {
      setPanelClosed(false);
    }
  }, [mode, diagnosed]);

  // Close the case after the missing part is restored.
  useEffect(() => {
    if (
      mode === "diagnose" &&
      diagnosed &&
      installed.length === PARTS.length
    ) {
      setPanelClosed(true);
    }
  }, [mode, diagnosed, installed.length]);

  // Start another fault-diagnosis task.
  const startNewFault = () => {
    const next = pickFault(fault ? fault.partId : null);

    setFault(next);
    setInstalled(
      PARTS.map((p) => p.id).filter(
        (id) => id !== next.partId
      )
    );
    setPowered(false);
    setSeconds(0);
    setSymptomShown(false);
    setSymptomAtSeconds(0);
    setDiagnosed(false);
    setDiagnoseSeconds(0);
    setWrongOptions([]);
    setPanelClosed(true);
    setHoveredPart(null);
  };

  // Check the selected fault.
  const handleDiagnose = (partId) => {
    if (!fault || diagnosed) return;

    if (partId === fault.partId) {
      setDiagnosed(true);
      setDiagnoseSeconds(
        Math.max(0, seconds - symptomAtSeconds)
      );
    } else {
      setWrongOptions((prev) =>
        prev.includes(partId)
          ? prev
          : [...prev, partId]
      );
    }
  };

  // Install a component after it snaps to its target.
  const installPart = (partId) => {
    const reason = getInstallBlockReason(
      partId,
      installed
    );

    if (reason) {
      window.alert(reason);
      return;
    }

    setInstalled((prev) =>
      prev.includes(partId) ? prev : [...prev, partId]
    );

    setPowered(false);
  };

  // Reset the current activity.
  const resetAssembly = () => {
    if (mode === "diagnose") {
      startNewFault();
      return;
    }

    setInstalled(
      mode === "disassemble"
        ? PARTS.map((p) => p.id)
        : []
    );
    setPowered(false);
    setSeconds(0);
    setHoveredPart(null);
  };

  // Power-on validation.
  const checkPower = () => {
    if (mode === "diagnose") {
      if (installed.length === PARTS.length) {
        setPowered(true);
      } else {
        setPowered(false);

        if (!symptomShown) {
          setSymptomShown(true);
          setSymptomAtSeconds(seconds);
        }
      }

      return;
    }

    if (goalMet) {
      setPowered(true);
    } else {
      setPowered(false);

      window.alert(
        mode === "disassemble"
          ? "Remove all components before finishing."
          : `Install all ${PARTS.length} components before powering on.`
      );
    }
  };

  // Remove a component.
  const removePart = (id) => {
    setInstalled((prev) =>
      prev.filter((partId) => partId !== id)
    );
    setPowered(false);
  };

  // Information passed to the diagnosis sidebar.
  const diagnosis =
    mode === "diagnose" && fault
      ? {
          symptom: fault.symptom,
          explanation: fault.explanation,
          faultPartId: fault.partId,
          symptomShown,
          diagnosed,
          options: diagnosisOptions,
          wrongOptions,
          onDiagnose: handleDiagnose,
          repaired: installed.length === PARTS.length,
          goalMet,
          totalSeconds: seconds,
          diagnoseSeconds,
          onFinish,
        }
      : null;

  return (
    <div className="app">
      <Sidebar
        installed={installed}
        seconds={seconds}
        powered={powered}
        onPower={checkPower}
        onReset={resetAssembly}
        hoveredPart={hoveredPart}
        mode={mode}
        onRemovePart={removePart}
        goalMet={goalMet}
        onFinish={onFinish}
        diagnosis={diagnosis}
      />

      <main className="scene">
        <Canvas
          shadows
          camera={{
            position: [0, 5.5, 14],
            fov: 50,
          }}
          dpr={[1, 2]}
        >
          <color
            attach="background"
            args={["#05080d"]}
          />

          <fog
            attach="fog"
            args={["#05080d", 16, 34]}
          />

          <ambientLight intensity={1.5} />

          <directionalLight
            position={[4, 11, 8]}
            intensity={3.4}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />

          <pointLight
            position={[-4, 5, 4]}
            intensity={1.8}
            distance={16}
          />

          <pointLight
            position={[6, 5, -4]}
            intensity={1.5}
            distance={14}
          />

          <Environment preset="city" />

          <HangingCeilingLight />
          <Workbench />

          <ComputerCase
            installed={installed}
            powered={powered}
            mode={mode}
            onRemovePart={removePart}
            allInstalled={installed.length === PARTS.length}
            onPower={checkPower}
          />

          <BackIOPlate />
          <Peripherals powered={powered} />
          <PeripheralCablesWorld powered={powered} />

          {PARTS.filter(
            (part) =>
              !(
                mode === "diagnose" &&
                !diagnosed &&
                fault &&
                part.id === fault.partId
              )
          ).map((part) => (
            <DraggablePart
              key={part.id}
              part={part}
              installed={installed.includes(part.id)}
              onSnap={installPart}
              setDragging={setDragging}
              onHover={setHoveredPart}
            />
          ))}

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.45}
            scale={17}
            blur={2.5}
            far={12}
          />

          <KeyboardCameraControls dragging={dragging} />
        </Canvas>
      </main>
    </div>
  );
}


/* =========================================================
   QUESTION BANKS
========================================================= */

const ASSEMBLY_QUESTIONS = [
  {
    q: "What is the main function of the motherboard?",
    options: [
      "Store files permanently",
      "Connect and allow communication between computer components",
      "Provide electrical power to the computer",
      "Display images on the monitor",
    ],
    answer: 1,
  },
  {
    q: "Which component is responsible for supplying power to the computer components?",
    options: ["RAM", "CPU", "Power Supply Unit (PSU)", "SSD"],
    answer: 2,
  },
  {
    q: "Where is the processor (CPU) installed?",
    options: ["RAM slot", "CPU socket", "PCIe slot", "SATA port"],
    answer: 1,
  },
  {
    q: "What is the primary function of RAM?",
    options: [
      "Temporary storage for data and programs currently being used",
      "Permanent storage of files",
      "Supply electricity",
      "Cool the processor",
    ],
    answer: 0,
  },
  {
    q: "Which component is commonly used for permanent storage?",
    options: ["RAM", "CPU", "SSD", "Heatsink"],
    answer: 2,
  },
];

const ASSEMBLY_POST_QUESTIONS = [
  {
    q: "Which component was installed into the CPU socket on the motherboard?",
    options: ["RAM", "CPU", "GPU", "SSD"],
    answer: 1,
  },
  {
    q: "What is the purpose of RAM in a computer?",
    options: [
      "Permanent file storage",
      "Temporary storage for actively used data",
      "Power distribution",
      "Cooling the motherboard",
    ],
    answer: 1,
  },
  {
    q: "Which component supplies electrical power to the computer?",
    options: ["PSU", "CPU", "GPU", "SSD"],
    answer: 0,
  },
  {
    q: "Where is RAM normally installed?",
    options: ["SATA port", "RAM/DIMM slot", "CPU socket", "PCIe power connector"],
    answer: 1,
  },
  {
    q: "What is the purpose of thermal paste?",
    options: [
      "Improve heat transfer from the CPU to the cooler",
      "Connect the GPU to the PSU",
      "Store computer files",
      "Secure the motherboard",
    ],
    answer: 0,
  },
  {
    q: "Which component is commonly installed into a PCIe slot for dedicated graphics?",
    options: ["SSD", "GPU", "RAM", "PSU"],
    answer: 1,
  },
  {
    q: "Why must power cables be connected correctly during assembly?",
    options: [
      "To provide power to the appropriate components",
      "To increase internet speed",
      "To increase storage capacity",
      "To change the screen resolution",
    ],
    answer: 0,
  },
  {
    q: "Which component is primarily responsible for processing instructions?",
    options: ["CPU", "PSU", "Case", "SSD"],
    answer: 0,
  },
  {
    q: "What is one important safety practice when assembling a computer?",
    options: [
      "Work with the system powered off and handle components carefully",
      "Touch electronic contacts unnecessarily",
      "Force components into slots",
      "Connect random cables",
    ],
    answer: 0,
  },
  {
    q: "What is the main purpose of the motherboard?",
    options: [
      "Store all files permanently",
      "Connect and allow communication between computer components",
      "Provide cooling only",
      "Display images",
    ],
    answer: 1,
  },
];

const DISASSEMBLY_QUESTIONS = [
  {
    q: "What should be done before starting computer disassembly?",
    options: [
      "Turn on the computer",
      "Shut down and disconnect the computer from the power source",
      "Remove the CPU immediately",
      "Disconnect the monitor only",
    ],
    answer: 1,
  },
  {
    q: "Why should the power cable be disconnected before disassembly?",
    options: [
      "To prevent electrical hazards",
      "To increase computer speed",
      "To protect the monitor",
      "To improve internet connection",
    ],
    answer: 0,
  },
  {
    q: "Which component should be handled carefully because of its electronic circuitry?",
    options: ["Motherboard", "Computer desk", "Monitor stand", "Mouse pad"],
    answer: 0,
  },
  {
    q: "What should you do before removing a component connected by a cable?",
    options: [
      "Forcefully pull the component",
      "Disconnect the appropriate cable carefully",
      "Turn on the computer",
      "Remove the motherboard first",
    ],
    answer: 1,
  },
  {
    q: "What is the purpose of organizing screws during disassembly?",
    options: [
      "To make reassembly easier and prevent losing parts",
      "To increase computer performance",
      "To cool the computer",
      "To increase storage",
    ],
    answer: 0,
  },
];

const DISASSEMBLY_POST_QUESTIONS = [
  {
    q: "What should be done first before physically disassembling the computer?",
    options: [
      "Disconnect the computer from the power source",
      "Remove the CPU",
      "Remove the RAM",
      "Remove the motherboard",
    ],
    answer: 0,
  },
  {
    q: "Why should cables be disconnected carefully?",
    options: [
      "To prevent damage to the cables and connectors",
      "To increase storage",
      "To improve graphics",
      "To increase CPU speed",
    ],
    answer: 0,
  },
  {
    q: "What component is removed from the DIMM slot during disassembly?",
    options: ["RAM", "CPU", "PSU", "SSD"],
    answer: 0,
  },
  {
    q: "What is the purpose of organizing removed screws and components?",
    options: [
      "To make reassembly easier and prevent lost parts",
      "To increase computer performance",
      "To improve cooling",
      "To increase storage",
    ],
    answer: 0,
  },
  {
    q: "Why should unnecessary force not be used when removing components?",
    options: [
      "It can damage the component or connector",
      "It increases internet speed",
      "It reduces storage",
      "It changes the operating system",
    ],
    answer: 0,
  },
  {
    q: "Which component contains the CPU socket, RAM slots, and expansion slots?",
    options: ["Motherboard", "PSU", "SSD", "Computer case"],
    answer: 0,
  },
  {
    q: "What is the purpose of disconnecting power before disassembly?",
    options: [
      "To reduce electrical hazards and protect components",
      "To increase the CPU speed",
      "To improve display quality",
      "To increase storage",
    ],
    answer: 0,
  },
  {
    q: "Which component is designed to provide electrical power to the other computer components?",
    options: ["PSU", "RAM", "CPU", "GPU"],
    answer: 0,
  },
  {
    q: "What can electrostatic discharge potentially do to computer components?",
    options: [
      "Damage sensitive electronic components",
      "Increase storage capacity",
      "Improve performance",
      "Increase internet speed",
    ],
    answer: 0,
  },
  {
    q: "Why is following the correct disassembly procedure important?",
    options: [
      "It helps remove components safely and reduces the risk of damage",
      "It makes the computer faster",
      "It automatically installs Windows",
      "It increases RAM capacity",
    ],
    answer: 0,
  },
];

const FAULT_QUESTIONS = [
  {
    q: "What is the first step when a customer reports that their computer has a problem?",
    options: [
      "Replace the parts right away",
      "Ask questions and observe the symptoms to identify the problem",
      "Reinstall the operating system",
      "Buy a new computer",
    ],
    answer: 1,
  },
  {
    q: "A PC powers on but shows no display and the motherboard beeps repeatedly. What is the most likely cause?",
    options: [
      "A disconnected mouse",
      "A weak Wi-Fi signal",
      "RAM that is missing or not seated properly",
      "A full hard drive",
    ],
    answer: 2,
  },
  {
    q: "What does POST stand for?",
    options: [
      "Power-On Self-Test",
      "Primary Operating System Task",
      "Processor Output Status Test",
      "Power Output Safety Test",
    ],
    answer: 0,
  },
  {
    q: "Which cable supplies the main power from the PSU to the motherboard?",
    options: [
      "SATA data cable",
      "HDMI cable",
      "CPU fan cable",
      "24-pin ATX power connector",
    ],
    answer: 3,
  },
  {
    q: "What should you do before opening a computer case to inspect the parts inside?",
    options: [
      "Turn the PC on to see the parts working",
      "Shut it down and disconnect it from the power source",
      "Remove the CPU",
      "Disconnect the monitor only",
    ],
    answer: 1,
  },
];

const FAULT_POST_QUESTIONS = [
  {
    q: "Which is the best first step when a customer says their PC will not boot?",
    options: [
      "Replace the motherboard",
      "Reinstall the operating system",
      "Ask questions and observe the symptoms to identify the problem",
      "Replace the power supply",
    ],
    answer: 2,
  },
  {
    q: "The fans spin, but there is no display and the board beeps repeatedly. Which component should be checked first?",
    options: [
      "RAM",
      "Speakers",
      "Mouse",
      "Case fan connector",
    ],
    answer: 0,
  },
  {
    q: "The hard drive spins normally but is not detected by the BIOS. Which cable is the most likely cause?",
    options: [
      "SATA power cable",
      "SATA data cable",
      "24-pin ATX cable",
      "GPU power cable",
    ],
    answer: 1,
  },
  {
    q: "A hard drive makes no sound, does not spin, and is not detected. Which cable should be checked?",
    options: [
      "SATA data cable",
      "HDMI cable",
      "CPU_FAN cable",
      "SATA power cable",
    ],
    answer: 3,
  },
  {
    q: "The system starts, then shuts down after a few seconds with a CPU fan error. What is the most likely cause?",
    options: [
      "The keyboard is disconnected",
      "The monitor cable is loose",
      "The CPU_FAN connector is not plugged in",
      "The SSD is full",
    ],
    answer: 2,
  },
  {
    q: "There are no lights, no fans, and no standby LED on the motherboard, even though the PSU is switched on. Which connector should be checked?",
    options: [
      "Case fan connector",
      "24-pin ATX power connector",
      "SATA data cable",
      "Audio jack",
    ],
    answer: 1,
  },
  {
    q: "Pressing the case power button does nothing, but the motherboard standby LED is on. What is the most likely cause?",
    options: [
      "The RAM is missing",
      "The SATA data cable is loose",
      "The Power SW header is not connected",
      "The CPU cooler is not installed",
    ],
    answer: 2,
  },
  {
    q: "Why is the 8-pin CPU/EPS connector important?",
    options: [
      "It supplies dedicated power to the CPU",
      "It carries data to the hard drive",
      "It powers the case fan",
      "It connects the monitor",
    ],
    answer: 0,
  },
  {
    q: "Why should you power off and unplug a PC before inspecting or reseating parts?",
    options: [
      "To make the PC faster",
      "To prevent electric shock and damage to components",
      "To clear the browser history",
      "To increase the RAM capacity",
    ],
    answer: 1,
  },
  {
    q: "After fixing a fault, what should you do to confirm the repair?",
    options: [
      "Close the case and return it without testing",
      "Replace all the other parts",
      "Reinstall the operating system",
      "Power on the system and check that the problem is gone",
    ],
    answer: 3,
  },
];

const MODE_CONFIG = {
  assemble: {
    label: "Assembly",
    pre: ASSEMBLY_QUESTIONS,
    post: ASSEMBLY_POST_QUESTIONS,
  },
  disassemble: {
    label: "Disassembly",
    pre: DISASSEMBLY_QUESTIONS,
    post: DISASSEMBLY_POST_QUESTIONS,
  },
  diagnose: {
    label: "Fault Diagnosis",
    pre: FAULT_QUESTIONS,
    post: FAULT_POST_QUESTIONS,
  },
};

/* =========================================================
   SELECTION HOME SCREEN
========================================================= */

function SimulatorHome({ onSelectMode }) {
  return (
    <div className="flow-screen">
      <div className="flow-header">
        <span className="brand-icon">🖥️</span>
        <h1>PC Assembly Lab</h1>
        <p>Choose the simulation you want to practice.</p>
      </div>

      <div className="flow-choices">
        <button className="flow-card" onClick={() => onSelectMode("assemble")}>
          <span className="flow-card-icon">🔧</span>
          <strong>Computer Assembly</strong>
          <span>Build a PC from scratch, part by part.</span>
        </button>

                <button className="flow-card" onClick={() => onSelectMode("disassemble")}>
          <span className="flow-card-icon">🧰</span>
          <strong>Computer Disassembly</strong>
          <span>Start with a complete PC and safely remove each part.</span>
        </button>

        <button className="flow-card" onClick={() => onSelectMode("diagnose")}>
          <span className="flow-card-icon">🩺</span>
          <strong>Fault Diagnosis</strong>
          <span>A built PC has a problem. Find the cause and fix it.</span>
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   QUIZ SCREEN (shared by pre-test and post-test)
========================================================= */

function QuizScreen({ title, questions, onComplete }) {
  const [answers, setAnswers] = useState(Array(questions.length).fill(null));

  const selectAnswer = (qIndex, optIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optIndex;
      return next;
    });
  };

  const allAnswered = answers.every((a) => a !== null);

  const submit = () => {
    const score = answers.reduce(
      (total, ans, i) => total + (ans === questions[i].answer ? 1 : 0),
      0
    );
    onComplete({ answers, score, total: questions.length });
  };

  return (
    <div className="flow-screen">
      <div className="flow-header">
        <h1>{title}</h1>
        <p>Answer all {questions.length} questions, then submit.</p>
      </div>

      <div className="quiz-list">
        {questions.map((item, qIndex) => (
          <div className="quiz-question" key={qIndex}>
            <p className="quiz-q-text">
              {qIndex + 1}. {item.q}
            </p>
            <div className="quiz-options">
              {item.options.map((opt, optIndex) => (
                <label
                  key={optIndex}
                  className={`quiz-option ${
                    answers[qIndex] === optIndex ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${qIndex}`}
                    checked={answers[qIndex] === optIndex}
                    onChange={() => selectAnswer(qIndex, optIndex)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        className="power-button flow-submit-btn"
        disabled={!allAnswered}
        onClick={submit}
      >
        Submit
      </button>
    </div>
  );
}

/* =========================================================
   PRE-TEST RESULT SCREEN (score only, no answer review)
========================================================= */

function PreTestResultScreen({ title, result, continueLabel, onContinue }) {
  const incorrect = result.total - result.score;

  return (
    <div className="flow-screen">
      <div className="flow-header">
        <h1>{title}</h1>
      </div>

      <div className="score-card">
        <div className="score-big">
          {result.score}/{result.total}
        </div>
        <div className="score-breakdown">
          <span className="score-correct">✅ Correct: {result.score}</span>
          <span className="score-incorrect">❌ Incorrect: {incorrect}</span>
        </div>
      </div>

      <button className="power-button flow-submit-btn" onClick={onContinue}>
        {continueLabel}
      </button>
    </div>
  );
}

/* =========================================================
   POST-TEST RESULT SCREEN (score + full answer review)
========================================================= */

function PostTestResultScreen({ title, result, questions, onContinue }) {
  const incorrect = result.total - result.score;

  return (
    <div className="flow-screen">
      <div className="flow-header">
        <h1>{title}</h1>
      </div>

      <div className="score-card">
        <div className="score-big">
          {result.score}/{result.total}
        </div>
        <div className="score-breakdown">
          <span className="score-correct">✅ Correct: {result.score}</span>
          <span className="score-incorrect">❌ Incorrect: {incorrect}</span>
        </div>
      </div>

      <div className="quiz-list">
        {questions.map((item, qIndex) => {
          const userAnswer = result.answers[qIndex];
          const correct = userAnswer === item.answer;
          return (
            <div className="quiz-question" key={qIndex}>
              <p className="quiz-q-text">
                {qIndex + 1}. {item.q} {correct ? "✅" : "❌"}
              </p>
              <p className="quiz-answer-line">
                Your answer: {item.options[userAnswer]}
              </p>
              {!correct && (
                <p className="quiz-answer-line correct">
                  Correct answer: {item.options[item.answer]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button className="power-button flow-submit-btn" onClick={onContinue}>
        Exit Simulation
      </button>
    </div>
  );
}

/* =========================================================
   TOP-LEVEL APP — controls the entire flow
========================================================= */

export default function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);
  const [preTestResult, setPreTestResult] = useState(null);
  const [postTestResult, setPostTestResult] = useState(null);

  const config = mode ? MODE_CONFIG[mode] : null;

  const handleSelectMode = (selected) => {
    setMode(selected);
    setScreen("pretest");
  };

  const handlePreTestComplete = (result) => {
    setPreTestResult(result);
    setScreen("pretest-result");
  };

  const handlePostTestComplete = (result) => {
    setPostTestResult(result);
    setScreen("posttest-result");
  };

  const backToHome = () => {
    setMode(null);
    setPreTestResult(null);
    setPostTestResult(null);
    setScreen("home");
  };

  if (screen === "home" || !config) {
    return <SimulatorHome onSelectMode={handleSelectMode} />;
  }

  if (screen === "pretest") {
    return (
      <QuizScreen
        title={`${config.label} Pre-Test`}
        questions={config.pre}
        onComplete={handlePreTestComplete}
      />
    );
  }

  if (screen === "pretest-result") {
    return (
      <PreTestResultScreen
        title={`${config.label} Pre-Test Result`}
        result={preTestResult}
        continueLabel={`Start ${config.label} Simulation →`}
        onContinue={() => setScreen("simulation")}
      />
    );
  }

  if (screen === "simulation") {
    return (
      <PCAssemblyLab
        mode={mode}
        onFinish={() => setScreen("posttest")}
      />
    );
  }

  if (screen === "posttest") {
    return (
      <QuizScreen
        title={`${config.label} Post-Test`}
        questions={config.post}
        onComplete={handlePostTestComplete}
      />
    );
  }

  if (screen === "posttest-result") {
    return (
      <PostTestResultScreen
        title={`${config.label} Post-Test Result`}
        result={postTestResult}
        questions={config.post}
        onContinue={backToHome}
      />
    );
  }

  return null;
}

/* =========================================================
   SIDEBAR
========================================================= */

function DiagnosisPanel({
  symptom,
  explanation,
  faultPartId,
  symptomShown,
  diagnosed,
  options,
  wrongOptions,
  onDiagnose,
  repaired,
  goalMet,
  totalSeconds,
  diagnoseSeconds,
  onFinish,
}) {
  const fmt = (value) => {
    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, "0");
    const secs = (value % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const nameOf = (id) => PARTS.find((p) => p.id === id)?.name || id;

  if (goalMet) {
    return (
      <div className="diagnosis-panel">
        <div className="diagnosis-good">
          <strong>Fault fixed! The PC boots normally.</strong>
          <ul className="diagnosis-stats">
            <li>🔍 Time to diagnose: {fmt(diagnoseSeconds)}</li>
            <li>❌ Wrong guesses: {wrongOptions.length}</li>
            <li>🛠️ Total repair time: {fmt(totalSeconds)}</li>
          </ul>
          <button
            className="power-button"
            style={{ marginTop: 6 }}
            onClick={onFinish}
          >
            Continue to Post-Test →
          </button>
        </div>
        <p className="diagnosis-note">
          Want more practice? Press NEW FAULT below for a different problem.
        </p>
      </div>
    );
  }

  if (repaired) {
    return (
      <div className="diagnosis-panel">
        <p className="diagnosis-step">Step 4 · Retest</p>
        <p>
          The part is back in place and the case is closed. Press the power
          button on the front of the case to test the PC again.
        </p>
      </div>
    );
  }

  if (diagnosed) {
    return (
      <div className="diagnosis-panel">
        <p className="diagnosis-step">Step 3 · Repair</p>
        <div className="diagnosis-good">
          <strong>Correct! It was the {nameOf(faultPartId)}.</strong>
          <p style={{ margin: "6px 0 0" }}>{explanation}</p>
        </div>
        <p>
          The case is now open and the part is on the table. Drag it into its
          socket to fix the PC.
        </p>
      </div>
    );
  }

  if (symptomShown) {
    return (
      <div className="diagnosis-panel">
        <p className="diagnosis-step">Step 2 · Diagnose</p>
        <p className="diagnosis-symptom">{symptom}</p>
        <p className="diagnosis-question">
          Which component is the most likely cause?
        </p>
        {options.map((id) => {
          const wrong = wrongOptions.includes(id);
          return (
            <button
              key={id}
              className={`diagnosis-option ${wrong ? "wrong" : ""}`}
              disabled={wrong}
              onClick={() => onDiagnose(id)}
            >
              {nameOf(id)}
              {wrong ? "  ✗" : ""}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="diagnosis-panel">
      <p className="diagnosis-step">Step 1 · Test the PC</p>
      <p>
        A customer brought in this computer because something is wrong with
        it. Press the power button on the front of the case to see what
        happens.
      </p>
      <p className="diagnosis-note">
        Tip: you can click the front panel to open the case and look inside.
      </p>
    </div>
  );
}


function Sidebar({
  installed,
  seconds,
  powered,
  onPower,
  onReset,
  hoveredPart,
  mode,
  onRemovePart,
  goalMet,
  onFinish,
  diagnosis, // ADD THIS
}) {
  
  const formatTime = () => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");

    const secs = (seconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${secs}`;
  };

  return (
    <aside className={`sidebar ${mode === "diagnose" ? "diagnose-mode" : ""}`}>

      <div className="brand">

        <span className="brand-icon">
          🖥️
        </span>

        <div>
          <h1>PC Assembly Lab</h1>
          <p>Interactive 3D Assembly</p>
        </div>

      </div>

      <div className="stats">

        <div className="stat">
          <span>⏱️ Time</span>

          <strong>
            {formatTime()}
          </strong>
        </div>

                <div className="stat">
          <span>
            {mode === "diagnose" ? "❌ Wrong Guesses" : "🔧 Parts Installed"}
          </span>

          <strong>
            {mode === "diagnose"
              ? diagnosis
                ? diagnosis.wrongOptions.length
                : 0
              : `${installed.length}/${PARTS.length}`}
          </strong>
        </div>

      </div>

      <div className="progress">

        <div
          className="progress-bar"
          style={{
            width: `${
              (installed.length / PARTS.length) * 100
            }%`,
          }}
        />

      </div>

      <div className="component-list">

        <h3>Components</h3>

        {PARTS.map((part) => (
  <div
    className={`component ${
      installed.includes(part.id)
        ? "installed"
        : ""
    }`}
    key={part.id}
    onClick={() => {
      if (mode === "disassemble" && installed.includes(part.id)) {
        onRemovePart(part.id);
      }
    }}
    style={{
      cursor:
        mode === "disassemble" && installed.includes(part.id)
          ? "pointer"
          : "default",
    }}
  >

    <span>
      {installed.includes(part.id)
        ? "✓"
        : "○"}
    </span>

    <span>
      {part.name}
    </span>

  </div>
))}

      </div>
      {diagnosis && <DiagnosisPanel {...diagnosis} />}
      <div className="controls">

  <button
    className="reset-button"
    onClick={onReset}
  >
    {mode === "disassemble"
  ? "↻ RESTART DISASSEMBLY"
  : mode === "diagnose"
  ? "↻ NEW FAULT"
  : "↻ RESET ASSEMBLY"}
  </button>

</div>

      {goalMet && mode !== "diagnose" && (
  <div className="success">
    <strong>
      {mode === "disassemble" ? "Disassembly Complete!" : "Assembly Complete!"}
    </strong>
    <span>
      {mode === "disassemble" ? "All components have been removed." : "All components are installed."}
    </span>
    <button
      className="power-button"
      style={{ marginTop: 10 }}
      onClick={onFinish}
    >
      Continue to Post-Test →
    </button>
  </div>
)}

      {hoveredPart && (
  <div className="tooltip-box">
    <strong>{PARTS.find(p => p.id === hoveredPart)?.name}</strong>
    <p>{PART_INFO[hoveredPart]}</p>
  </div>
)}

    </aside>
  );
}

function HangingCeilingLight() {
  return (
    <group position={[0, 13.0, 0]}>

      {/* Ceiling mounting plate */}
      <RoundedBox
        args={[1.2, 0.10, 0.55]}
        radius={0.04}
        smoothness={3}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial
          color="#20252b"
          metalness={0.7}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Hanging rods */}
      <mesh position={[-0.38, -0.65, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 12]} />
        <meshStandardMaterial
          color="#343a40"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      <mesh position={[0.38, -0.65, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 12]} />
        <meshStandardMaterial
          color="#343a40"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* Lamp housing */}
      <RoundedBox
        args={[3.4, 0.22, 1.0]}
        radius={0.08}
        smoothness={3}
        position={[0, -1.3, 0]}
      >
        <meshStandardMaterial
          color="#252a30"
          metalness={0.65}
          roughness={0.28}
        />
      </RoundedBox>

      {/* Glowing light panel */}
      <RoundedBox
        args={[2.9, 0.035, 0.72]}
        radius={0.04}
        smoothness={3}
        position={[0, -1.43, 0]}
      >
        <meshStandardMaterial
          color="#fffdf2"
          emissive="#fffdf2"
          emissiveIntensity={2.5}
          roughness={0.15}
        />
      </RoundedBox>

      {/* Light illuminating the workbench */}
      <pointLight
        position={[0, -1.5, 0]}
        intensity={12}
        distance={12}
        decay={2}
        castShadow
      />

    </group>
  );
}

/* =========================================================
   WORKBENCH
========================================================= */

function Workbench() {
  return (
    <group>

      <mesh
        position={[0, -0.12, 0]}
        receiveShadow
      >

        <boxGeometry
          args={[18, 0.25, 9.0]}
        />

        <meshStandardMaterial
          color="#15171b"
          metalness={0.35}
          roughness={0.3}
        />

      </mesh>

      <mesh
        position={[0, -0.28, 4.15]}
        receiveShadow
      >

        <boxGeometry
          args={[18, 0.35, 0.18]}
        />

        <meshStandardMaterial
          color="#090b0e"
          metalness={0.45}
          roughness={0.25}
        />

      </mesh>

      {[
        [-7.0, -2.2, 3.6],
        [7.0, -2.2, 3.6],
        [-7.0, -2.2, -3.6],
        [7.0, -2.2, -3.6],
      ].map((position, index) => (
        <mesh
          key={index}
          position={position}
        >

          <boxGeometry
            args={[0.35, 4, 0.35]}
          />

          <meshStandardMaterial
            color="#0a0c0f"
          />

        </mesh>
      ))}

      <Text
        position={[-4.2, 0.02, 3.35]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.16}
        color="#6c7c8c"
        anchorX="center"
      >
      </Text>

    </group>
  );
}

/* =========================================================
   COMPUTER CASE
========================================================= */

function ComputerCase({
  installed,
  powered,
  mode,
  onRemovePart,
  allInstalled,
  onPower,
}) {
  return (
    <group
      position={[
        CASE.x,
        CASE.y,
        CASE.z,
      ]}
    >

      <CaseFrame />
      <CasePorts />
      {allInstalled && <FrontPanel onPower={onPower} powered={powered} />}
      <Motherboard />
      <GPUSlots />
      <PSUMount />
      <HDDCage />
      <CaseFans installed={installed} />
      <InstalledComponents
        installed={installed}
        mode={mode}
        onRemovePart={onRemovePart}
      />

    </group>
  );
}

/* =========================================================
   CASE FRAME
========================================================= */

function CaseFrame() {
  const W = CASE.width;
  const H = CASE.height;
  const D = CASE.depth;

  const metal = "#252b31";

  return (
    <group>

      {/* BACK */}

      <mesh
        position={[0, H / 2, -D / 2]}
        castShadow
      >

        <boxGeometry
          args={[W, H, 0.12]}
        />

        <meshStandardMaterial
          color="#101419"
          metalness={0.8}
          roughness={0.25}
        />

      </mesh>

      {/* TOP */}

      <RoundedBox
        args={[W, 0.16, D]}
        position={[0, H + 0.02, 0]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color={metal}
          metalness={0.85}
          roughness={0.22}
        />

      </RoundedBox>

      {/* BOTTOM */}

      <RoundedBox
        args={[W, 0.16, D]}
        position={[0, 0, 0]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color={metal}
          metalness={0.85}
          roughness={0.22}
        />

      </RoundedBox>

      {/* LEFT SIDE */}

      <RoundedBox
        args={[0.16, H, D]}
        position={[-W / 2, H / 2, 0]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color={metal}
          metalness={0.85}
          roughness={0.22}
        />

      </RoundedBox>

      {/* RIGHT SIDE */}

      <RoundedBox
        args={[0.16, H, D]}
        position={[W / 2, H / 2, 0]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color={metal}
          metalness={0.85}
          roughness={0.22}
        />

      </RoundedBox>

      {/* FRONT POSTS */}

      {[
        [-W / 2, H / 2, D / 2],
        [W / 2, H / 2, D / 2],
      ].map((position, index) => (
        <RoundedBox
          key={index}
          args={[0.16, H, 0.16]}
          position={position}
          radius={0.04}
          smoothness={3}
        >

          <meshStandardMaterial
            color="#1c2126"
            metalness={0.9}
            roughness={0.2}
          />

        </RoundedBox>
      ))}

      <Text
        position={[0, H + 0.18, 0]}
        fontSize={0.18}
        color="#c4cbd0"
        anchorX="center"
      >
        PC CASE
      </Text>

    </group>
  );
}

function FrontPanel({ onPower, powered }) {
  const W = CASE.width;
  const H = CASE.height;

  return (
    <group position={[0, H / 2, CASE.depth / 2]}>

      {/* Solid front cover plate */}
      <RoundedBox args={[W, H, 0.10]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#20252b" metalness={0.75} roughness={0.25} />
      </RoundedBox>

      {/* Vertical brushed-metal accent strip */}
      <mesh position={[W / 2 - 0.25, 0, 0.052]}>
        <boxGeometry args={[0.08, H - 0.3, 0.01]} />
        <meshStandardMaterial color="#15181c" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Power button, now mounted flush on the finished panel */}
      <group
        position={[W / 2 - 0.25, H * 0.42, 0.06]}
        onClick={(e) => {
          e.stopPropagation();
          onPower();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <RoundedBox args={[0.16, 0.16, 0.05]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#1c2126" metalness={0.7} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 24]} />
          <meshStandardMaterial color="#2a2f34" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.006, 8, 24]} />
          <meshStandardMaterial
            color={powered ? "#4ade80" : "#4387d5"}
            emissive={powered ? "#1fa956" : "#1d4c83"}
            emissiveIntensity={0.6}
          />
        </mesh>
      </group>

      {/* Two front USB ports below the power button */}
      {[0.25, 0.15].map((yOffset, i) => (
        <mesh key={i} position={[W / 2 - 0.25, H * 0.42 - 0.15 - i * 0.09, 0.06]}>
          <boxGeometry args={[0.09, 0.03, 0.02]} />
          <meshStandardMaterial color="#08090a" roughness={0.7} />
        </mesh>
      ))}

      <Text
        position={[0, -H / 2 + 0.15, 0.06]}
        fontSize={0.09}
        color="#5a636b"
        anchorX="center"
      >
        FULLY ASSEMBLED
      </Text>

    </group>
  );
}

/* =========================================================
   MOTHERBOARD
========================================================= */

function Motherboard() {
  const W = BOARD.width;
  const H = BOARD.height;

  return (
    <group
      position={[
        BOARD.x,
        BOARD.y,
        BOARD.z,
      ]}
    >

      <RoundedBox
        args={[W, H, 0.08]}
        radius={0.05}
        smoothness={4}
      >

        <meshStandardMaterial
          color="#123d32"
          metalness={0.2}
          roughness={0.42}
        />

      </RoundedBox>

      {/* MOUNTING HOLES */}

      {[
        [-1.55, 2.25],
        [1.55, 2.25],
        [-1.55, 0],
        [1.55, 0],
        [-1.55, -2.25],
        [1.55, -2.25],
      ].map(([x, y], index) => (
        <mesh
          key={index}
          position={[x, y, 0.065]}
          rotation={[Math.PI / 2, 0, 0]}
        >

          <cylinderGeometry
            args={[0.07, 0.07, 0.03, 16]}
          />

          <meshStandardMaterial
            color="#c7a64b"
            metalness={0.8}
            roughness={0.18}
          />

        </mesh>
      ))}

      <CPUSocket />

      <RAMSlots />

      <M2Slot />

      <PCIeSlots />

      <Chipset />

      <CMOSSocket />

      <ATX24Socket />

      <ConnectionSockets />

      <Text
        position={[0, -2.72, 0.08]}
        fontSize={0.10}
        color="#8cbca9"
        anchorX="center"
      >
      </Text>

    </group>
  );
}

/* =========================================================
   CPU SOCKET
========================================================= */

function CPUSocket() {
  return (
    <group position={[-0.85, 1.35, 0.10]}>

      {/* Recessed CPU receptacle */}
      <RoundedBox
        args={[0.96, 0.96, 0.10]}
        radius={0.035}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#080b0d"
          metalness={0.55}
          roughness={0.32}
        />
      </RoundedBox>

      {/* Contact field: reads as a socket, not a CPU */}
      {[...Array(9)].map((_, row) =>
        [...Array(9)].map((__, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              -0.32 + col * 0.08,
              -0.32 + row * 0.08,
              0.065,
            ]}
          >
            <boxGeometry args={[0.018, 0.018, 0.012]} />
            <meshStandardMaterial
              color="#c4a64b"
              metalness={0.85}
              roughness={0.18}
            />
          </mesh>
        ))
      )}

      <RoundedBox
        args={[0.82, 0.82, 0.035]}
        position={[0, 0, 0.045]}
        radius={0.025}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#15191d"
          metalness={0.35}
          roughness={0.38}
          transparent
          opacity={0.92}
        />
      </RoundedBox>

      <Text
        position={[0, -0.67, 0.07]}
        fontSize={0.075}
        color="#a7b3ba"
        anchorX="center"
      >
        CPU SOCKET
      </Text>

    </group>
  );
}

/* =========================================================
   RAM SLOTS
========================================================= */

function RAMSlots() {
  return (
    <group
      position={[0.45, 1.35, 0.11]}
    >

      {[0, 0.30, 0.60, 0.90].map(
        (x, index) => (
          <group
            key={index}
            position={[x, 0, 0]}
          >

            <mesh>

              <boxGeometry
                args={[0.10, 0.68, 0.055]}
              />

              <meshStandardMaterial
                color="#070a0d"
                metalness={0.5}
                roughness={0.3}
              />

            </mesh>

            {[...Array(10)].map(
              (_, pin) => (
                <mesh
                  key={pin}
                  position={[
                    0,
                    -0.27 + pin * 0.06,
                    0.04,
                  ]}
                >

                  <boxGeometry
                    args={[0.105, 0.018, 0.015]}
                  />

                  <meshStandardMaterial
                    color="#c4a84d"
                    metalness={0.9}
                    roughness={0.12}
                  />

                </mesh>
              )
            )}

            <mesh
              position={[0, 0.37, 0.03]}
            >

              <boxGeometry
                args={[0.14, 0.08, 0.08]}
              />

              <meshStandardMaterial
                color="#d6d8da"
                metalness={0.7}
                roughness={0.2}
              />

            </mesh>

          </group>
        )
      )}

      <Text
        position={[0.45, 0.48, 0.07]}
        fontSize={0.075}
        color="#a7b3ba"
        anchorX="center"
      >
        DDR4 / DDR5
      </Text>

    </group>
  );
}

/* =========================================================
   M.2 SLOT
========================================================= */

function M2Slot() {
  return (
    <group
      position={[0.88, 0.40, 0.11]}
    >

      <mesh>

        <boxGeometry
          args={[0.72, 0.08, 0.045]}
        />

        <meshStandardMaterial
          color="#080b0d"
          metalness={0.5}
          roughness={0.28}
        />

      </mesh>

      {[...Array(12)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.30 + index * 0.055,
              0.045,
              0.025,
            ]}
          >

            <boxGeometry
              args={[0.018, 0.025, 0.012]}
            />

            <meshStandardMaterial
              color="#c7a64b"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

      <mesh
        position={[0.38, 0, 0.04]}
      >

        <cylinderGeometry
          args={[0.04, 0.04, 0.035, 20]}
        />

        <meshStandardMaterial
          color="#c6a54f"
          metalness={0.9}
          roughness={0.15}
        />

      </mesh>

      <Text
        position={[0, 0.22, 0.07]}
        fontSize={0.075}
        color="#a7b3ba"
        anchorX="center"
      >
        M.2 NVMe SOCKET
      </Text>

    </group>
  );
}

/* =========================================================
   PCIe SLOTS
========================================================= */

function PCIeSlots() {
  return (
    <group
      position={[0.02, -0.80, 0.11]}
    >

      {[0, -0.48, -0.96].map(
        (y, index) => (
          <group
            key={index}
            position={[0, y, 0]}
          >

            <mesh>

              <boxGeometry
                args={[2.55, 0.09, 0.06]}
              />

              <meshStandardMaterial
                color="#070a0d"
                metalness={0.5}
                roughness={0.28}
              />

            </mesh>

            {[...Array(22)].map(
              (_, i) => (
                <mesh
                  key={i}
                  position={[
                    -0.98 + i * 0.095,
                    0.05,
                    0,
                  ]}
                >

                  <boxGeometry
                    args={[0.025, 0.028, 0.015]}
                  />

                  <meshStandardMaterial
                    color="#b59b45"
                    metalness={0.85}
                    roughness={0.18}
                  />

                </mesh>
              )
            )}

            {index === 0 && (
              <mesh
                position={[1.29, 0, 0.04]}
              >

                <boxGeometry
                  args={[0.10, 0.18, 0.07]}
                />

                <meshStandardMaterial
                  color="#aeb4b8"
                  metalness={0.75}
                  roughness={0.2}
                />

              </mesh>
            )}

            <Text
              position={[-0.25, 0.16, 0.07]}
              fontSize={0.065}
              color="#7f918c"
              anchorX="center"
            >
              {index === 0
                ? "PCIe x16"
                : "PCIe x4"}
            </Text>

          </group>
        )
      )}

    </group>
  );
}

/* =========================================================
   CHIPSET SOCKET
========================================================= */

function Chipset() {
  return (
    <group position={[-0.70, 0.20, 0.11]}>
      <RoundedBox
        args={[0.72, 0.52, 0.08]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#080b0d"
          metalness={0.5}
          roughness={0.34}
        />
      </RoundedBox>

      {[...Array(6)].map((_, row) =>
        [...Array(8)].map((__, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              -0.26 + col * 0.075,
              -0.18 + row * 0.07,
              0.055,
            ]}
          >
            <boxGeometry args={[0.022, 0.022, 0.012]} />
            <meshStandardMaterial
              color="#b99b43"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        ))
      )}

      <Text
        position={[0, -0.38, 0.06]}
        fontSize={0.065}
        color="#a7b3ba"
        anchorX="center"
      >
        CHIPSET SOCKET
      </Text>
    </group>
  );
}

function SATAPowerSocket({ position }) {
  return (
    <group position={position}>

      {/* SATA POWER SOCKET BODY */}
      <RoundedBox
        args={[0.46, 0.16, 0.14]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#080a0c"
          metalness={0.55}
          roughness={0.30}
        />
      </RoundedBox>

      {/* SATA POWER OPENING - CAMERA SIDE */}
      <mesh position={[0, 0, 0.076]}>
        <boxGeometry
          args={[0.36, 0.085, 0.018]}
        />

        <meshStandardMaterial
          color="#020304"
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>

      {/* 15 POWER CONTACTS */}
      {[...Array(15)].map((_, i) => (
        <mesh
          key={`sata-power-pin-${i}`}
          position={[
            -0.168 + i * 0.024,
            0,
            0.089
          ]}
        >
          <boxGeometry
            args={[0.012, 0.055, 0.006]}
          />

          <meshStandardMaterial
            color="#d6b451"
            metalness={0.95}
            roughness={0.10}
          />
        </mesh>
      ))}

      <Text
        position={[0, 0.14, 0.08]}
        fontSize={0.040}
        color="#a7b3ba"
        anchorX="center"
      >
        SATA POWER
      </Text>

    </group>
  );
}

/* =========================================================
   CMOS SOCKET
========================================================= */

function CMOSSocket() {
  return (
    <group position={[0.00, 0.20, 0.11]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.055, 32]} />
        <meshStandardMaterial
          color="#080b0d"
          metalness={0.45}
          roughness={0.35}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.035]}>
        <cylinderGeometry args={[0.15, 0.15, 0.018, 32]} />
        <meshStandardMaterial
          color="#151a1e"
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, 0, 0.055]}>
        <torusGeometry args={[0.19, 0.018, 8, 24]} />
        <meshStandardMaterial
          color="#bda04b"
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>

      <Text
        position={[0, -0.31, 0.06]}
        fontSize={0.06}
        color="#9da9ae"
        anchorX="center"
      >
        CMOS SOCKET
      </Text>
    </group>
  );
}

/* =========================================================
   24-PIN ATX SOCKET
========================================================= */

function ATX24Socket() {
  return (
    <group
      position={[-1.54, -1.28, 0.16]}
    >

      {[0, 1].map((column) => (
        <group key={column}>

          {[...Array(12)].map(
            (_, row) => (
              <mesh
                key={row}
                position={[
                  column === 0
                    ? -0.055
                    : 0.055,
                  -0.39 +
                    row * 0.071,
                  0.055,
                ]}
              >

                <boxGeometry
                  args={[
                    0.032,
                    0.032,
                    0.015,
                  ]}
                />

                <meshStandardMaterial
                  color="#c9aa50"
                  metalness={0.9}
                  roughness={0.12}
                />

              </mesh>
            )
          )}

        </group>
      ))}

      <Text
        position={[-0.20, 0, 0.07]}
        rotation={[0, 0, Math.PI / 2]}
        fontSize={0.06}
        color="#a0a9ae"
        anchorX="center"
      >
        24-PIN
      </Text>

    </group>
  );
}

/* =========================================================
   POWER / FRONT-PANEL CONNECTION SOCKETS
========================================================= */
/* =========================================================
   DISTINCT POWER / FRONT-PANEL SOCKETS
   All socket faces point toward +Z / the camera.
========================================================= */


/* =========================================================
   8-PIN CPU / EPS SOCKET
   Physical layout: 2 columns x 4 rows
========================================================= */

function EPSSocket({ position }) {
  return (
    <group position={position}>

      {/* Socket body */}
      <RoundedBox
        args={[0.34, 0.22, 0.12]}
        radius={0.018}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#080a0c"
          metalness={0.65}
          roughness={0.25}
        />
      </RoundedBox>

      {/* 8 contacts facing +Z */}
      {[0, 1].map((column) =>
        [0, 1, 2, 3].map((row) => (
          <mesh
            key={`${column}-${row}`}
            position={[
              column === 0 ? -0.085 : 0.085,
              -0.065 + row * 0.043,
              0.067
            ]}
          >
            <boxGeometry
              args={[0.055, 0.030, 0.018]}
            />

            <meshStandardMaterial
              color="#d6b451"
              metalness={0.95}
              roughness={0.10}
            />
          </mesh>
        ))
      )}

      {/* Center key */}
      <mesh
        position={[0, 0, 0.072]}
      >
        <boxGeometry
          args={[0.025, 0.18, 0.025]}
        />

        <meshStandardMaterial
          color="#171a1d"
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

      <Text
        position={[0, 0.16, 0.075]}
        fontSize={0.055}
        color="#a7b3ba"
        anchorX="center"
      >
        CPU EPS 8-PIN
      </Text>

    </group>
  );
}


/* =========================================================
   CPU FAN SOCKET
   Physical layout: narrow 1 x 4 header
========================================================= */

function CPUFanSocket({ position }) {
  return (
    <group position={position}>

      {/* Narrow fan socket */}
      <RoundedBox
        args={[0.38, 0.15, 0.11]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#080a0c"
          metalness={0.60}
          roughness={0.28}
        />
      </RoundedBox>

      {/* 4 contacts facing +Z */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            -0.135 + i * 0.09,
            0,
            0.062
          ]}
        >
          <boxGeometry
            args={[0.035, 0.055, 0.018]}
          />

          <meshStandardMaterial
            color="#d6b451"
            metalness={0.95}
            roughness={0.10}
          />
        </mesh>
      ))}

      {/* Side guide */}
      <mesh
        position={[0.19, 0, 0.065]}
      >
        <boxGeometry
          args={[0.025, 0.09, 0.025]}
        />

        <meshStandardMaterial
          color="#1a1d20"
        />
      </mesh>

      <Text
        position={[0, 0.15, 0.075]}
        fontSize={0.05}
        color="#a7b3ba"
        anchorX="center"
      >
        CPU_FAN
      </Text>

    </group>
  );
}


/* =========================================================
   GPU POWER SOCKET
   Physical layout: 2 x 4 PCIe-style header
========================================================= */

function GPUPowerSocket({ position }) {
  return (
    <group position={position}>

      {/* Larger PCIe power body */}
      <RoundedBox
        args={[0.36, 0.23, 0.13]}
        radius={0.018}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#050607"
          metalness={0.70}
          roughness={0.22}
        />
      </RoundedBox>

      {/* 8 contacts facing +Z */}
      {[0, 1].map((column) =>
        [0, 1, 2, 3].map((row) => (
          <mesh
            key={`${column}-${row}`}
            position={[
              column === 0 ? -0.09 : 0.09,
              -0.067 + row * 0.045,
              0.073
            ]}
          >
            <boxGeometry
              args={[0.055, 0.032, 0.018]}
            />

            <meshStandardMaterial
              color="#d6b451"
              metalness={0.95}
              roughness={0.10}
            />
          </mesh>
        ))
      )}

      {/* PCIe key */}
      <mesh
        position={[0.09, 0, 0.078]}
      >
        <boxGeometry
          args={[0.025, 0.18, 0.025]}
        />

        <meshStandardMaterial
          color="#191c20"
        />
      </mesh>

      <Text
        position={[0, 0.17, 0.08]}
        fontSize={0.05}
        color="#a7b3ba"
        anchorX="center"
      >
        GPU POWER
      </Text>

    </group>
  );
}


/* =========================================================
   SATA DATA SOCKET
   Physical layout: thin 7-pin SATA connector
========================================================= */

function SATADataSocket({ position }) {
  return (
    <group position={position}>

      {/* SATA housing */}
      <RoundedBox
        args={[0.42, 0.14, 0.13]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#090b0d"
          metalness={0.55}
          roughness={0.30}
        />
      </RoundedBox>

      {/* Recessed SATA opening facing +Z */}
      <mesh
        position={[0, 0, 0.073]}
      >
        <boxGeometry
          args={[0.30, 0.075, 0.018]}
        />

        <meshStandardMaterial
          color="#020304"
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* 7 contacts */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh
          key={i}
          position={[
            -0.15 + i * 0.05,
            0,
            0.087
          ]}
        >
          <boxGeometry
            args={[0.022, 0.060, 0.012]}
          />

          <meshStandardMaterial
            color="#d6b451"
            metalness={0.95}
            roughness={0.10}
          />
        </mesh>
      ))}

      {/* SATA L-key */}
      <mesh
        position={[0.16, 0, 0.082]}
      >
        <boxGeometry
          args={[0.025, 0.075, 0.025]}
        />

        <meshStandardMaterial
          color="#202428"
        />
      </mesh>

      <Text
        position={[0, 0.14, 0.08]}
        fontSize={0.048}
        color="#a7b3ba"
        anchorX="center"
      >
        SATA DATA
      </Text>

    </group>
  );
}


/* =========================================================
   CASE FAN SOCKET
   Physical layout: 1 x 3 fan header
========================================================= */

function CaseFanSocket({ position }) {
  return (
    <group position={position}>

      {/* Smaller than CPU_FAN */}
      <RoundedBox
        args={[0.29, 0.14, 0.11]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#080a0c"
          metalness={0.60}
          roughness={0.28}
        />
      </RoundedBox>

      {/* 3 contacts facing +Z */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[
            -0.09 + i * 0.09,
            0,
            0.062
          ]}
        >
          <boxGeometry
            args={[0.035, 0.055, 0.018]}
          />

          <meshStandardMaterial
            color="#d6b451"
            metalness={0.95}
            roughness={0.10}
          />
        </mesh>
      ))}

      <Text
        position={[0, 0.14, 0.075]}
        fontSize={0.048}
        color="#a7b3ba"
        anchorX="center"
      >
        SYS_FAN
      </Text>

    </group>
  );
}


/* =========================================================
   POWER SW SOCKET
   Physical layout: tiny 1 x 2 front-panel header
========================================================= */

function PowerSWSocket({ position }) {
  return (
    <group position={position}>

      {/* Small front panel header */}
      <RoundedBox
        args={[0.20, 0.12, 0.10]}
        radius={0.010}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#080a0c"
          metalness={0.55}
          roughness={0.32}
        />
      </RoundedBox>

      {/* 2 contacts facing +Z */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          position={[
            -0.045 + i * 0.09,
            0,
            0.057
          ]}
        >
          <boxGeometry
            args={[0.032, 0.055, 0.018]}
          />

          <meshStandardMaterial
            color="#d6b451"
            metalness={0.95}
            roughness={0.10}
          />
        </mesh>
      ))}

      <Text
        position={[0, 0.13, 0.07]}
        fontSize={0.045}
        color="#a7b3ba"
        anchorX="center"
      >
        PWR SW
      </Text>

    </group>
  );
}


/* =========================================================
   CONNECTION SOCKETS
   Positions are kept inside the motherboard.
========================================================= */

function ConnectionSockets() {
  return (
    <group>

    {/* 8-PIN CPU / EPS */}
<EPSSocket
  position={[
    -0.93,
    -2.00,
    0.16
  ]}
/>

      {/* CPU FAN */}
      <CPUFanSocket
        position={[
          -0.05,
          2.20,
          0.16
        ]}
      />

      {/* CASE FAN */}
      <CaseFanSocket
  position={[1.00, -0.05, 0.18]}
/>

     <SATADataSocket
  position={[0.02, -2.05, 0.16]}
/>

```

      {/* GPU POWER */}
<GPUPowerSocket
  position={[
    1.49,
    -0.55,
    0.16
  ]}
/>

      {/* POWER SW */}
      <PowerSWSocket
  position={[1.54, -1.35, 0.16]}
/>

    </group>
  );
}

/* =========================================================
   REAR IO
========================================================= */

function RearIO() {
  return (
    <group
      position={[
        -BOARD.width / 2 - 0.04,
        BOARD.y,
        BOARD.z + 0.06,
      ]}
    >

      <RoundedBox
        args={[0.12, 2.15, 0.65]}
        radius={0.02}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#343a40"
          metalness={0.7}
          roughness={0.25}
        />

      </RoundedBox>

      {[0.55, 0.15, -0.25, -0.65].map(
        (y, index) => (
          <mesh
            key={index}
            position={[
              -0.07,
              y,
              0.15,
            ]}
          >

            <boxGeometry
              args={[0.02, 0.20, 0.25]}
            />

            <meshStandardMaterial
              color="#111417"
              metalness={0.3}
              roughness={0.4}
            />

          </mesh>
        )
      )}

    </group>
  );
}

/* =========================================================
   GPU SLOT BRACKETS
========================================================= */

function GPUSlots() {
  return (
    <group
      position={[
        BOARD.x + BOARD.width / 2 + 0.06,
        BOARD.y - 0.80,
        BOARD.z + 0.05,
      ]}
    >

      {[0, -0.45, -0.90].map(
        (y, index) => (
          <mesh
            key={index}
            position={[0, y, 0]}
          >

            <boxGeometry
              args={[0.08, 0.30, 0.08]}
            />

            <meshStandardMaterial
              color="#8c9499"
              metalness={0.8}
              roughness={0.2}
            />

          </mesh>
        )
      )}

    </group>
  );
}

/* =========================================================
   PSU MOUNT
========================================================= */

function PSUMount() {
  return (
    <group
      position={[
        0.55,
        0.95,
        0.92,
      ]}
    >

      <RoundedBox
        args={[1.15, 1.40, 1.10]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#111418"
          metalness={0.55}
          roughness={0.35}
        />

      </RoundedBox>

      <mesh
        position={[0, 0.40, 0.57]}
        rotation={[Math.PI / 2, 0, 0]}
      >

        <cylinderGeometry
          args={[0.38, 0.38, 0.05, 32]}
        />

        <meshStandardMaterial
          color="#080a0c"
          metalness={0.4}
          roughness={0.45}
        />

      </mesh>

      <Text
        position={[0, 0, 0.57]}
        fontSize={0.09}
        color="#9ea8ae"
        anchorX="center"
      >
        750W PSU
      </Text>

    </group>
  );
}

/* =========================================================
   HDD CAGE / DRIVE BAYS
========================================================= */

function HDDCage() {
  return (
    <group position={[-1.25, 0.58, 0.92]}>

      {/* Two clearly separated 3.5-inch drive bays */}
      {[0, 0.34].map((y, index) => (
        <group key={index} position={[0, y, 0]}>
          <RoundedBox
            args={[1.25, 0.24, 0.78]}
            radius={0.025}
            smoothness={3}
          >
            <meshStandardMaterial
              color="#171c20"
              metalness={0.65}
              roughness={0.30}
            />
          </RoundedBox>

          {/* Four mounting rails make this read as a drive bay */}
          {[-0.48, 0.48].map((x) => (
            <mesh key={x} position={[x, 0, 0.41]}>
              <boxGeometry args={[0.06, 0.18, 0.06]} />
              <meshStandardMaterial
                color="#737c82"
                metalness={0.75}
                roughness={0.22}
              />
            </mesh>
          ))}
        </group>
      ))}

      <Text
        position={[0, -0.20, 0.42]}
        fontSize={0.075}
        color="#9eabb1"
        anchorX="center"
      >
        3.5 HDD BAY
      </Text>

      <Text
        position={[0, 0.17, 0.42]}
        fontSize={0.055}
        color="#65737a"
        anchorX="center"
      >
        DRIVE CAGE
      </Text>

      {/* SATA power receptacle for the HDD */}
      <mesh position={[0.50, 0.04, 0.43]}>
        <boxGeometry args={[0.20, 0.10, 0.06]} />
        <meshStandardMaterial
          color="#090c0f"
          metalness={0.55}
          roughness={0.30}
        />
      </mesh>
      <Text
        position={[0.50, 0.18, 0.44]}
        fontSize={0.045}
        color="#8d999f"
        anchorX="center"
      >
        SATA PWR
      </Text>

    </group>
  );
}

/* =========================================================
   CASE PORTS — Rear I/O shield, front drive bay openings,
   and cable-routing grommets
========================================================= */

function CasePorts() {
  return (
    <group>
      <RearIOShield />
      <FrontDriveBayPlates />
      <CableGrommets />
    </group>
  );
}

/* ---------- Rear I/O shield (USB, audio, ethernet, display) ---------- */

function RearIOShield() {
  // Mounted flush on the case's back panel, aligned with the motherboard height
  const posX = -CASE.width / 2 + 0.55;
  const posY = BOARD.y + 1.9;
  const posZ = -CASE.depth / 2 + 0.07;

  const ports = [
    { x: -0.28, y: 0.18, w: 0.10, h: 0.10 }, // USB
    { x: -0.14, y: 0.18, w: 0.10, h: 0.10 }, // USB
    { x: 0.02, y: 0.18, w: 0.10, h: 0.10 },  // USB
    { x: 0.18, y: 0.18, w: 0.14, h: 0.09 },  // HDMI
    { x: -0.28, y: 0.02, w: 0.14, h: 0.09 }, // DisplayPort
    { x: -0.10, y: 0.02, w: 0.09, h: 0.09 }, // Ethernet
    { x: 0.06, y: 0.02, w: 0.05, h: 0.05 },  // Audio jack
    { x: 0.16, y: 0.02, w: 0.05, h: 0.05 },  // Audio jack
  ];

  return (
    <group position={[posX, posY, posZ]}>

      {/* Backplate */}
      <RoundedBox args={[0.62, 0.42, 0.03]} radius={0.015} smoothness={2}>
        <meshStandardMaterial color="#2e343a" metalness={0.75} roughness={0.28} />
      </RoundedBox>

      {/* Port cutouts (dark recessed holes) */}
      {ports.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0.02]}>
          <boxGeometry args={[p.w, p.h, 0.03]} />
          <meshStandardMaterial color="#050607" roughness={0.7} />
        </mesh>
      ))}

      <Text
        position={[0, -0.24, 0.02]}
        fontSize={0.05}
        color="#8a949a"
        anchorX="center"
      >
        REAR I/O
      </Text>

    </group>
  );
}

/* ---------- Front drive bay face plates (visible openings) ---------- */

function FrontDriveBayPlates() {
  // Aligns with HDDCage's x/y, but sits at the case's actual front edge
  const posX = -1.25;
  const posZ = CASE.depth / 2 - 0.05;

  return (
    <group position={[posX, 0, posZ]}>

      {[0.58, 0.92].map((y, i) => (
        <group key={i} position={[0, y, 0]}>

          {/* Bezel frame */}
          <RoundedBox args={[1.35, 0.30, 0.04]} radius={0.02} smoothness={2}>
            <meshStandardMaterial color="#1c2126" metalness={0.6} roughness={0.32} />
          </RoundedBox>

          {/* Open slot (dark, reads as an accessible drive bay port) */}
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[1.18, 0.20, 0.02]} />
            <meshStandardMaterial color="#040506" roughness={0.8} />
          </mesh>

        </group>
      ))}

      <Text
        position={[0, 0.20, 0.03]}
        fontSize={0.055}
        color="#6c7c8c"
        anchorX="center"
      >
        DRIVE BAYS
      </Text>

    </group>
  );
}

/* ---------- Cable routing grommets (motherboard tray edge) ---------- */

function CableGrommets() {
  const posX = BOARD.x + BOARD.width / 2 + 0.15;
  const grommetYs = [BOARD.y + 1.5, BOARD.y, BOARD.y - 1.5];

  return (
    <group>
      {grommetYs.map((y, i) => (
        <group key={i} position={[posX, y, BOARD.z]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.09, 0.025, 8, 20]} />
            <meshStandardMaterial color="#111417" roughness={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 20]} />
            <meshStandardMaterial color="#050607" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* =========================================================
   CASE FANS
========================================================= */

function CaseFans({
  installed,
}) {
  const rightX = CASE.width / 2 + 0.05;

  return (
    <group>

      <pointLight
        position={[rightX + 0.3, CASE.height * 0.5, 0]}
        intensity={2}
        distance={4}
      />

      <FanVisual
        position={[rightX, CASE.height * 0.66, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

      <FanVisual
        position={[rightX, CASE.height * 0.34, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

    </group>
  );
}

/* =========================================================
   FAN VISUAL
========================================================= */

function FanVisual({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  return (
    <group position={position} rotation={rotation}>

      {/* Square frame */}
      <RoundedBox args={[0.78, 0.78, 0.06]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#15191d" metalness={0.5} roughness={0.35} side={THREE.DoubleSide} />
      </RoundedBox>

      {/* Corner mounting screws */}
      {[
        [-0.33, 0.33],
        [0.33, 0.33],
        [-0.33, -0.33],
        [0.33, -0.33],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 12]} />
          <meshStandardMaterial color="#050607" metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Outer ring */}
      <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.02, 8, 32]} />
        <meshStandardMaterial color="#0a0d10" metalness={0.4} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Fan blades, angled like a real impeller */}
      <group position={[0, 0, 0.03]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const angle = (i / 7) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0]}
              rotation={[0, 0, angle + Math.PI / 5]}
            >
              <boxGeometry args={[0.05, 0.28, 0.015]} />
              <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>

      {/* Center hub */}
      <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.03, 20]} />
        <meshStandardMaterial color="#0d1013" metalness={0.4} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* LED accent */}
      <mesh position={[0, 0, 0.055]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          color="#4387d5"
          emissive="#1d4c83"
          emissiveIntensity={0.5}
        />
      </mesh>

    </group>
  );
}

/* =========================================================
   INSTALLED COMPONENTS
========================================================= */

function InstalledComponents({
  installed,
  mode,
  onRemovePart,
}) {
  // SLOTS are stored in world coordinates because the draggable parts
  // live outside the case. Installed components are rendered INSIDE the
  // ComputerCase group, so convert the X coordinate back to case-local space.
  const localSlot = (slot) => [
    slot[0] - CASE.x,
    slot[1],
    slot[2],
  ];

  return (
    <group>

{installed.includes("cpu") && (
  <group
    position={localSlot(SLOTS.cpu)}
    rotation={[Math.PI / 2, 0, 0]}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("cpu");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => {
      document.body.style.cursor = "default";
    }}
  >
    <CPUInstalled />
  </group>
)}

{installed.includes("cooler") && (
  <group
    position={localSlot(SLOTS.cooler)}
    rotation={[Math.PI / 2, 0, 0]}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("cooler");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <CoolerInstalled />
  </group>
)}

      {installed.includes("ram") && (
  <group
    position={localSlot(SLOTS.ram)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("ram");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <RAMInstalled />
  </group>
)}

      {installed.includes("gpu") && (
  <group
    position={localSlot(SLOTS.gpu)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("gpu");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <GPUInstalled />
  </group>
)}

    {installed.includes("ssd") && (
  <group
    position={localSlot(SLOTS.ssd)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("ssd");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <SSDInstalled />
  </group>
)}

{installed.includes("chipset") && (
  <group
    position={[
      SLOTS.chipset[0] - CASE.x,
      SLOTS.chipset[1],
      SLOTS.chipset[2],
    ]}
    rotation={[Math.PI / 2, 0, 0]}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("chipset");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <ChipsetInstalled />
  </group>
)}

     {installed.includes("pcieWifi") && (
  <group
    position={localSlot(SLOTS.pcieWifi)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("pcieWifi");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <PCIeExpansionInstalled
      label="WI-FI"
    />
  </group>
)}

    {installed.includes("pcieSound") && (
  <group
    position={localSlot(SLOTS.pcieSound)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("pcieSound");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <PCIeExpansionInstalled
      label="SOUND"
    />
  </group>
)}

     {installed.includes("cmos") && (
  <group
    position={localSlot(SLOTS.cmos)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("cmos");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <CMOSInstalled />
  </group>
)}

      {installed.includes("atx24") && (
  <group
    position={localSlot(SLOTS.atx24)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("atx24");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <ATX24Installed />
  </group>
)}

    {installed.includes("psu") && (
  <group
    position={localSlot(SLOTS.psu)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("psu");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <PSUInstalled />
  </group>
)}

     {installed.includes("hdd") && (
  <group
    position={localSlot(SLOTS.hdd)}
    onClick={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") onRemovePart("hdd");
    }}
    onPointerOver={(e) => {
      e.stopPropagation();
      if (mode === "disassemble") document.body.style.cursor = "pointer";
    }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <HDDInstalled />
  </group>
)}

      <InternalCables installed={installed} mode={mode} onRemovePart={onRemovePart} />

    </group>
  );
}

/* =========================================================
   INSTALLED CONNECTIONS / ORGANIZED CABLE ROUTES
========================================================= */
function InternalCables({ installed, mode, onRemovePart }) {

  const has = (id) => installed.includes(id);

  /*
    SLOTS are WORLD coordinates.
    InternalCables is rendered INSIDE the case-local group,
    so convert world X → case-local X.
  */
  const local = (slot) => [
    slot[0] - CASE.x,
    slot[1],
    slot[2],
  ];

  /*
    Exact socket point.
    Small Z offset keeps the cable visibly connected
    to the front of the motherboard/socket.
  */
  const socket = (slot, z = 0.035) => [
    slot[0] - CASE.x,
    slot[1],
    slot[2] + z,
  ];

  /*
    PSU cable starting points.

    These are positioned around the actual PSU body:
    PSU center = SLOTS.psu
  */
  const psuCenter = local(SLOTS.psu);

  const psu24 = [
    psuCenter[0] - 0.34,
    psuCenter[1] + 0.32,
    psuCenter[2] + 0.04,
  ];

  const psuCPU = [
    psuCenter[0] - 0.10,
    psuCenter[1] + 0.38,
    psuCenter[2] + 0.04,
  ];

  const psuGPU = [
    psuCenter[0] + 0.22,
    psuCenter[1] + 0.30,
    psuCenter[2] + 0.04,
  ];

  const psuSATA = [
    psuCenter[0] - 0.35,
    psuCenter[1] - 0.25,
    psuCenter[2] + 0.05,
  ];


  return (
    <group>


      {/* =====================================================
          24-PIN ATX

          PSU
            ↓
          right side of motherboard
            ↓
          24-PIN SOCKET

          RED = MAIN POWER
      ===================================================== */}

      {has("atx24") && (
  <Cable
    points={[
      psu24,

      [
        -0.70,
        1.50,
        0.40,
      ],

      [
        socket(SLOTS.atx24)[0] + 0.15,
        socket(SLOTS.atx24)[1],
        socket(SLOTS.atx24)[2] + 0.05,
      ],

      socket(SLOTS.atx24),
    ]}
    color="#e63946"
    radius={0.028}
  />
)}
      
{has("sataPower") && (
  <Cable
    points={[
      psuSATA,
      [
        psuCenter[0] - 0.55,
        psuCenter[1] - 0.10,
        psuCenter[2] + 0.10,
      ],
      [
        local(SLOTS.sataPower)[0] + 0.10,
        local(SLOTS.sataPower)[1] + 0.20,
        local(SLOTS.sataPower)[2] + 0.05,
      ],
      socket(SLOTS.sataPower),
    ]}
    color="#b15cff"
    radius={0.021}
  />
)}
      {/* =====================================================
          CPU COOLER → CPU FAN

          SHORT CABLE
          LIGHT GRAY
      ===================================================== */}

      {has("cooler") && has("cpuFan") && (
        <Cable
          points={[
            local(SLOTS.cooler),

            [
              local(SLOTS.cooler)[0] + 0.18,
              local(SLOTS.cooler)[1] + 0.05,
              local(SLOTS.cooler)[2] + 0.10,
            ],

            [
              local(SLOTS.cpuFan)[0] - 0.12,
              local(SLOTS.cpuFan)[1] - 0.10,
              local(SLOTS.cpuFan)[2] + 0.04,
            ],

            socket(SLOTS.cpuFan),
          ]}
          color="#d6d9dc"
          radius={0.018}
        />
      )}


      {/* =====================================================
          GPU POWER

          PSU
            ↓
          bottom/right
            ↓
          GPU POWER SOCKET

          YELLOW
      ===================================================== */}

      {has("gpuPower") && (
  <Cable
    points={[
      psuGPU,

      [
        1.00,
        1.90,
        0.10,
      ],

      [
        socket(SLOTS.gpuPower)[0] - 0.10,
        socket(SLOTS.gpuPower)[1] - 0.05,
        socket(SLOTS.gpuPower)[2] + 0.05,
      ],

      socket(SLOTS.gpuPower),
    ]}
    color="#037518"
    radius={0.028}
  />
)}


      {/* =====================================================
          HDD SATA DATA

          HDD
            ↓
          SATA DATA SOCKET

          BLUE
      ===================================================== */}

      {has("sataData") && (
  <Cable
    points={[
      [local(SLOTS.hdd)[0] + 0.40, local(SLOTS.hdd)[1], local(SLOTS.hdd)[2] + 0.04],
      [local(SLOTS.hdd)[0] + 0.65, local(SLOTS.hdd)[1] + 0.20, local(SLOTS.hdd)[2] + 0.06],
      [-0.45, 1.00, 0.30],
      [
        socket(SLOTS.sataData)[0] + 0.10,
        socket(SLOTS.sataData)[1],
        socket(SLOTS.sataData)[2] + 0.05,
      ],
      socket(SLOTS.sataData),
    ]}
    color="#3a86ff"
    radius={0.019}
  />
)}


      {/* =====================================================
          HDD SATA POWER

          PSU
            ↓
          HDD

          PURPLE
      ===================================================== */}

      {has("eps8") && (
  <Cable
    points={[
      psuCPU,
      [0.0, 1.30, 0.5],
      [
        socket(SLOTS.eps8)[0] + 0.15,
        socket(SLOTS.eps8)[1],
        socket(SLOTS.eps8)[2] + 0.05,
      ],
      socket(SLOTS.eps8),
    ]}
    color="#ff9f1c"
    radius={0.026}
  />
)}


      {/* =====================================================
          CASE FAN

          FAN
            ↓
          CASE FAN HEADER

          GREEN
      ===================================================== */}

      {has("caseFan") && (
        <Cable
          points={[
            local(SLOTS.fan),

            [
              local(SLOTS.fan)[0] - 0.15,
              local(SLOTS.fan)[1] - 0.10,
              local(SLOTS.fan)[2] + 0.02,
            ],

            [
              1.75,
              3.10,
              0.20,
            ],

            [
              1.40,
              3.80,
              -0.35,
            ],

            [
              socket(SLOTS.caseFan)[0] + 0.15,
              socket(SLOTS.caseFan)[1] - 0.10,
              socket(SLOTS.caseFan)[2],
            ],

            socket(SLOTS.caseFan),
          ]}
          color="#20c997"
          radius={0.018}
        />
      )}


      {/* =====================================================
          POWER SWITCH

          FRONT CASE BUTTON
            ↓
          POWER SW HEADER

          GRAY
      ===================================================== */}

      {has("powerSW") && (
  <Cable
    points={[
      [
        CASE.width / 2 - 0.25,
        CASE.height * 0.42,
        CASE.depth / 2,
      ],

      [
        0.8,
        3.5,
        0.20,
      ],

      [
        socket(SLOTS.powerSW)[0] + 0.15,
        socket(SLOTS.powerSW)[1],
        socket(SLOTS.powerSW)[2] + 0.05,
      ],

      socket(SLOTS.powerSW),
    ]}
    color="#9aa0a6"
    radius={0.016}
  />
)}


      {/* =====================================================
          SMALL CONNECTOR ENDS

          These prevent the cable from visually looking
          "cut off" at the socket.
      ===================================================== */}

      {has("atx24") && (
  <mesh
    position={socket(SLOTS.atx24, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("atx24"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.035, 12, 8]} />
    <meshStandardMaterial color="#e63946" metalness={0.25} roughness={0.5} />
  </mesh>
)}

    {has("eps8") && (
  <mesh
    position={socket(SLOTS.eps8, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("eps8"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.032, 12, 8]} />
    <meshStandardMaterial color="#ff9f1c" metalness={0.25} roughness={0.5} />
  </mesh>
)}

    {has("cooler") && has("cpuFan") && (
  <mesh
    position={socket(SLOTS.cpuFan, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("cpuFan"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.024, 12, 8]} />
    <meshStandardMaterial color="#d6d9dc" metalness={0.25} roughness={0.5} />
  </mesh>
)}

     {has("gpuPower") && (
  <mesh
    position={socket(SLOTS.gpuPower, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("gpuPower"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.035, 12, 8]} />
    <meshStandardMaterial color="#ffd60a" metalness={0.25} roughness={0.5} />
  </mesh>
)}

   {has("sataData") && (
  <mesh
    position={socket(SLOTS.sataData, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("sataData"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.022, 12, 8]} />
    <meshStandardMaterial color="#3a86ff" metalness={0.25} roughness={0.5} />
  </mesh>
)}

     {has("sataPower") && (
  <mesh
    position={socket(SLOTS.sataPower, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("sataPower"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.024, 12, 8]} />
    <meshStandardMaterial color="#b15cff" metalness={0.25} roughness={0.5} />
  </mesh>
)}

     {has("caseFan") && (
  <mesh
    position={socket(SLOTS.caseFan, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("caseFan"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.022, 12, 8]} />
    <meshStandardMaterial color="#20c997" metalness={0.25} roughness={0.5} />
  </mesh>
)}

    {has("powerSW") && (
  <mesh
    position={socket(SLOTS.powerSW, 0.055)}
    onClick={(e) => { e.stopPropagation(); if (mode === "disassemble") onRemovePart("powerSW"); }}
    onPointerOver={(e) => { e.stopPropagation(); if (mode === "disassemble") document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "default"; }}
  >
    <sphereGeometry args={[0.020, 12, 8]} />
    <meshStandardMaterial color="#9aa0a6" metalness={0.25} roughness={0.5} />
  </mesh>
)}
    </group>
  );
}

/* =========================================================
   CPU INSTALLED
========================================================= */

function CPUInstalled() {
  return (
    <RoundedBox
      args={[0.72, 0.035, 0.72]}
      radius={0.025}
      smoothness={3}
    >

      <meshStandardMaterial
        color="#bfc4c7"
        metalness={0.85}
        roughness={0.18}
      />

    </RoundedBox>
  );
}

/* =========================================================
   CPU COOLER INSTALLED
========================================================= */

function CoolerInstalled() {
  return (
    <group>

      <RoundedBox
        args={[0.82, 0.28, 0.82]}
        radius={0.035}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#24292e"
          metalness={0.65}
          roughness={0.27}
        />

      </RoundedBox>

      {[...Array(8)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.32 +
                index * 0.092,
              0,
              0,
            ]}
          >

            <boxGeometry
              args={[0.025, 0.34, 0.72]}
            />

            <meshStandardMaterial
              color="#737b80"
              metalness={0.75}
              roughness={0.22}
            />

          </mesh>
        )
      )}

      <mesh
        position={[0, 0.16, 0]}
      >

        <cylinderGeometry
          args={[0.22, 0.22, 0.03, 24]}
        />

        <meshStandardMaterial
          color="#111519"
          metalness={0.5}
          roughness={0.3}
        />

      </mesh>

    </group>
  );
}

/* =========================================================
   RAM INSTALLED
========================================================= */

function RAMInstalled() {
  return (
    <group>

      {[0, 0.30].map(
        (x, index) => (
          <group
            key={index}
            position={[x, 0, 0]}
          >

            <RoundedBox
              args={[0.10, 0.62, 0.055]}
              radius={0.008}
              smoothness={2}
            >

              <meshStandardMaterial
                color={
                  index === 0
                    ? "#20c978"
                    : "#16a861"
                }
                metalness={0.3}
                roughness={0.25}
              />

            </RoundedBox>

            {[...Array(9)].map(
              (_, pin) => (
                <mesh
                  key={pin}
                  position={[
                    0,
                    -0.25 +
                      pin * 0.062,
                    0.04,
                  ]}
                >

                  <boxGeometry
                    args={[
                      0.10,
                      0.012,
                      0.012,
                    ]}
                  />

                  <meshStandardMaterial
                    color="#d0ae4b"
                    metalness={0.9}
                    roughness={0.12}
                  />

                </mesh>
              )
            )}

          </group>
        )
      )}

    </group>
  );
}

/* =========================================================
   GPU INSTALLED
========================================================= */

function GPUInstalled() {
  return (
    <group>

      <RoundedBox
        args={[2.55, 0.20, 0.72]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#171b20"
          metalness={0.6}
          roughness={0.28}
        />

      </RoundedBox>

      {[-0.72, 0, 0.72].map(
        (x, index) => (
          <group
            key={index}
            position={[x, 0.13, 0]}
          >

            <mesh
              rotation={[
                Math.PI / 2,
                0,
                0,
              ]}
            >

              <cylinderGeometry
                args={[
                  0.23,
                  0.23,
                  0.05,
                  32,
                ]}
              />

              <meshStandardMaterial
                color="#080a0d"
                metalness={0.45}
                roughness={0.35}
              />

            </mesh>

            <mesh
              rotation={[
                Math.PI / 2,
                0,
                0,
              ]}
            >

              <cylinderGeometry
                args={[
                  0.06,
                  0.06,
                  0.055,
                  20,
                ]}
              />

              <meshStandardMaterial
                color="#4387d5"
                emissive="#1d4c83"
                emissiveIntensity={0.5}
              />

            </mesh>

          </group>
        )
      )}

      <Text
        position={[0, 0.14, 0.38]}
        fontSize={0.075}
        color="#a8b2b8"
        anchorX="center"
      >
        GPU
      </Text>

    </group>
  );
}

/* =========================================================
   SSD INSTALLED
========================================================= */

function SSDInstalled() {
  return (
    <group>

      <RoundedBox
        args={[0.72, 0.035, 0.18]}
        radius={0.015}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#171b1f"
          metalness={0.65}
          roughness={0.25}
        />

      </RoundedBox>

      {[...Array(10)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.29 +
                index * 0.065,
              0.035,
              0.0,
            ]}
          >

            <boxGeometry
              args={[
                0.025,
                0.02,
                0.075,
              ]}
            />

            <meshStandardMaterial
              color="#d3b04d"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

      <Text
        position={[0, 0.10, 0]}
        fontSize={0.06}
        color="#aeb6ba"
        anchorX="center"
      >
        NVMe
      </Text>

    </group>
  );
}

/* =========================================================
   CHIPSET INSTALLED
========================================================= */

function ChipsetInstalled() {
  return (
    <group>

      <RoundedBox
        args={[0.58, 0.08, 0.44]}
        radius={0.02}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#252c32"
          metalness={0.72}
          roughness={0.24}
        />

      </RoundedBox>

      <RoundedBox
        args={[0.38, 0.025, 0.28]}
        position={[0, 0.055, 0]}
        radius={0.01}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#59646c"
          metalness={0.8}
          roughness={0.18}
        />

      </RoundedBox>

      <Text
        position={[0, 0.10, 0]}
        fontSize={0.06}
        color="#d0d8dc"
        anchorX="center"
      >
        PCH
      </Text>

    </group>
  );
}

/* =========================================================
   PCIe EXPANSION CARDS
========================================================= */

function PCIeExpansionInstalled({
  label,
}) {
  return (
    <group>

      <RoundedBox
        args={[2.30, 0.10, 0.34]}
        radius={0.015}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#17232a"
          metalness={0.55}
          roughness={0.28}
        />

      </RoundedBox>

      {[...Array(22)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.95 +
                index * 0.09,
              -0.07,
              -0.19,
            ]}
          >

            <boxGeometry
              args={[
                0.035,
                0.022,
                0.05,
              ]}
            />

            <meshStandardMaterial
              color="#c5a34b"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

      <RoundedBox
        args={[0.70, 0.05, 0.20]}
        position={[0, 0.09, 0]}
        radius={0.01}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#27363e"
          metalness={0.45}
          roughness={0.3}
        />

      </RoundedBox>

      <Text
        position={[0, 0.13, 0.02]}
        fontSize={0.065}
        color="#9fc7d8"
        anchorX="center"
      >
        {label}
      </Text>

    </group>
  );
}

/* =========================================================
   CMOS BATTERY
========================================================= */

function CMOSInstalled() {
  return (
    <group>

      <mesh
        rotation={[Math.PI / 2, 0, 0]}
      >

        <cylinderGeometry
          args={[
            0.18,
            0.18,
            0.06,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#d5d8da"
          metalness={0.85}
          roughness={0.16}
        />

      </mesh>

      <mesh
        position={[0, 0, 0.04]}
      >

        <cylinderGeometry
          args={[
            0.14,
            0.14,
            0.012,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#aeb4b7"
          metalness={0.7}
          roughness={0.18}
        />

      </mesh>

      <Text
        position={[0, 0.12, 0]}
        fontSize={0.05}
        color="#606970"
        anchorX="center"
      >
        CR2032
      </Text>

    </group>
  );
}

/* =========================================================
   24-PIN ATX CONNECTOR
========================================================= */

function ATX24Installed() {
  return (
    <group>

      <RoundedBox
        args={[0.20, 0.90, 0.15]}
        radius={0.012}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#090b0d"
          metalness={0.35}
          roughness={0.38}
        />

      </RoundedBox>

      {[0, 1].map((column) => (
        <group key={column}>

          {[...Array(12)].map(
            (_, row) => (
              <mesh
                key={row}
                position={[
                  column === 0
                    ? -0.055
                    : 0.055,
                  -0.39 +
                    row * 0.071,
                  0.08,
                ]}
              >

                <boxGeometry
                  args={[
                    0.032,
                    0.032,
                    0.012,
                  ]}
                />

                <meshStandardMaterial
                  color="#c9aa50"
                  metalness={0.9}
                  roughness={0.12}
                />

              </mesh>
            )
          )}

        </group>
      ))}

    </group>
  );
}

/* =========================================================
   PSU INSTALLED
========================================================= */

function PSUInstalled() {
  return (
    <group>

      <RoundedBox
        args={[0.90, 0.65, 1.15]}
        radius={0.04}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#17191c"
          metalness={0.55}
          roughness={0.35}
        />

      </RoundedBox>

      {/* Modular cable exit panel */}
      <RoundedBox
        args={[0.70, 0.35, 0.03]}
        position={[-0.14, 0.30, 0.585]}
        radius={0.015}
        smoothness={2}
      >
        <meshStandardMaterial color="#0d0f11" metalness={0.4} roughness={0.5} />
      </RoundedBox>

      {[
        [-0.24, 0.10],
        [-0.05, 0.10],
        [0.14, 0.10],
        [-0.24, -0.10],
      ].map(([x, y], i) => (
        <mesh key={i} position={[-0.14 + x, 0.30 + y, 0.60]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
          <meshStandardMaterial color="#050607" roughness={0.7} />
        </mesh>
      ))}

      <mesh
        position={[0, 0.33, 0.58]}
        rotation={[Math.PI / 2, 0, 0]}
      >

        <cylinderGeometry
          args={[
            0.25,
            0.25,
            0.04,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#080a0c"
          metalness={0.35}
          roughness={0.45}
        />

      </mesh>

      <Text
        position={[0, 0, 0.58]}
        fontSize={0.08}
        color="#9ca6ac"
        anchorX="center"
      >
        750W PSU
      </Text>

    </group>
  );
}

/* =========================================================
   HDD INSTALLED
========================================================= */

function HDDInstalled() {
  return (
    <group>
      <RoundedBox
        args={[1.02, 0.20, 0.62]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#555d64"
          metalness={0.65}
          roughness={0.28}
        />
      </RoundedBox>

      <mesh position={[0, 0.105, 0.02]}>
        <boxGeometry args={[0.72, 0.018, 0.38]} />
        <meshStandardMaterial
          color="#242a2f"
          metalness={0.55}
          roughness={0.30}
        />
      </mesh>

      <mesh position={[0.39, 0, 0]}>
        <boxGeometry args={[0.025, 0.12, 0.42]} />
        <meshStandardMaterial
          color="#20252a"
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>

      <Text
        position={[0, 0.13, 0.33]}
        fontSize={0.065}
        color="#d0d7da"
        anchorX="center"
      >
        3.5 HDD
      </Text>
    </group>
  );
}

/* =========================================================
   POWER CABLES
========================================================= */

/* =========================================================
   PERIPHERALS (Monitor, Keyboard, Mouse, Speakers)
========================================================= */

function Peripherals({ powered }) {
  const groupPos = [-3.7, 0, -2.2];

  return (
    <group position={groupPos}>
      <Monitor powered={powered} />
      <Keyboard />
      <Mouse />
      <Speaker position={[-1.9, 0.35, 0.35]} />
      <Speaker position={[1.9, 0.35, 0.35]} />
    </group>
  );
}

function Monitor({ powered }) {
  return (
    <group>

      {/* Stand base */}
      <mesh position={[0, 0.02, 0.15]}>
        <boxGeometry args={[0.65, 0.04, 0.4]} />
        <meshStandardMaterial color="#1c1f22" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Stand neck — shortened */}
      <mesh position={[0, 0.35, 0.1]}>
        <boxGeometry args={[0.09, 0.65, 0.09]} />
        <meshStandardMaterial color="#1c1f22" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Screen assembly — raised so it clears the neck */}
      <group position={[0, 1.75, 0]}>

        <RoundedBox args={[3.4, 2.05, 0.08]} radius={0.03} smoothness={3}>
          <meshStandardMaterial color="#101316" metalness={0.5} roughness={0.4} />
        </RoundedBox>

        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[3.2, 1.85]} />
          <meshStandardMaterial
            color={powered ? "#0a2540" : "#05070a"}
            emissive={powered ? "#3fa9f5" : "#000000"}
            emissiveIntensity={powered ? 1.4 : 0}
          />
        </mesh>

        {powered && (
          <Text position={[0, 0, 0.05]} fontSize={0.14} color="#000000" anchorX="center">
            SYSTEM READY
          </Text>
        )}

      </group>

    </group>
  );
}

function Keyboard() {
  const keyRows = [
    { count: 14, z: -0.24 }, // number row
    { count: 13, z: -0.13 }, // qwerty row
    { count: 12, z: -0.02 }, // asdf row
    { count: 11, z: 0.09 },  // zxcv row
  ];

  return (
    <group position={[0, 0.02, 1.1]}>

      {/* Base tray */}
      <RoundedBox args={[2.3, 0.06, 0.85]} radius={0.03} smoothness={3}>
        <meshStandardMaterial color="#1a1d20" metalness={0.4} roughness={0.4} />
      </RoundedBox>

      {/* Slight raised back edge (typing angle) */}
      <mesh position={[0, 0.02, -0.38]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[2.2, 0.03, 0.06]} />
        <meshStandardMaterial color="#222629" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Key rows */}
      {keyRows.map((row, rowIndex) => {
        const spacing = 2.1 / row.count;
        return [...Array(row.count)].map((_, col) => (
          <RoundedBox
            key={`${rowIndex}-${col}`}
            args={[spacing * 0.82, 0.045, 0.09]}
            radius={0.006}
            smoothness={2}
            position={[
              -1.05 + spacing * col + spacing / 2,
              0.055,
              row.z,
            ]}
          >
            <meshStandardMaterial color="#2b2f33" roughness={0.5} />
          </RoundedBox>
        ));
      })}

      {/* Spacebar */}
      <RoundedBox
        args={[0.75, 0.045, 0.09]}
        radius={0.006}
        smoothness={2}
        position={[0, 0.055, 0.2]}
      >
        <meshStandardMaterial color="#2b2f33" roughness={0.5} />
      </RoundedBox>

      {/* Brand light strip */}
      <mesh position={[0, 0.032, -0.38]}>
        <boxGeometry args={[2.1, 0.008, 0.015]} />
        <meshStandardMaterial
          color="#4387d5"
          emissive="#1d4c83"
          emissiveIntensity={0.6}
        />
      </mesh>

    </group>
  );
}

function Mouse() {
  return (
    <group position={[1.5, 0.025, 1.1]}>

      {/* Main body — flat, boxy, slightly rounded edges */}
      <RoundedBox args={[0.3, 0.05, 0.5]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color="#e8e8e6" metalness={0.1} roughness={0.55} />
      </RoundedBox>

      {/* Left/right click split line */}
      <mesh position={[0, 0.028, 0.05]}>
        <boxGeometry args={[0.004, 0.008, 0.35]} />
        <meshStandardMaterial color="#c9c9c6" />
      </mesh>

      {/* Scroll wheel */}
      <mesh position={[0, 0.03, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.03, 16]} />
        <meshStandardMaterial color="#3a3a38" roughness={0.5} />
      </mesh>

      {/* Cable */}
      <mesh position={[0, 0.015, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
        <meshStandardMaterial color="#2a2a28" />
      </mesh>

    </group>
  );
}

function Speaker({ position }) {
  return (
    <group position={position}>

      {/* Body */}
      <RoundedBox args={[0.32, 0.78, 0.32]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color="#16181b" metalness={0.45} roughness={0.35} />
      </RoundedBox>

      {/* Front grille recess */}
      <RoundedBox
        args={[0.26, 0.66, 0.02]}
        radius={0.03}
        smoothness={3}
        position={[0, 0, 0.17]}
      >
        <meshStandardMaterial color="#0c0e10" roughness={0.6} />
      </RoundedBox>

      {/* Woofer */}
      <mesh position={[0, 0.16, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 28]} />
        <meshStandardMaterial color="#08090a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.16, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.015, 20]} />
        <meshStandardMaterial color="#1a1c1e" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Tweeter */}
      <mesh position={[0, -0.18, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 24]} />
        <meshStandardMaterial color="#08090a" roughness={0.5} />
      </mesh>

      {/* Volume knob */}
      <mesh position={[0, -0.32, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
        <meshStandardMaterial color="#3a4046" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Power LED */}
      <mesh position={[0.1, -0.32, 0.18]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial
          color="#4387d5"
          emissive="#1d4c83"
          emissiveIntensity={0.6}
        />
      </mesh>

    </group>
  );
}

/* =========================================================
   BACK I/O OUTLET (on the case's rear panel)
========================================================= */

/* =========================================================
   BACK I/O OUTLET (near the bottom of the case's rear panel)
========================================================= */

const BACK_OUTLET = [
  CASE.x - CASE.width / 2 + 0.4,
  0.5,
  -CASE.depth / 2 - 0.03,
];

function BackIOPlate() {
  return (
    <group position={BACK_OUTLET}>
      <mesh>
        <boxGeometry args={[0.5, 0.35, 0.03]} />
        <meshStandardMaterial color="#2b2f33" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.02]}>
          <boxGeometry args={[0.06, 0.1, 0.02]} />
          <meshStandardMaterial color="#0a0c0e" />
        </mesh>
      ))}
    </group>
  );
}

/* =========================================================
   CABLES — hug the table, stay tucked behind the case
========================================================= */

function PeripheralCablesWorld({ powered }) {
  const railZ = -2.4; // stays well behind the case's back panel (-1.83)

  return (
    <group>
      <Cable
        points={[
          [-3.7, 0.05, -2.25],
          [-0.8, 0.05, railZ],
          [1.4, 0.15, railZ],
          BACK_OUTLET,
        ]}
        color={powered ? "#2c5f8a" : "#141619"}
      />
      <Cable
        points={[
          [-3.7, 0.02, -1.4],
          [-0.9, 0.03, railZ],
          [1.4, 0.1, railZ],
          [BACK_OUTLET[0] - 0.1, 0.35, BACK_OUTLET[2]],
        ]}
        color="#141619"
      />
      <Cable
        points={[
          [-2.55, 0.02, -1.4],
          [-0.7, 0.03, railZ],
          [1.4, 0.1, railZ],
          [BACK_OUTLET[0] + 0.1, 0.35, BACK_OUTLET[2]],
        ]}
        color="#141619"
      />
    </group>
  );
}
/* =========================================================
   CABLE
========================================================= */

function Cable({
  points,
  color = "#1a1a1a",
  radius = 0.025,
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map(
          (point) => new THREE.Vector3(...point)
        )
      ),
    [points]
  );

  const tube = useMemo(
    () =>
      new THREE.TubeGeometry(
        curve,
        96,
        radius,
        16,
        false
      ),
    [curve, radius]
  );

  return (
    <mesh geometry={tube} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={color}
        metalness={0.05}
        roughness={0.75}
        clearcoat={0.35}
        clearcoatRoughness={0.6}
      />
    </mesh>
  );
}

/* =========================================================
   DRAGGABLE PART
========================================================= */

function DraggablePart({
  part,
  installed,
  onSnap,
  setDragging,
  onHover,
}) {
  const [
    position,
    setPosition,
  ] = useState(part.start);

  const [
    hovered,
    setHovered,
  ] = useState(false);

  const [
    validTarget,
    setValidTarget,
  ] = useState(false);

  const dragging =
    useRef(false);

  const latestPosition =
    useRef(part.start);

  const {
    camera,
    gl,
  } = useThree();

  const raycaster = useMemo(
    () => new THREE.Raycaster(),
    []
  );

  const mouse = useMemo(
    () => new THREE.Vector2(),
    []
  );

  const point = useMemo(
    () => new THREE.Vector3(),
    []
  );

  const dragZ = 0.65;

  const dragPlane = useMemo(
    () =>
      new THREE.Plane(
        new THREE.Vector3(0, 0, 1),
        -dragZ
      ),
    []
  );

  const updatePosition = useCallback(
    (clientX, clientY) => {
      const rect =
        gl.domElement.getBoundingClientRect();

      mouse.set(
        ((clientX - rect.left) /
          rect.width) *
          2 -
          1,

        -(
          ((clientY - rect.top) /
            rect.height) *
            2 -
          1
        )
      );

      raycaster.setFromCamera(
        mouse,
        camera
      );

      const hit =
        raycaster.ray.intersectPlane(
          dragPlane,
          point
        );

      if (!hit) {
        return;
      }

      const nextPosition = [
        point.x,
        point.y,
        dragZ,
      ];

      latestPosition.current =
        nextPosition;

      setPosition(nextPosition);

      const dx =
        nextPosition[0] -
        part.slot[0];

      const dy =
        nextPosition[1] -
        part.slot[1];

      const distance =
        Math.hypot(dx, dy);

      setValidTarget(
        distance <=
          (part.snap ?? 0.55)
      );
    },
    [
      camera,
      gl,
      mouse,
      point,
      raycaster,
      dragPlane,
      part,
    ]
  );

  useEffect(() => {
    if (installed) {
      return undefined;
    }

    const pointerMove = (event) => {
      if (!dragging.current) {
        return;
      }

      updatePosition(
        event.clientX,
        event.clientY
      );
    };

    const pointerUp = () => {
      if (!dragging.current) {
        return;
      }

      dragging.current = false;

      setDragging(false);

      document.body.style.cursor =
        "default";

      const current =
        latestPosition.current;

      const dx =
        current[0] -
        part.slot[0];

      const dy =
        current[1] -
        part.slot[1];

      const distance =
        Math.hypot(dx, dy);

      const snapDistance =
        part.snap ?? 0.55;

      if (distance <= snapDistance) {
        latestPosition.current =
          part.slot;

        setPosition(part.slot);

        onSnap(part.id);
      } else {
        latestPosition.current =
          part.start;

        setPosition(part.start);
      }

      setValidTarget(false);
    };

    window.addEventListener(
      "pointermove",
      pointerMove
    );

    window.addEventListener(
      "pointerup",
      pointerUp
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        pointerMove
      );

      window.removeEventListener(
        "pointerup",
        pointerUp
      );
    };
  }, [
    installed,
    onSnap,
    part,
    setDragging,
    updatePosition,
  ]);

  if (installed) {
    return null;
  }

  const handlePointerDown =
    (event) => {
      event.stopPropagation();

      dragging.current = true;

      setDragging(true);

      document.body.style.cursor =
        "grabbing";

      updatePosition(
        event.clientX,
        event.clientY
      );
    };

  return (
    <group position={position}>

      <group
        onPointerDown={
          handlePointerDown
        }

        onPointerOver={(event) => {
  event.stopPropagation();
  setHovered(true);
  onHover(part.id);
  if (!dragging.current) {
    document.body.style.cursor = "grab";
  }
}}

onPointerOut={() => {
  setHovered(false);
  onHover(null);
  if (!dragging.current) {
    document.body.style.cursor = "default";
  }
}}
      >

        <PartBody
          part={part}
          hovered={
            hovered ||
            validTarget
          }
        />

        <PartVisual
          type={part.type}
        />

        <Text
          position={[
            0,
            part.size[1] / 2 + 0.28,
            0,
          ]}
          fontSize={0.15}
          color={
            validTarget
              ? "#58e88a"
              : hovered
              ? "#61ddff"
              : "#f1f5f7"
          }
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#000000"
        >
          {part.name}
        </Text>

        {validTarget && (
          <Text
            position={[
              0,
              part.size[1] / 2 + 0.10,
              0,
            ]}
            fontSize={0.075}
            color="#58e88a"
            anchorX="center"
          >
            RELEASE TO INSTALL
          </Text>
        )}

      </group>

    </group>
  );
}

/* =========================================================
   DRAGGABLE PART BODY
========================================================= */

function PartBody({
  part,
  hovered,
}) {
  return (
    <RoundedBox
      args={part.size}
      radius={0.035}
      smoothness={4}
      castShadow
    >

      <meshStandardMaterial
        color={part.color}
        metalness={
          part.type === "psu"
            ? 0.55
            : 0.7
        }
        roughness={0.25}
        emissive={
          hovered
            ? part.color
            : "#000000"
        }
        emissiveIntensity={
          hovered
            ? 0.15
            : 0
        }
      />

    </RoundedBox>
  );
}
/* =========================================================
   MATCHING DRAGGABLE CONNECTOR PLUGS
========================================================= */

function EPS8PlugVisual() {
  return (
    <group>
      {/* Black 2x4 EPS housing */}
      <RoundedBox args={[0.34, 0.22, 0.20]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color="#1a1c1e" metalness={0.2} roughness={0.55} />
      </RoundedBox>

      {/* Locking clip on top */}
      <mesh position={[0, 0.13, 0.02]}>
        <boxGeometry args={[0.10, 0.05, 0.10]} />
        <meshStandardMaterial color="#0d0e0f" roughness={0.6} />
      </mesh>

      {/* Orange accent stripe (matches EPS8 cable color) */}
      <mesh position={[0, -0.075, 0.101]}>
        <boxGeometry args={[0.30, 0.03, 0.005]} />
        <meshStandardMaterial color="#ff9f1c" emissive="#ff9f1c" emissiveIntensity={0.3} />
      </mesh>

      {/* 8 gold pins */}
      {[0, 1].map((column) =>
        [0, 1, 2, 3].map((row) => (
          <mesh key={`${column}-${row}`} position={[column === 0 ? -0.085 : 0.085, -0.06 + row * 0.043, 0.105]}>
            <boxGeometry args={[0.05, 0.03, 0.018]} />
            <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
          </mesh>
        ))
      )}

      {/* Wire bundle stub */}
      <mesh position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.14, 10]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
      </mesh>
    </group>
  );
}


function CPUFanPlugVisual() {
  return (
    <group>
      {/* Cream/white fan-header shroud (motherboard fan plugs are typically white) */}
      <RoundedBox args={[0.36, 0.15, 0.16]} radius={0.015} smoothness={2}>
        <meshStandardMaterial color="#e8e6df" metalness={0.05} roughness={0.6} />
      </RoundedBox>

      {/* Friction-latch tab */}
      <mesh position={[0.16, 0.04, 0.02]}>
        <boxGeometry args={[0.04, 0.03, 0.10]} />
        <meshStandardMaterial color="#cfcdc4" roughness={0.5} />
      </mesh>

      {/* 4 gold pins */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.12 + i * 0.08, 0, 0.085]}>
          <boxGeometry args={[0.03, 0.045, 0.018]} />
          <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Thin wire pair going into the back */}
      <mesh position={[0, 0, -0.10]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.10, 10]} />
        <meshStandardMaterial color="#111111" roughness={0.7} />
      </mesh>
    </group>
  );
}

function GPUPowerPlugVisual() {
  return (
    <group>
      {/* Wider 6-pin PCIe power housing */}
      <RoundedBox args={[0.42, 0.24, 0.22]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color="#121316" metalness={0.2} roughness={0.5} />
      </RoundedBox>

      {/* Retention clip */}
      <mesh position={[0.14, 0.14, 0.02]}>
        <boxGeometry args={[0.10, 0.05, 0.10]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>

      {/* Yellow accent stripe (matches GPU power cable color) */}
      <mesh position={[0, -0.08, 0.111]}>
        <boxGeometry args={[0.36, 0.03, 0.005]} />
        <meshStandardMaterial color="#ffd60a" emissive="#ffd60a" emissiveIntensity={0.3} />
      </mesh>

      {/* 6 gold pins (2x3) */}
      {[0, 1].map((column) =>
        [0, 1, 2].map((row) => (
          <mesh key={`${column}-${row}`} position={[column === 0 ? -0.10 : 0.10, -0.05 + row * 0.05, 0.115]}>
            <boxGeometry args={[0.05, 0.032, 0.018]} />
            <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
          </mesh>
        ))
      )}

      {/* Thick wire bundle */}
      <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.09, 0.15, 10]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
      </mesh>
    </group>
  );
}


function SATADataPlugVisual() {
  return (
    <group>
      {/* Thin, flat, L-shaped SATA data plug (black, distinct from power) */}
      <RoundedBox args={[0.40, 0.10, 0.16]} radius={0.008} smoothness={2}>
        <meshStandardMaterial color="#1c1c1c" metalness={0.15} roughness={0.5} />
      </RoundedBox>

      {/* L-key notch on one side */}
      <mesh position={[0.14, 0, 0.085]}>
        <boxGeometry args={[0.03, 0.06, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>

      {/* Blue accent tab (matches SATA data cable color) */}
      <mesh position={[-0.14, 0.055, 0.02]}>
        <boxGeometry args={[0.10, 0.015, 0.10]} />
        <meshStandardMaterial color="#3a86ff" emissive="#3a86ff" emissiveIntensity={0.25} />
      </mesh>

      {/* 7 thin gold contacts */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} position={[-0.15 + i * 0.05, 0, 0.083]}>
          <boxGeometry args={[0.02, 0.055, 0.012]} />
          <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Flat ribbon-style cable stub */}
      <mesh position={[0, 0, -0.10]}>
        <boxGeometry args={[0.14, 0.03, 0.14]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.7} />
      </mesh>
    </group>
  );
}


function SATAPowerPlugVisual() {
  return (
    <group>
      {/* Wider, flatter SATA power plug — larger than the data plug */}
      <RoundedBox args={[0.50, 0.14, 0.18]} radius={0.01} smoothness={2}>
        <meshStandardMaterial color="#161616" metalness={0.15} roughness={0.5} />
      </RoundedBox>

      {/* Locking L-key, wider than SATA data's */}
      <mesh position={[0.18, 0, 0.095]}>
        <boxGeometry args={[0.03, 0.08, 0.02]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>

      {/* Purple accent tab (matches SATA power cable color) */}
      <mesh position={[-0.17, 0.075, 0.02]}>
        <boxGeometry args={[0.12, 0.015, 0.12]} />
        <meshStandardMaterial color="#b15cff" emissive="#b15cff" emissiveIntensity={0.25} />
      </mesh>

      {/* 15 thin gold contacts */}
      {[...Array(15)].map((_, i) => (
        <mesh key={i} position={[-0.18 + i * 0.026, 0, 0.093]}>
          <boxGeometry args={[0.014, 0.07, 0.012]} />
          <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Wire bundle stub */}
      <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.075, 0.12, 10]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function CaseFanPlugVisual() {
  return (
    <group>
      {/* Small 3-pin housing, narrower than CPU fan's */}
      <RoundedBox args={[0.30, 0.14, 0.16]} radius={0.012} smoothness={2}>
        <meshStandardMaterial color="#1c1e1f" metalness={0.15} roughness={0.55} />
      </RoundedBox>

      {/* Green accent stripe (matches case fan cable color) */}
      <mesh position={[0, -0.055, 0.081]}>
        <boxGeometry args={[0.22, 0.02, 0.005]} />
        <meshStandardMaterial color="#20c997" emissive="#20c997" emissiveIntensity={0.3} />
      </mesh>

      {/* 3 gold pins */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.08 + i * 0.08, 0.015, 0.085]}>
          <boxGeometry args={[0.03, 0.045, 0.018]} />
          <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Thin wire pair */}
      <mesh position={[0, 0, -0.10]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.10, 10]} />
        <meshStandardMaterial color="#111111" roughness={0.7} />
      </mesh>
    </group>
  );
}


function PowerSWPlugVisual() {
  return (
    <group>
      {/* Tiny 2-pin front-panel header plug */}
      <RoundedBox args={[0.18, 0.11, 0.13]} radius={0.01} smoothness={2}>
        <meshStandardMaterial color="#202226" metalness={0.15} roughness={0.55} />
      </RoundedBox>

      {/* 2 gold pins */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[-0.04 + i * 0.08, 0, 0.068]}>
          <boxGeometry args={[0.028, 0.045, 0.016]} />
          <meshStandardMaterial color="#d6b451" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Twin thin wires (typical front-panel switch cable pair) */}
      <mesh position={[-0.03, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.02, 0.08, 8]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.6} />
      </mesh>
      <mesh position={[0.03, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.02, 0.08, 8]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* =========================================================
   PART VISUAL
========================================================= */

function PartVisual({
  type,
}) {
  switch (type) {

    case "cpu":
      return <CPUVisual />;

    case "cooler":
      return <CoolerVisual />;

    case "ram":
      return <RAMVisual />;

    case "gpu":
      return <GPUVisual />;

    case "ssd":
      return <SSDVisual />;

    case "psu":
      return <PSUVisual />;

    case "fan":
      return <FanVisualSmall />;

    case "hdd":
      return <HDDVisual />;

    case "chipset":
      return <ChipsetVisual />;

    case "pcieWifi":
      return (
        <PCIeExpansionVisual
          label="WI-FI"
        />
      );

    case "pcieSound":
      return (
        <PCIeExpansionVisual
          label="SOUND"
        />
      );

    case "cmos":
      return <CMOSVisual />;

    case "atx24":
      return <ATX24Visual />;

    case "eps8":
  return <EPS8PlugVisual />;

case "cpuFan":
  return <CPUFanPlugVisual />;

case "gpuPower":
  return <GPUPowerPlugVisual />;

case "sataData":
  return <SATADataPlugVisual />;

case "sataPower":
  return <SATAPowerPlugVisual />;

case "caseFan":
  return <CaseFanPlugVisual />;

case "powerSW":
  return <PowerSWPlugVisual />;
  }
}

/* =========================================================
   CONNECTION STORAGE VISUALS
========================================================= */
function ConnectorVisual({ label, pins = 4 }) {
  const columns = pins <= 4 ? 2 : 4;
  const rows = Math.ceil(pins / columns);

  return (
    <group>
      <RoundedBox
        args={[0.28, 0.18, 0.18]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#0b0d0f"
          metalness={0.45}
          roughness={0.32}
        />
      </RoundedBox>

      {[...Array(pins)].map((_, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        return (
          <mesh
            key={i}
            position={[
              (col - (columns - 1) / 2) * 0.065,
              0.095,
              (row - (rows - 1) / 2) * 0.065,
            ]}
          >
            <boxGeometry args={[0.035, 0.018, 0.035]} />
            <meshStandardMaterial
              color="#c8a84e"
              metalness={0.9}
              roughness={0.12}
            />
          </mesh>
        );
      })}

      <Text
        position={[0, 0.19, 0]}
        fontSize={0.055}
        color="#a7b3ba"
        anchorX="center"
      >
        {label}
      </Text>
    </group>
  );
}

function CableConnectorVisual({ label, color }) {
  return (
    <group>
      <RoundedBox
        args={[0.22, 0.16, 0.14]}
        radius={0.012}
        smoothness={2}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.38}
        />
      </RoundedBox>

      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[0.15, 0.025, 0.025]} />
        <meshStandardMaterial color="#c7a64b" metalness={0.8} roughness={0.2} />
      </mesh>

      <Text
        position={[0, 0.18, 0]}
        fontSize={0.052}
        color="#a7b3ba"
        anchorX="center"
      >
        {label}
      </Text>
    </group>
  );
}

/* =========================================================
   CPU STORAGE VISUAL
========================================================= */

function CPUVisual() {
  return (
    <RoundedBox
      args={[0.32, 0.025, 0.32]}
      position={[0, 0.055, 0]}
      radius={0.01}
      smoothness={2}
    >

      <meshStandardMaterial
        color="#aeb3b7"
        metalness={0.85}
        roughness={0.18}
      />

    </RoundedBox>
  );
}

/* =========================================================
   COOLER STORAGE VISUAL
========================================================= */

function CoolerVisual() {
  return (
    <group>

      {[...Array(7)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.32 +
                index * 0.107,
              0.17,
              0,
            ]}
          >

            <boxGeometry
              args={[
                0.025,
                0.24,
                0.78,
              ]}
            />

            <meshStandardMaterial
              color="#70777d"
              metalness={0.75}
              roughness={0.22}
            />

          </mesh>
        )
      )}

    </group>
  );
}

/* =========================================================
   RAM STORAGE VISUAL
========================================================= */

function RAMVisual() {
  return (
    <group>

      <mesh
        position={[0, 0, 0.04]}
      >

        <boxGeometry
          args={[0.09, 0.62, 0.02]}
        />

        <meshStandardMaterial
          color="#0c0f12"
        />

      </mesh>

      {[...Array(9)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              0,
              -0.25 +
                index * 0.062,
              0.055,
            ]}
          >

            <boxGeometry
              args={[
                0.10,
                0.012,
                0.012,
              ]}
            />

            <meshStandardMaterial
              color="#d0ae4b"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

    </group>
  );
}

/* =========================================================
   GPU STORAGE VISUAL
========================================================= */

function GPUVisual() {
  return (
    <group>

      {[-0.48, 0, 0.48].map(
        (x, index) => (
          <group
            key={index}
            position={[x, 0.12, 0]}
          >

            <mesh
              rotation={[
                Math.PI / 2,
                0,
                0,
              ]}
            >

              <cylinderGeometry
                args={[
                  0.19,
                  0.19,
                  0.035,
                  24,
                ]}
              />

              <meshStandardMaterial
                color="#0a0d10"
                metalness={0.45}
                roughness={0.3}
              />

            </mesh>

            <mesh
              rotation={[
                Math.PI / 2,
                0,
                0,
              ]}
            >

              <cylinderGeometry
                args={[
                  0.055,
                  0.055,
                  0.04,
                  16,
                ]}
              />

              <meshStandardMaterial
                color="#4387d5"
                emissive="#1d4c83"
                emissiveIntensity={0.3}
              />

            </mesh>

          </group>
        )
      )}

    </group>
  );
}

/* =========================================================
   SSD STORAGE VISUAL
========================================================= */

function SSDVisual() {
  return (
    <group>

      {[...Array(10)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.30 +
                index * 0.065,
              0.035,
              0,
            ]}
          >

            <boxGeometry
              args={[
                0.025,
                0.02,
                0.075,
              ]}
            />

            <meshStandardMaterial
              color="#d3b04d"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

    </group>
  );
}

/* =========================================================
   PSU STORAGE VISUAL
========================================================= */

function PSUVisual() {
  return (
    <group>

      <mesh
        position={[0, 0.34, 0]}
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
      >

        <cylinderGeometry
          args={[
            0.27,
            0.27,
            0.05,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#080a0c"
          metalness={0.35}
          roughness={0.45}
        />

      </mesh>

      <Text
        position={[0, 0.02, 0.67]}
        fontSize={0.07}
        color="#9ca6ac"
        anchorX="center"
      >
        750W
      </Text>

    </group>
  );
}

/* =========================================================
   FAN STORAGE VISUAL
========================================================= */

function FanVisualSmall() {
  return (
    <FanVisual
      position={[0, 0, 0]}
    />
  );
}

/* =========================================================
   HDD STORAGE VISUAL
========================================================= */

function HDDVisual() {
  return (
    <group>
      <RoundedBox
        args={[0.80, 0.22, 0.50]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#5f666d"
          metalness={0.65}
          roughness={0.28}
        />
      </RoundedBox>

      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.58, 0.018, 0.32]} />
        <meshStandardMaterial
          color="#292e33"
          metalness={0.6}
          roughness={0.30}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   CHIPSET STORAGE VISUAL
========================================================= */

function ChipsetVisual() {
  return (
    <group>

      <RoundedBox
        args={[
          0.58,
          0.08,
          0.44,
        ]}
        radius={0.02}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#252c32"
          metalness={0.72}
          roughness={0.24}
        />

      </RoundedBox>

      <RoundedBox
        args={[
          0.38,
          0.025,
          0.28,
        ]}
        position={[
          0,
          0.055,
          0,
        ]}
        radius={0.01}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#59646c"
          metalness={0.8}
          roughness={0.18}
        />

      </RoundedBox>

    </group>
  );
}

/* =========================================================
   PCIe EXPANSION CARD STORAGE VISUAL
========================================================= */

function PCIeExpansionVisual({
  label,
}) {
  return (
    <group>

      <RoundedBox
        args={[
          1.55,
          0.10,
          0.32,
        ]}
        radius={0.015}
        smoothness={3}
      >

        <meshStandardMaterial
          color="#1a2830"
          metalness={0.5}
          roughness={0.28}
        />

      </RoundedBox>

      {[...Array(16)].map(
        (_, index) => (
          <mesh
            key={index}
            position={[
              -0.70 +
                index * 0.092,
              -0.01,
              -0.19,
            ]}
          >

            <boxGeometry
              args={[
                0.035,
                0.022,
                0.05,
              ]}
            />

            <meshStandardMaterial
              color="#c5a34b"
              metalness={0.9}
              roughness={0.12}
            />

          </mesh>
        )
      )}

      <Text
        position={[
          0,
          0.08,
          0,
        ]}
        fontSize={0.065}
        color="#9fc7d8"
        anchorX="center"
      >
        {label}
      </Text>

    </group>
  );
}

/* =========================================================
   CMOS BATTERY STORAGE VISUAL
========================================================= */

function CMOSVisual() {
  return (
    <group>

      <mesh
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
      >

        <cylinderGeometry
          args={[
            0.18,
            0.18,
            0.06,
            32,
          ]}
        />

        <meshStandardMaterial
          color="#cfd2d4"
          metalness={0.85}
          roughness={0.16}
        />

      </mesh>

    </group>
  );
}

/* =========================================================
   24-PIN ATX CONNECTOR STORAGE VISUAL
========================================================= */

function ATX24Visual() {
  return (
    <group>

      <RoundedBox
        args={[
          0.20,
          0.90,
          0.15,
        ]}
        radius={0.012}
        smoothness={2}
      >

        <meshStandardMaterial
          color="#090b0d"
          metalness={0.35}
          roughness={0.38}
        />

      </RoundedBox>

      {[0, 1].map(
        (column) => (
          <group
            key={column}
          >

            {[...Array(12)].map(
              (_, row) => (
                <mesh
                  key={row}
                  position={[
                    column === 0
                      ? -0.055
                      : 0.055,
                    -0.39 +
                      row * 0.071,
                    0.08,
                  ]}
                >

                  <boxGeometry
                    args={[
                      0.032,
                      0.032,
                      0.012,
                    ]}
                  />

                  <meshStandardMaterial
                    color="#c9aa50"
                    metalness={0.9}
                    roughness={0.12}
                  />

                </mesh>
              )
            )}

          </group>
        )
      )}

    </group>
  );
}

