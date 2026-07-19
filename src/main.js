import './style.css'

import * as THREE from 'three'

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import {
    VRMLoaderPlugin,
    VRMUtils
} from '@pixiv/three-vrm'

// Your project already has this at src/assets/EAH_Logo.png
import eahLogoUrl from './assets/EAH_Logo.png'


// ======================
// EAH Jena Knowledge Base
// (Edit / expand this freely — this is what the avatar "knows")
// ======================

const KNOWLEDGE_BASE = [
    {
        keywords: ["what is eah", "about eah", "who are you", "what university", "welcome"],
        answer: "I'm the virtual assistant for Ernst-Abbe-Hochschule Jena, EAH Jena for short. We're a university of applied sciences in Jena, Germany, founded in 1991, with around four thousand two hundred students."
    },
    {
        keywords: ["program", "study", "course", "degree", "faculty", "faculties"],
        answer: "EAH Jena offers about fifty bachelor's and master's programs across four fields: technology, business, social affairs, and health. That includes subjects like electrical engineering, mechanical engineering, medical engineering and biotechnology, business administration, and health and nursing."
    },
    {
        keywords: ["location", "where", "address", "campus"],
        answer: "Our campus is on the Carl-Zeiss-Promenade in Jena, in the state of Thuringia, Germany."
    },
    {
        keywords: ["admission", "apply", "application", "deadline", "enroll"],
        answer: "Most of our programs are admission-free, and many are also tuition-free. Application deadlines are typically July 15th for the winter semester and February 15th for the summer semester, though it's best to check the specific program page for exact dates."
    },
    {
        keywords: ["history", "founded", "when was", "ernst abbe"],
        answer: "The university was founded in 1991 and took the name Ernst-Abbe-Hochschule in 2014, named after Ernst Abbe, a researcher, entrepreneur, and social reformer connected to the Zeiss and Jena scientific tradition."
    },
    {
        keywords: ["hello", "hi", "hey"],
        answer: "Hello! Welcome to EAH Jena. What would you like to know?"
    },
    {
        keywords: ["thank", "thanks"],
        answer: "You're very welcome! Let me know if there's anything else you'd like to know about EAH Jena."
    }
]

const FALLBACK_ANSWER =
    "That's a great question — I don't have that detail yet, but I'd recommend checking eah-jena.de or asking at the student services desk for the most accurate answer."

function findAnswer(question) {
    const q = question.toLowerCase()
    for (const entry of KNOWLEDGE_BASE) {
        if (entry.keywords.some(k => q.includes(k))) {
            return entry.answer
        }
    }
    return FALLBACK_ANSWER
}

// ======================
// Backend-powered answers (Claude API via your own server)
// ======================
//
// NEVER call api.anthropic.com directly from this file — your API key would
// be visible to anyone who opens dev tools. Instead this hits a small local
// backend (see server.js) that holds the key and proxies the request.
//
// If the backend is unreachable (not running, no internet, etc.) this falls
// back to the local keyword FAQ so the demo still works offline.

const CHAT_ENDPOINT = "http://localhost:3001/api/chat"

// Keep a short running history so the assistant has conversational context
let conversationHistory = []

async function getAnswer(question) {
    try {
        const response = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                history: conversationHistory
            })
        })

        if (!response.ok) throw new Error("Backend returned " + response.status)

        const data = await response.json()

        conversationHistory.push({ role: "user", content: question })
        conversationHistory.push({ role: "assistant", content: data.answer })

        // Keep history short so requests don't balloon
        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(-10)
        }

        return data.answer

    } catch (err) {
        console.warn("Backend unreachable, using local FAQ fallback:", err)
        return findAnswer(question)
    }
}


// ======================
// Scene background
// ======================
//
// A flat color reads flat. This paints a soft vertical gradient onto a
// canvas and uses it as the scene background — same brand teal as the
// EAH Jena logo, sampled directly at #009898, so the 3D scene and the
// chat interface feel like one design instead of two things bolted
// together.
//
// Swap this out for a real environment map (HDRI) or a campus photo later
// if you want a literal setting — see the comment at the bottom of this
// function for how.

