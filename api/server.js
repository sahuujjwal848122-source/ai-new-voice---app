const fetch = require('node-fetch');
const formidable = require('formidable');

// Vercel को body-parser डिसेबल करने के लिए कॉन्फ़िगरेशन
// यह फाइल अपलोडिंग के लिए बहुत ज़रूरी है
export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async (req, res) => {
    const API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key is not set on the server.' });
    }

    // URL में query parameter से पता करें कि यह क्लोनिंग रिक्वेस्ट है या TTS
    const { clone } = req.query;

    if (clone === 'true') {
        // यह Voice Clone रिक्वेस्ट है
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ error: 'Error parsing form data.' });
            }
            try {
                const formData = new FormData();
                // formidable v3 के अनुसार, fields.name एक ऐरे होता है
                formData.append('name', fields.name[0]); 
                const file = files.sample_file[0];
                const fileBuffer = require('fs').readFileSync(file.filepath);
                const fileBlob = new Blob([fileBuffer], { type: file.mimetype });
                formData.append('files', fileBlob, file.originalFilename);

                const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
                    method: 'POST',
                    headers: { 'xi-api-key': API_KEY },
                    body: formData
                });

                if (!response.ok) {
                    return res.status(response.status).json({ error: `ElevenLabs API Error: ${await response.text()}` });
                }
                return res.status(200).json(await response.json());
            } catch (error) {
                return res.status(500).json({ error: `Voice Clone Server Error: ${error.message}` });
            }
        });
    } else {
        // यह Text-to-Speech (TTS) रिक्वेस्ट है
        if (req.method !== 'POST') {
             return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        // TTS के लिए body को मैन्युअल रूप से parse करना होगा
        const chunks = [];
        for await (const chunk of req) { chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        const { voice_id, text } = body;
        const selectedVoiceId = voice_id || '21m00Tcm4TlvDq8ikWAM';

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
                method: 'POST',
                headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
                body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
            });
            if (!response.ok) { return res.status(response.status).send(await response.text()); }
            res.setHeader('Content-Type', 'audio/mpeg');
            return response.body.pipe(res);
        } catch (error) {
            return res.status(500).json({ error: 'TTS Server error' });
        }
    }
};
