// ======================
// EAH Jena Avatar Assistant — Backend
// ======================
//
// Small Express server that holds your Anthropic API key and proxies
// chat requests from the browser. Run this alongside your Vite frontend.
//
// Setup:
//   npm install express cors @anthropic-ai/sdk dotenv
//   create a .env file with: ANTHROPIC_API_KEY=your-key-here
//   node server.js

import express from "express"
import cors from "cors"
import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
})

// System prompt: keeps the assistant grounded to EAH Jena and gives it
// a persona. Edit this freely as you learn more about what visitors ask.
const SYSTEM_PROMPT = `You are the virtual assistant avatar for Ernst-Abbe-Hochschule Jena (EAH Jena), a university of applied sciences in Jena, Germany.

Facts you can rely on:
- Founded 1991, renamed Ernst-Abbe-Hochschule in 2014, named after Ernst Abbe.
- Around 4,200 students.
- Campus on Carl-Zeiss-Promenade in Jena, Thuringia.
- About 50 bachelor's and master's programs across four fields: technology, business, social affairs, and health.
- Most programs are admission-free; many are tuition-free.
- Typical application deadlines: July 15 (winter semester), February 15 (summer semester).

Guidelines:
- Keep answers short and spoken-friendly (2-4 sentences), since they'll be read aloud by text-to-speech.
- Be warm and welcoming, like a campus tour guide.
- If you don't know a specific detail (exact deadlines for a particular program, staff names, current events), say so honestly and suggest checking eah-jena.de rather than guessing.
- Don't make up statistics, rankings, or facts not listed above.`

app.post("/api/chat", async (req, res) => {
    try {
        const { question, history = [] } = req.body

        if (!question || typeof question !== "string") {
            return res.status(400).json({ error: "Missing question" })
        }

        const messages = [
            ...history,
            { role: "user", content: question }
        ]

        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
            system: SYSTEM_PROMPT,
            messages
        })

        const answer = response.content
            .filter(block => block.type === "text")
            .map(block => block.text)
            .join("\n")

        res.json({ answer })

    } catch (err) {
        console.error("Claude API error:", err)
        res.status(500).json({ error: "Something went wrong talking to Claude." })
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`EAH Jena assistant backend running on http://localhost:${PORT}`)
})