function createGradientBackground() {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 512

    const ctx = canvas.getContext("2d")
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)

    // Top: brand teal haze -> bottom: light paper tone (matches --paper-100)
    gradient.addColorStop(0, "#007373")
    gradient.addColorStop(0.45, "#a9d6d6")
    gradient.addColorStop(1, "#f5f7f7")

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    return texture

    // To use a real photo of the EAH Jena campus instead, drop an image in
    // /public and replace this whole function's body with:
    //   return new THREE.TextureLoader().load('/campus-background.jpg')
}


// ======================
// Scene
// ======================

const scene = new THREE.Scene()

scene.background = createGradientBackground()

// Soft shadow-catcher plane so the avatar feels grounded rather than floating
const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 64),
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 1
    })
)
ground.rotation.x = -Math.PI / 2
ground.position.y = 0
scene.add(ground)


// ======================
// Loading overlay + university badge (DOM chrome)
// ======================

function buildLoadingOverlay() {
    const overlay = document.createElement("div")
    overlay.id = "loading-overlay"

    const spinner = document.createElement("div")
    spinner.className = "loading-spinner"

    const text = document.createElement("div")
    text.className = "loading-text"
    text.textContent = "Loading assistant..."

    overlay.appendChild(spinner)
    overlay.appendChild(text)
    document.body.appendChild(overlay)
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay")
    if (overlay) overlay.classList.add("hidden")
}

function buildBadge() {
    const badge = document.createElement("div")
    badge.id = "uni-badge"

    const logo = document.createElement("img")
    logo.id = "badge-logo"
    logo.src = eahLogoUrl
    logo.alt = "EAH Jena logo"

    const textCol = document.createElement("div")
    textCol.id = "badge-text"

    const title = document.createElement("div")
    title.className = "badge-title"
    title.textContent = "Ernst-Abbe-Hochschule Jena"

    const sub = document.createElement("div")
    sub.className = "badge-sub"
    sub.textContent = "Virtual Campus Assistant"

    textCol.appendChild(title)
    textCol.appendChild(sub)

    badge.appendChild(logo)
    badge.appendChild(textCol)
    document.body.appendChild(badge)
}

function buildVignette() {
    const v = document.createElement("div")
    v.className = "vignette-overlay"
    document.body.appendChild(v)
}

buildLoadingOverlay()
buildBadge()
buildVignette()


// ======================
// Camera
// ======================

const camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
)

camera.position.set(0, 1.4, 3)


// ======================
// Renderer
// ======================

const renderer = new THREE.WebGLRenderer({ antialias: true })

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)

document.body.appendChild(renderer.domElement)


// ======================
// Controls
// ======================

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.2, 0)
controls.update()


// ======================
// Lights
// ======================

const directionalLight = new THREE.DirectionalLight(0xffffff, 3)
directionalLight.position.set(1, 2, 3)
scene.add(directionalLight)

scene.add(new THREE.AmbientLight(0xffffff, 1))


// ======================
// VRM Loading
// ======================

let currentVrm = null

const loader = new GLTFLoader()

loader.register((parser) => new VRMLoaderPlugin(parser))

loader.load(
    '/models/avatar_2.vrm',
    (gltf) => {
        const vrm = gltf.userData.vrm

        VRMUtils.rotateVRM0(vrm)

        currentVrm = vrm

        scene.add(vrm.scene)

        vrm.scene.rotation.y = Math.PI
        vrm.scene.position.set(0, 0, 0)

        if (vrm.humanoid) {
            vrm.humanoid.resetNormalizedPose()
            setIdlePose(vrm)
        }

        console.log("Avatar loaded!", vrm)

        hideLoadingOverlay()
        startIdleBlinking(vrm)

        // Greet once loaded and voices are ready
        whenVoicesReady(() => {
            setTimeout(() => {
                triggerWaveGesture()
                speak("Hello, how can I assist you today? I'm the virtual assistant for EAH Jena.")
            }, 800)
        })
    },
    undefined,
    (error) => {
        console.error("VRM loading error:", error)
    }
)


