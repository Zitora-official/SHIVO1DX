const box = document.getElementById('display-box'),
    input = document.getElementById('command-input'),
    send = document.getElementById('send-btn');

// Global variable to store the raw command queue array for LlamaLab Automate execution
let activeCommandQueue = null;

const sendMsg = async () => {
    const text = input.value.trim();
    if (!text) return;

    // 1. Show User Message on the RIGHT
    box.insertAdjacentHTML('beforeend', `<div class="msg-user">${text}</div>`);
    input.value = '';
    box.scrollTop = box.scrollHeight;

    // 2. Create container for SHI.VOID status trace and response on the LEFT
    const aiResponseId = 'log_' + Date.now();
    box.insertAdjacentHTML('beforeend', `
        <div class="msg-ai" id="${aiResponseId}">
            <p class="status-log">Sending data to SHI.V01D...</p>
        </div>
    `);
    box.scrollTop = box.scrollHeight;
    const aiContainer = document.getElementById(aiResponseId);

    // 3. Send to Groq
    const result = await processCommandWithGroq(text, aiContainer);
    console.log("Groq Result Object:", result);

    if (result) {
        // Handle casual chat or identity responses naturally
        if (result.type === "chat") {
            aiContainer.innerHTML = `<p style="color: #00ffcc;">${result.response}</p>`;
            box.scrollTop = box.scrollHeight;
            speakResponse(result.response);
            return;
        }

        if (!result) return;

        // === VALIDATION STEP 1: Structure & Type Verification ===
        if (typeof result !== 'object' || !result.type) {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[VALIDATION ERROR] Invalid response structure from SHIVOID.</p>`;
            return;
        }

        if (result.type === "command" && (!Array.isArray(result.commands) || result.commands.length === 0)) {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[VALIDATION ERROR] Command queue is empty or malformed.</p>`;
            return;
        }

        // === VALIDATION STEP 2: Smart Field Check & Fallbacks ===
        if (result.type === "command") {
            for (let i = 0; i < result.commands.length; i++) {
                const cmd = result.commands[i];

                // Strict check only for absolute essentials
                if (!cmd.id || !cmd.action) {
                    aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[VALIDATION ERROR] Command #${i + 1} is missing 'id' or 'action'.</p>`;
                    return;
                }

                // Apply defaults for optional/missing fields
                if (!cmd.device) {
                    cmd.device = "phone"; // Default fallback device
                }
                if (!cmd.parameters) {
                    cmd.parameters = {}; // Default empty parameter object
                }
            }
        }

        // === VALIDATION STEP 3: Device Whitelisting & Normalization ===
        const allowedDevices = ['phone', 'pc', 'tablet'];
        if (result.type === "command") {
            for (let i = 0; i < result.commands.length; i++) {
                const cmd = result.commands[i];

                // Normalize aliases (e.g. "laptop" or "computer" -> "pc")
                if (cmd.device === 'laptop' || cmd.device === 'computer') {
                    cmd.device = 'pc';
                }

                if (cmd.device === 'tab') {
                    cmd.device = 'tablet';
                }

                // Normalize device name to lowercase for consistency
                cmd.device = cmd.device.toLowerCase();

                if (!allowedDevices.includes(cmd.device)) {
                    aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[VALIDATION ERROR] Unsupported target device: '${cmd.device}'.</p>`;
                    speakResponse(`Sir you did not add device, ${cmd.device}`);
                    return;
                }
            }
        }

        // Otherwise, handle as an active command queue
        activeCommandQueue = result;
        console.log("Command Queue (Raw Saved):", activeCommandQueue);

        // BUILD COMMAND LIST BEFORE EXECUTION
        let listHtml = `
    <p><strong>SHI.VOID Queue:</strong></p>
    <ul class="command-list">
`;

        result.commands.forEach((cmd, index) => {

            let paramsStr = Object.entries(cmd.parameters || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ');

            listHtml += `
        <li id="command-${index}" class="command-pending">
            <strong>#${index + 1} [${cmd.device.toUpperCase()}]</strong>
            → Action: <code>${cmd.action}</code>
            <br>
            <small>${paramsStr}</small>
        </li>
    `;
        });

        listHtml += `</ul>`;

        aiContainer.innerHTML = `
    <p class="status-log" style="color: #00ffcc;">
        ✓ Command queue received. Preparing execution...
    </p>
    ${listHtml}
`;

        box.scrollTop = box.scrollHeight;



        // -> BUILD DYNAMIC SPOKEN SUMMARY FROM COMMANDS

        let spokenText = `Alright sir, executing ${result.commands.length} ${result.commands.length === 1 ? "command" : "commands"
            }. `;

        result.commands.forEach((cmd) => {
            const params = cmd.parameters || {};

            if (cmd.action === "open_app") {
                spokenText += `Opening ${params.app_name || "the requested app"}, sir. `;
            } else if (cmd.action === "search") {
                spokenText += `Searching for ${Object.values(params).join(" ")
                    }, sir. `;
            } else if (cmd.action === "open_url") {
                spokenText += `Opening the requested link, sir. `;
            } else {
                spokenText += `Performing ${cmd.action.replace(/_/g, " ")}, sir. `;
            }
        });

        await speakResponseAndWait(spokenText);

        // Execute only after the announcement finishes.
        await executeCommandQueue(result, aiContainer);

    }
};

send.addEventListener('click', sendMsg);
input.addEventListener('keydown', e => e.key === 'Enter' && sendMsg());

// Mic button integration
const micBtn = document.getElementById('mic-btn');
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec, timer;

if (SpeechRec) {
    rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;

    let finalTranscript = '';

    rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript + ' ';
            } else {
                interim += e.results[i][0].transcript;
            }
        }
        input.value = finalTranscript + interim;

        clearTimeout(timer);
        timer = setTimeout(() => rec.stop(), 2500); // Stop after 2.5s of silence
    };

    rec.onstart = () => {
        finalTranscript = '';
        micBtn.classList.add('glow');
    };

    rec.onend = () => {
        micBtn.classList.remove('glow');
        clearTimeout(timer);

        setTimeout(() => {
            if (input.value.trim() !== '') {
                sendMsg();
            }
        }, 1000); // 1-second delay
    };

    micBtn.onclick = () => micBtn.classList.contains('glow') ? rec.stop() : rec.start();
}

// Groq API integration (with 5-second timeout safety)
async function processCommandWithGroq(userText, aiContainer) {
    const url = "/api/chat";

    const systemPrompt = `You are SHIVOID, the advanced AI assistant and digital extension of your creator, Shivansh Thakur (3rd-year MBBS student at ASMC Firozabad). Speech-to-text may mishear your name as "sevoid", "shivoid", etc.

    1. PERSONALITY: JARVIS-like to Tony Stark. Sophisticated, calm, loyal, confident, with dry wit and subtle sarcasm. Address him as "Sir", "Boss", or "Shivansh". Never sound like a generic chatbot.
    2. CONVERSATION: Keep replies concise, natural, and direct, coding, and projects. Tease lightly, but stay respectful.
    3. AUTOMATION: For actionable tasks (opening apps, searches, messages, etc..), output ONLY the exact required JSON command structure. Never invent unsupported actions or claim a task succeeded without confirmation.
    4. FORMAT: For ordinary text, output standard concise text/JSON as required by the application. When JSON is expected, return strictly valid JSON without extra text outside it.
    5. SPEECH: Interpret transcription errors using context. Be precise and clear.
    6. SCOPE: you are only automation smart assistant.. if unrelated queries are asked. reject them in respectful manner like for example: sorry sir or sorry boss, you didnt allowed me to answer this .. or something like this
  You must ALWAYS return a valid JSON object matching one of these exact structures:
  
  For chat / identity / refusal responses:
  {
    "type": "chat",
    "response": "Short 3-4 word reply or 'Shivansh did not design me for that'"
  }
  
  For automation commands:
  {
    "type": "command",
    "commands": [
      {
        "id": "cmd_001",
        "device": "phone",
        "action": "short_action_name",
        "parameters": {}
      }
    ]
  }
  
  For open_app commands, ALWAYS return the human-readable app name in parameters.app_name.
NEVER generate or search for Android package names.
Example:
{
  "action": "open_app",
  "parameters": {
    "app_name": "Via"
  }
}
The server will resolve the correct Android package name using its local app registry.
  `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second limit

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userText }
                ]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        // Check for API Key / Authentication errors
        if (response.status === 401 || (data.error && data.error.code === 'invalid_api_key')) {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[SYSTEM ERROR] Key Error: Invalid or missing Groq API key.</p>`;
            return null;
        }

        // Check for Token / Rate limit errors
        if (response.status === 429 || (data.error && (data.error.code === 'rate_limit_exceeded' || data.error.message.includes('token')))) {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[SYSTEM ERROR] Shivoid out of tokens / Rate limit hit.</p>`;
            return null;
        }

        // General Groq API error handler
        if (data.error) {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[SYSTEM ERROR] Groq Error: ${data.error.message}</p>`;
            speakResponse("there is no such action added yet by you, sir")
            return null;
        }

        return JSON.parse(data.choices[0].message.content);

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("Connection error:", error);

        if (error.name === 'AbortError') {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[SYSTEM ERROR] Connection Timeout: Request timed out after 5 seconds.</p>`;
            speakResponse("Sorry Sir, Request Timed Out")
        } else {
            aiContainer.innerHTML = `<p style="color: #ff4d4d; font-weight: bold;">[SYSTEM ERROR] Connection Error: Shivoid failed to initialize. Check your network.</p>`;
            speakResponse("Sorry sir, i think there is a problem with the network")
        }
        return null;
    }
}

// SHI.VOID app TTS bridge — no browser speech synthesis
function speakResponse(text) {
    const shivoid = window.Shivoid || window.shivoid;

    if (!shivoid?.tts?.speak) {
        console.warn("SHI.VOID app TTS bridge unavailable.");
        return;
    }

    shivoid.tts.speak(cleanTextForSpeech(text), {
        pitch: 0.1,
        rate: 1.5
    });
}



async function speakResponseAndWait(text) {
    const shivoid = window.Shivoid || window.shivoid;

    if (!shivoid?.tts?.speak) {
        console.warn("SHI.VOID TTS bridge unavailable.");
        return;
    }

    try {
        await shivoid.tts.speak(cleanTextForSpeech(text), {
            pitch: 0.1,
            rate: 1.5
        });
    } catch (error) {
        console.error("SHI.VOID speech failed:", error);
    }
}



// Helper to clean up long URLs and fix pronunciation
function cleanTextForSpeech(text) {
    let cleaned = text.replace(/https?:\/\/[^\s]+/g, "the requested link");
    cleaned = cleaned.replace(/Shivansh/gi, "Shi-vahnsh");
    return cleaned;
}





//command execution


async function executeCommandQueue(result, aiContainer) {


    for (let index = 0; index < result.commands.length; index++) {

        const command = result.commands[index];

        console.log("Executing command:", command);

        // Show execution message
        aiContainer.insertAdjacentHTML('beforeend', `
                <p class="status-log" style="color: #00ffcc;">
                    ⚙️ Executing command #${index + 1}: 
                    <strong>${command.action}</strong>...
                </p>
            `);

        box.scrollTop = box.scrollHeight;

        try {

            if (command.device === "phone") {
                const data = await executePhoneCommand(command);

                console.log("Phone response:", data);

                if (data.status !== "success") {
                    throw new Error(
                        data.message || data.error || "Phone command failed"
                    );
                }



                // AUTOMATE SUCCESS MESSAGE

                const successMessages = [
                    "Done, boss.",
                    "All done, sir. Anything else?",
                    "Consider it handled, boss.",
                    "Done and dusted, sir.",
                    "Right away, boss. All taken care of.",
                    "Task completed, sir.",
                    "There you go, boss. All sorted.",
                    "As you wish, sir. Done.",
                    "Handled, boss. What's next?",
                    "All set, sir. Ready for your next command."
                ];

                const successMessage =
                    successMessages[
                    Math.floor(Math.random() * successMessages.length)
                    ];


                aiContainer.insertAdjacentHTML('beforeend', `
                        <p class="status-log" style="color: #00ff66;">
                            ✓ ${successMessage}
                        </p>
                    `);

                box.scrollTop = box.scrollHeight;

                // SPEAK ACTUAL AUTOMATE RESULT
                speakResponse(successMessage);

            } else {

                throw new Error(
                    `Execution for ${command.device} is not implemented yet`
                );
            }

        } catch (error) {

            console.error(
                `Command #${index + 1} failed:`,
                error
            );

            const failureMessage =
                error.message || "Command execution failed.";

            aiContainer.insertAdjacentHTML('beforeend', `
                    <p class="status-log" style="color: #ff4d4d;">
                        ✖ ${failureMessage}
                    </p>
                `);

            box.scrollTop = box.scrollHeight;

            // SPEAK ACTUAL FAILURE
            speakResponse(`Command failed. ${failureMessage}`);

            // Continue with remaining commands
            continue;
        }
    }
}
