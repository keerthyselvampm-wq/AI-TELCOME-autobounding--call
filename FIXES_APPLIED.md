# VDart Call Assistant – Fixes Applied

## Problem 1: Voice was not being recognized

### Root cause
The browser Web Speech Recognition (`continuous: true`) stayed **ON** while
the AI was speaking through the speakers. The mic picked up the AI's own
TTS voice, sending it back as "user text" and creating a feedback loop that
made real user speech unusable. Additionally, `isMuted` was read from a stale
closure and the language-change `useEffect` restarted the mic even mid-AI-speech.

### Files changed
- `frontend/src/pages/CallSimulator.tsx`

### What was fixed
1. Introduced `isMutedRef`, `isAISpeakingRef`, `inputModeRef` so mic callbacks
   see the latest state (no stale closure).
2. `playAudio()` and `speakWithBrowser()` now **stop the recognizer BEFORE the
   AI starts speaking**, and **restart it 300 ms AFTER the AI finishes**.
3. `startSpeechRecognition()` refuses to start while AI is speaking or the
   user muted the mic.
4. `recognition.onresult` ignores speech events that arrive while AI is talking
   (safety net for echo pickup).
5. `recognition.onend` auto-restart is now guarded by all four conditions:
   still connected, not muted, AI not speaking, voice mode.
6. The `useEffect` that restarted recognition on `currentLanguage` change no
   longer runs during AI speech.
7. Clear error message when microphone permission is denied.

## Problem 2: Data collected during the call was not saved to the database

### Root cause
In `backend/app/routes/call_simulator.py`, database writes for `collected_data`
were gated by `if collected_data and student_id:`. Because the browser
simulator is typically opened without a `?student_id=…` URL param,
`student_id` was `None` — so **every piece of data collected during the call
was silently discarded**. Also `collected_data` was never persisted to the
`call_logs.call_notes` column, so it was lost from the call history too.

### Files changed
- `backend/app/routes/call_simulator.py`

### What was fixed
1. `collected_data` is now **always** serialized as JSON into
   `call_logs.call_notes` at the end of every simulator call, regardless of
   agent type or whether a `student_id` was provided.
2. For the **`internship`** agent, a new `Student` row is now **created** from
   the collected data (name, college, domain, joining_date, duration, batch,
   contact_number) when the conversation completes. The new student is linked
   back to the corresponding `call_logs.student_id`.
3. For the **`missed_joining`** agent, date parsing now accepts multiple
   formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) instead of just one.
4. All DB blocks now handle exceptions and rollback correctly so a bad row
   never crashes the WebSocket finalizer.

## How to run

Same as before – no new dependencies:

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# frontend (new terminal)
cd frontend
npm install     # or yarn
npm run dev     # opens http://localhost:5173
```

Open http://localhost:5173, log in, go to **Call Simulator**, click
**Start AI Call**, allow the mic when prompted, and speak after the AI
finishes its greeting. The collected data will appear in the **Students**
table (for the internship agent) and in **Call History → notes** once the
call ends.

### Verification
- Check that student data is stored:
  ```sql
  SELECT id, name, college, domain, contact_number, joining_date, batch, status
  FROM students ORDER BY id DESC LIMIT 5;

  SELECT call_sid, agent_type, call_notes, student_id
  FROM call_logs ORDER BY id DESC LIMIT 5;
  ```
- If voice still fails, open Chrome DevTools → Console. Look for:
  - `NotAllowedError` → mic permission denied. Click the 🔒 icon in the
    address bar and allow the microphone, then refresh.
  - Microphone must be used over **HTTPS** or **localhost**. If you access
    the app through an IP address or `http://` domain (other than localhost)
    the browser blocks the mic entirely.