// ======================
// Idle pose (fixes the default T-pose)
// ======================
//
// VRM models load in their raw bind pose, which is almost always a T-pose.
// There's no built-in "idle" pose — you either rotate bones manually (quick,
// what we do here) or play an idle animation clip (.vrma / retargeted mixamo
// fbx via an AnimationMixer, which looks more natural but takes more setup).
//
// If the arms rotate the WRONG way for your model (some rigs are mirrored),
// just flip the sign on the rotation.z values below.

// Filled in by setIdlePose, read every frame by applyIdleSway / applyGesture
let idleBones = {}
let idleBase = {}

function setIdlePose(vrm) {
    if (!vrm.humanoid) return

    const bones = {
        leftUpperArm: vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),
        rightUpperArm: vrm.humanoid.getNormalizedBoneNode('rightUpperArm'),
        leftLowerArm: vrm.humanoid.getNormalizedBoneNode('leftLowerArm'),
        rightLowerArm: vrm.humanoid.getNormalizedBoneNode('rightLowerArm'),
        leftHand: vrm.humanoid.getNormalizedBoneNode('leftHand'),
        rightHand: vrm.humanoid.getNormalizedBoneNode('rightHand'),
        // Not every VRM model rigs individual fingers — these are optional
        leftIndexProximal: vrm.humanoid.getNormalizedBoneNode('leftIndexProximal'),
        rightIndexProximal: vrm.humanoid.getNormalizedBoneNode('rightIndexProximal'),
        leftMiddleProximal: vrm.humanoid.getNormalizedBoneNode('leftMiddleProximal'),
        rightMiddleProximal: vrm.humanoid.getNormalizedBoneNode('rightMiddleProximal')
    }

    // Bring upper arms down from horizontal (T-pose) to roughly vertical
    if (bones.leftUpperArm) bones.leftUpperArm.rotation.z = Math.PI * 0.42
    if (bones.rightUpperArm) bones.rightUpperArm.rotation.z = -Math.PI * 0.42

    // Slight bend at the elbow so it doesn't look robotic
    if (bones.leftLowerArm) bones.leftLowerArm.rotation.y = -0.15
    if (bones.rightLowerArm) bones.rightLowerArm.rotation.y = 0.15

    // Relax the hands slightly too
    if (bones.leftHand) bones.leftHand.rotation.z = 0.05
    if (bones.rightHand) bones.rightHand.rotation.z = -0.05

    idleBones = bones

    // Snapshot this resting pose — sway and gestures animate AROUND these
    // values rather than replacing them, so the avatar always settles
    // back to the same relaxed stance.
    idleBase = {}
    for (const key in bones) {
        if (bones[key]) idleBase[key] = bones[key].rotation.clone()
    }
}


// ======================
// Idle sway ("körperlich" — a little physical presence)
// ======================
//
// Small, slow, out-of-phase sine offsets on the arms/hands/fingers so the
// avatar doesn't look frozen between blinks. Amplitudes are deliberately
// tiny (a few degrees) — the goal is "breathing/alive," not "gesturing."

function applyIdleSway(elapsed) {
    const b = idleBones
    const base = idleBase

    if (b.leftUpperArm && base.leftUpperArm) {
        b.leftUpperArm.rotation.z = base.leftUpperArm.z + Math.sin(elapsed * 0.6) * 0.025
        b.leftUpperArm.rotation.x = base.leftUpperArm.x + Math.sin(elapsed * 0.4 + 1.3) * 0.02
    }
    if (b.rightUpperArm && base.rightUpperArm) {
        b.rightUpperArm.rotation.z = base.rightUpperArm.z + Math.sin(elapsed * 0.55 + 2) * 0.025
        b.rightUpperArm.rotation.x = base.rightUpperArm.x + Math.sin(elapsed * 0.45 + 0.7) * 0.02
    }
    if (b.leftLowerArm && base.leftLowerArm) {
        b.leftLowerArm.rotation.y = base.leftLowerArm.y + Math.sin(elapsed * 0.5 + 0.5) * 0.03
    }
    if (b.rightLowerArm && base.rightLowerArm) {
        b.rightLowerArm.rotation.y = base.rightLowerArm.y + Math.sin(elapsed * 0.52 + 1.8) * 0.03
    }
    if (b.leftHand && base.leftHand) {
        b.leftHand.rotation.z = base.leftHand.z + Math.sin(elapsed * 0.8 + 1) * 0.05
        b.leftHand.rotation.x = Math.sin(elapsed * 0.35) * 0.04
    }
    if (b.rightHand && base.rightHand) {
        b.rightHand.rotation.z = base.rightHand.z + Math.sin(elapsed * 0.75 + 2.2) * 0.05
        b.rightHand.rotation.x = Math.sin(elapsed * 0.38 + 1) * 0.04
    }

    // Fingers, if the rig has them — a very subtle curl drift
    if (b.leftIndexProximal) b.leftIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.7) * 0.03
    if (b.rightIndexProximal) b.rightIndexProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.72 + 2.4) * 0.03
    if (b.leftMiddleProximal) b.leftMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.65 + 1) * 0.03
    if (b.rightMiddleProximal) b.rightMiddleProximal.rotation.x = 0.05 + Math.sin(elapsed * 0.68 + 3) * 0.03
}


// ======================
// One-off gestures (e.g. a wave on greeting)
// ======================
//
// Runs on top of idle sway for a fixed duration, then hands control back.
// If the wave lifts the wrong arm or bends the wrong way on your rig,
// flip the signs the same way as in setIdlePose above.

let activeGesture = null // { type, startTime, duration }

function triggerWaveGesture() {
    if (!idleBones.rightUpperArm) return
    activeGesture = { type: 'wave', startTime: clock.getElapsedTime(), duration: 1.8 }
}

function applyActiveGesture() {
    if (!activeGesture) return

    const t = clock.getElapsedTime() - activeGesture.startTime

    if (t > activeGesture.duration) {
        activeGesture = null
        return
    }

    if (activeGesture.type === 'wave') {
        const b = idleBones
        const base = idleBase
        // Ease the arm up over the first 0.4s, hold, then let the
        // duration cutoff above return control to idle sway.
        const lift = Math.min(t / 0.4, 1)

        if (b.rightUpperArm && base.rightUpperArm) {
            b.rightUpperArm.rotation.z = base.rightUpperArm.z - lift * 1.1
            b.rightUpperArm.rotation.x = base.rightUpperArm.x - lift * 0.25
        }
        if (b.rightLowerArm && base.rightLowerArm) {
            b.rightLowerArm.rotation.y = base.rightLowerArm.y - lift * 0.5
        }
        if (b.rightHand) {
            // wrist wave, ramping in with `lift`
            b.rightHand.rotation.z = Math.sin(t * 9) * 0.3 * lift
        }
    }
}


// ======================
// Idle blinking (natural, randomized)
// ======================

function startIdleBlinking(vrm) {
    if (!vrm.expressionManager) return

    function blinkLoop() {
        const nextBlinkIn = 2000 + Math.random() * 4000 // every 2-6s

        setTimeout(() => {
            vrm.expressionManager.setValue("blink", 1)

            setTimeout(() => {
                vrm.expressionManager.setValue("blink", 0)
                blinkLoop()
            }, 150)
        }, nextBlinkIn)
    }

    blinkLoop()
}


// ======================
// Speech + basic lip-sync
// ======================

let voicesCache = []
let voicesReadyCallbacks = []
let voicesReady = false

function whenVoicesReady(cb) {
    if (voicesReady) {
        cb()
    } else {
        voicesReadyCallbacks.push(cb)
    }
}

function loadVoices() {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
        voicesCache = voices
        voicesReady = true
        voicesReadyCallbacks.forEach(cb => cb())
        voicesReadyCallbacks = []
    }
}

// Some browsers have voices immediately, others fire the event later
loadVoices()
window.speechSynthesis.onvoiceschanged = loadVoices

function pickVoice() {
    return voicesCache.find(v =>
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("jenny") ||
        v.name.toLowerCase().includes("aria") ||
        v.name.toLowerCase().includes("female")
    )
}

let mouthOpen = false
let mouthInterval = null

function startLipSync(vrm) {
    if (!vrm || !vrm.expressionManager) return

    mouthInterval = setInterval(() => {
        mouthOpen = !mouthOpen
        const value = mouthOpen ? 0.6 + Math.random() * 0.3 : 0
        // Most VRM avatars expose "aa" as an open-mouth viseme
        vrm.expressionManager.setValue("aa", value)
    }, 110)
}

function stopLipSync(vrm) {
    if (mouthInterval) {
        clearInterval(mouthInterval)
        mouthInterval = null
    }
    if (vrm && vrm.expressionManager) {
        vrm.expressionManager.setValue("aa", 0)
    }
}

function speak(text) {
    setSubtitle(text)

    const speech = new SpeechSynthesisUtterance(text)

    const voice = pickVoice()
    if (voice) {
        speech.voice = voice
        console.log("Using voice:", voice.name)
    }

    speech.lang = "en-US"
    speech.pitch = 1.5
    speech.rate = 1.05

    speech.onstart = () => startLipSync(currentVrm)
    speech.onend = () => {
        stopLipSync(currentVrm)
        setSubtitle("")
    }
    speech.onerror = () => {
        stopLipSync(currentVrm)
        setSubtitle("")
    }

    window.speechSynthesis.speak(speech)
}


// ======================
// Chat UI (text input + mic)
// ======================

function buildChatUI() {
    const container = document.createElement("div")
    container.id = "chat-ui"

    const subtitle = document.createElement("div")
    subtitle.id = "avatar-subtitle"

    const row = document.createElement("div")
    row.className = "chat-row"

    const input = document.createElement("input")
    input.id = "chat-input"
    input.type = "text"
    input.placeholder = "Ask me about EAH Jena..."

    const micBtn = document.createElement("button")
    micBtn.id = "mic-btn"
    micBtn.className = "chat-btn"
    micBtn.textContent = "🎤"
    micBtn.title = "Ask by voice"

    const sendBtn = document.createElement("button")
    sendBtn.id = "send-btn"
    sendBtn.className = "chat-btn"
    sendBtn.textContent = "Send"

    row.appendChild(input)
    row.appendChild(micBtn)
    row.appendChild(sendBtn)

    container.appendChild(subtitle)
    container.appendChild(row)
    document.body.appendChild(container)

    async function handleQuestion(text) {
        if (!text || !text.trim()) return
        input.value = ""

        setSubtitle("Thinking...")

        const answer = await getAnswer(text)
        speak(answer)
    }

    sendBtn.addEventListener("click", () => handleQuestion(input.value))
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleQuestion(input.value)
    })

    // Optional: voice input via Web Speech API (Chrome/Edge support it)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.lang = "en-US"
        recognition.interimResults = false

        micBtn.addEventListener("click", () => {
            micBtn.classList.add("listening")
            micBtn.textContent = "●"
            recognition.start()
        })

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript
            input.value = transcript
            handleQuestion(transcript)
        }

        recognition.onend = () => {
            micBtn.classList.remove("listening")
            micBtn.textContent = "🎤"
        }

        recognition.onerror = () => {
            micBtn.classList.remove("listening")
            micBtn.textContent = "🎤"
        }
    } else {
        micBtn.disabled = true
        micBtn.title = "Voice input not supported in this browser"
    }
}

function setSubtitle(text) {
    const el = document.getElementById("avatar-subtitle")
    if (!el) return
    if (text) {
        el.textContent = text
        el.classList.add("visible")
    } else {
        el.classList.remove("visible")
    }
}

buildChatUI()


// ======================
// Animation
// ======================

const clock = new THREE.Clock()

function animate() {
    requestAnimationFrame(animate)

    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    if (currentVrm) {
        // Bone rotations must be set BEFORE vrm.update() — that's what
        // syncs the normalized bone nodes to the actual skeleton.
        applyIdleSway(elapsed)
        applyActiveGesture()

        currentVrm.update(delta)

        // very small breathing
        currentVrm.scene.position.y = Math.sin(Date.now() * 0.0015) * 0.005
    }

    renderer.render(scene, camera)
}

animate()


// ======================
// Resize
// ======================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})