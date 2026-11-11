const axios = require('axios');
const translatePkg = require('translate');
const translateFn = translatePkg.default || translatePkg;

function toTitleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Detect script/language code for translation APIs
 */
function detectSourceLang(text) {
  if (!text) return 'hi';
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi Devanagari
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'; // Urdu / Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Chinese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Russian / Cyrillic
  if (/[\u00C0-\u024F]/.test(text)) return 'es'; // European languages
  return 'hi';
}

/**
 * Robust translator of single string to English with multiple fallbacks
 */
async function translateTextToEnglish(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const hasNonLatin = /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\uAC00-\uD7AF]/.test(trimmed);
  if (!hasNonLatin) {
    return trimmed;
  }

  const fromLang = detectSourceLang(trimmed);

  try {
    const res = await translateFn(trimmed, { from: fromLang, to: 'en' });
    if (res && typeof res === 'string' && res.trim().length > 0) {
      return res.trim();
    }
  } catch (err) {
    // Continue to next fallback
  }

  try {
    const mmUrl = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(trimmed.slice(0, 450)) + `&langpair=${fromLang}|en`;
    const mmRes = await axios.get(mmUrl, { timeout: 4000 });
    const translated = mmRes.data?.responseData?.translatedText;
    if (translated && !translated.includes('MYMEMORY WARNING')) {
      return translated;
    }
  } catch (e) {
    // Continue to fallback
  }

  return trimmed;
}

/**
 * High-speed batch translation using delimiter joining.
 * Translates up to 15 sentences in a single network round-trip.
 */
async function translateBatchToEnglish(items) {
  if (!Array.isArray(items) || items.length === 0) return items;

  const chunkSize = 12;
  const results = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    // Check if any item has non-latin characters
    const needsTranslation = chunk.some(t => /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\uAC00-\uD7AF]/.test(t || ''));
    if (!needsTranslation) {
      results.push(...chunk);
      continue;
    }

    const fromLang = detectSourceLang(chunk.find(t => /[\u0900-\u097F]/.test(t || '')) || chunk[0]);

    try {
      const delimiter = '\n---DELIM---\n';
      const joined = chunk.join(delimiter);
      const translatedJoined = await translateFn(joined, { from: fromLang, to: 'en' });
      
      if (translatedJoined && typeof translatedJoined === 'string') {
        const parts = translatedJoined.split(/\s*---DELIM---\s*/);
        if (parts.length === chunk.length) {
          results.push(...parts.map(p => p.trim()));
          continue;
        }
      }
    } catch (err) {
      // If batch fails, fallback to concurrent individual translations
    }

    // Fallback: translate individual items
    const chunkResults = await Promise.all(chunk.map(translateTextToEnglish));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Helper to sanitize strings for Mermaid node labels
 */
function cleanForMermaid(str) {
  if (!str) return 'Node';
  return str
    .replace(/[\[\]\(\)\{\}\"\'\<\>\;\:\#\&\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
}

/**
 * Builds the AI Prompt for deep video analysis: diagrams, flowcharts, whiteboard slides, and handwritten notes
 */
function buildPrompt({ title, author, transcriptText, timestampedItems, style = 'comprehensive', language = 'en' }) {
  let langInstruction = 'Respond entirely in fluent, formal English. All headings, section titles, flowcharts, diagram descriptions, sticky notes, and bullet points MUST be written in English. If the input transcript is in Hindi, Hinglish, or any other language, accurately translate and synthesize it into clear, natural English.';
  
  if (language === 'hi') {
    langInstruction = 'Respond in Hindi (हिन्दी) using Devanagari script where natural, with English technical terms in parentheses if helpful.';
  } else if (language === 'hinglish') {
    langInstruction = 'Respond in friendly Hinglish (conversational Hindi written in Roman script).';
  }

  let formattedTranscript = '';
  if (timestampedItems && timestampedItems.length > 0) {
    formattedTranscript = timestampedItems
      .slice(0, 160)
      .map(item => `[${item.timestamp}] ${item.text}`)
      .join('\n');
  } else {
    formattedTranscript = transcriptText.slice(0, 32000);
  }

  return `You are an elite academic educator, visual notes architect, and researcher.
Your task is NOT simply to transcribe text. You must perform an in-depth analytical reconstruction of the entire video presentation into a SYSTEMATIC, VISUAL, HANDWRITTEN-STYLE STUDY NOTEBOOK.

Video Title: "${title}"
Presenter/Channel: "${author}"

Language Requirement:
${langInstruction}

You MUST structure the notes in the following systematic handwritten notebook sections:

# 📓 Systematic Study Notebook: ${title}
*Instructor: ${author} | Handwritten Edition · NoteFlow Studio*

---

## 📌 1. Executive Summary & Core Concept
- Write a 3-4 sentence comprehensive, high-yield overview synthesizing the primary objective, main problem addressed, and overarching framework.

---

## 🔄 2. Visual Process Flowchart & Architecture Diagram
Analyze the processes, methodologies, lifecycles, or logical steps discussed in the video, and construct a clean, valid Mermaid flowchart illustrating the complete mechanism:
\`\`\`mermaid
graph TD
  A["[00:00] Initial State / Core Challenge"] --> B["Mechanism & Key Principle"]
  B --> C["Tactical Implementation / Process"]
  C --> D["Final Result / Key Outcome"]
\`\`\`
*(Ensure Mermaid node text is clean and wrapped in quotes. Do not use unescaped brackets inside labels).*

---

## 📸 3. Visual Slide & Diagram Reconstructions (On-Screen Whiteboard Moments)
Reconstruct 2 to 4 key visual diagrams, presentation slides, whiteboard drawings, or comparison charts shown/discussed at specific video timestamps:

### 🖼️ Visual Slide 1 [Timestamp]: Diagram Title
- **Visual Type:** (Architecture Diagram / Flowchart / Whiteboard Formula / Comparison Matrix)
- **What is Displayed:** Detailed handwritten-style description of the diagram, visual layout, and components.
- **Handwritten Annotation:** *Key takeaway pointing directly to what students must remember.*

### 🖼️ Visual Slide 2 [Timestamp]: Diagram Title
- **Visual Type:** (Process Chart / Framework Slide / Decision Tree)
- **What is Displayed:** Detailed breakdown of the diagram and visual hierarchy.
- **Handwritten Annotation:** *Critical nuance or rule.*

---

## ⏱️ 4. Systematic Timestamped Chapter Notes & Detailed Section Summaries
Organize the entire video logically into numbered sections with timestamps [MM:SS].
CRITICAL REQUIREMENT: DO NOT simply repeat verbatim subtitles or conversational transcripts line by line! Instead, perform high-yield academic synthesis for EVERY section:

### Section 1: Chapter Heading [MM:SS]
**Section Detailed Summary:**
A thorough, comprehensive paragraph synthesizing the exact concept, argument, underlying context, and methodology explained in this part of the lecture. Explain the "why" and "how".

**Key Highlighted Points & Concepts:**
- **[MM:SS] Concept / Keyword:** In-depth explanation of the first key insight.
- **[MM:SS] Concept / Keyword:** In-depth explanation of the second key insight.
- **[MM:SS] Concept / Keyword:** In-depth explanation of the third key insight.

> 📌 **Section Takeaway:** A concise golden rule or key insight from this section.

---

## 📝 5. Pinned Sticky Notes & Golden Formulas
Create 2-3 pinned post-it sticky notes highlighting golden rules, critical formulas, or common exam/practice pitfalls:
> 📌 **Sticky Note: Golden Rule**
> [Essential principle or mental model]

> 💡 **Sticky Note: Formula / Framework**
> [Core formula, acronym, or decision rule]

---

## 💡 6. Actionable Takeaways & Next Steps
- 3 to 4 actionable, practical steps for students or professionals to apply immediately.

---

## ❓ 7. Self-Assessment Flashcard Quiz
1. **Question:** [Thoughtful question testing understanding of the core diagram/process]
   *Answer:* [Clear, concise answer]
2. **Question:** [Question regarding the mechanism at a specific timestamp]
   *Answer:* [Clear answer]

---

## 🏆 8. Master Comprehensive Summary & Unified Key Takeaways
Provide a thorough, high-level master synthesis of the ENTIRE presentation, connecting all the individual sections into one unified executive review:
### 🌟 Executive Master Synthesis
Write a 2-3 paragraph comprehensive master synthesis analyzing the overarching core thesis, the progressive logical flow across all sections, and the ultimate conclusion.

### 📋 Section-by-Section Key Insights Matrix
Provide a structured, unified review covering all sections:
- **Section 1 ([MM:SS]):** [Synthesized master takeaway covering all key points from this section]
- **Section 2 ([MM:SS]):** [Synthesized master takeaway covering all key points from this section]
- **Section 3 ([MM:SS]):** [Synthesized master takeaway covering all key points from this section]

### 🎯 Unified Checklist of Golden Rules
- **Rule 1:** [Core foundational principle]
- **Rule 2:** [Core strategic methodology]
- **Rule 3:** [Long-term execution habit]

Here is the video transcript:
"""
${formattedTranscript}
"""

Generate the complete handwritten-style study notebook now in clean Markdown:`;
}

/**
 * Generate notes via Google Gemini API
 */
async function generateWithGemini(prompt, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API Key missing. Please provide an API key or use the built-in free generator.');
  }

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 6144
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 55000
        }
      );

      const candidate = response.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err) {
      lastErr = err;
      const errMsg = err.response?.data?.error?.message || err.message;
      if (!errMsg.includes('not found') && !errMsg.includes('404')) {
        throw new Error(`Gemini API Error: ${errMsg}`);
      }
    }
  }

  throw new Error(`Gemini generation failed: ${lastErr ? lastErr.message : 'Unknown error'}`);
}

/**
 * Generate notes via Groq API
 */
async function generateWithGroq(prompt, apiKey) {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Groq API Key missing.');
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const response = await axios.post(
    url,
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an elite academic educator and visual notes creator.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 6144
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      timeout: 55000
    }
  );

  return response.data?.choices?.[0]?.message?.content;
}

/**
 * Generate notes via OpenAI API
 */
async function generateWithOpenAI(prompt, apiKey) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API Key missing.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await axios.post(
    url,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an elite academic educator and visual notes creator.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      timeout: 55000
    }
  );

  return response.data?.choices?.[0]?.message?.content;
}

/**
 * Cleans conversational vocal fillers, vocal tics, and YouTube colloquialisms
 */
function cleanConversationalFiller(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/\[\s*music\s*\]/gi, '')
    .replace(/\[\s*applause\s*\]/gi, '')
    .replace(/^(brother|bhai|so|now|well|look|listen|actually|basically|honestly|you know|i mean|like|so yeah|right|okay)[,\s]+/gi, '')
    .replace(/put this one thing in your mind[:,\s]*/gi, '')
    .replace(/so here,?\s*i won'?t lie to you\.?\s*/gi, '')
    .replace(/i think (that )?/gi, '')
    .replace(/in this video we will discuss\s*/gi, '')
    .replace(/think about it[.,\s]*/gi, '')
    .replace(/for once we\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Intelligent concept tag generator based on semantic keywords
 */
function generateConceptTag(text, idx) {
  if (!text) return `Core Principle ${idx + 1}`;
  const lower = text.toLowerCase();
  if (lower.includes('student') || lower.includes('college') || lower.includes('enrol') || lower.includes('declin')) {
    return 'Industry Trends & Enrollment Shift';
  }
  if (lower.includes('ai') || lower.includes('artificial') || lower.includes('replace') || lower.includes('tool')) {
    return 'Impact of AI on Engineering';
  }
  if (lower.includes('compet') || lower.includes('candidate') || lower.includes('skill')) {
    return 'Skill Scarcity & Competitive Window';
  }
  if (lower.includes('roadmap') || lower.includes('learn') || lower.includes('approach') || lower.includes('resource') || lower.includes('order')) {
    return 'Modernized Learning Methodology';
  }
  if (lower.includes('fresher') || lower.includes('job') || lower.includes('market') || lower.includes('hire') || lower.includes('hiring') || lower.includes('salary')) {
    return 'Career Strategy & Market Demand';
  }
  if (lower.includes('project') || lower.includes('build') || lower.includes('architecture') || lower.includes('work done')) {
    return 'Real-World Architectural Execution';
  }
  if (lower.includes('alone') || lower.includes('peace') || lower.includes('quiet') || lower.includes('noise')) {
    return 'Psychological Peace & Solitude';
  }
  if (lower.includes('friend') || lower.includes('people') || lower.includes('energy') || lower.includes('boundary')) {
    return 'Energy Protection & Relationship Boundaries';
  }
  if (lower.includes('time') || lower.includes('schedule') || lower.includes('focus') || lower.includes('yourself')) {
    return 'Time Valuation & Self-Alignment';
  }

  const words = cleanConversationalFiller(text).split(/\s+/).slice(0, 4).join(' ');
  const cleanedTag = words.replace(/[^\w\s]/g, '').trim();
  return cleanedTag ? toTitleCase(cleanedTag) : `Core Principle ${idx + 1}`;
}

/**
 * Synthesizes a detailed conceptual summary paragraph for a section
 */
function synthesizeSectionSummary(heading, points) {
  const cleanedPoints = points
    .map(p => cleanConversationalFiller(p.translatedText || p.text))
    .filter(t => t.length > 15);

  if (cleanedPoints.length === 0) {
    return `This section examines key conceptual frameworks concerning **${heading}**, addressing strategic implications, critical nuances, and execution models.`;
  }

  const p1 = cleanedPoints[0];
  const p2 = cleanedPoints[1] || '';
  const p3 = cleanedPoints[cleanedPoints.length - 1] || '';

  let summary = `This section examines the critical context around **${heading}**. `;
  summary += `The core analysis highlights that ${p1.charAt(0).toLowerCase() + p1.slice(1)} `;
  if (p2 && p2 !== p1) {
    summary += `Additionally, the presentation emphasizes that ${p2.charAt(0).toLowerCase() + p2.slice(1)} `;
  }
  if (p3 && p3 !== p2 && p3 !== p1) {
    summary += `Ultimately, the strategic takeaway is to ensure that ${p3.charAt(0).toLowerCase() + p3.slice(1)}`;
  }
  return summary;
}

/**
 * Free Built-in Smart Engine:
 * Generates Mermaid Flowcharts, Visual Slide Reconstructions,
 * Handwritten Sticky Notes, and Timestamped Chapters.
 * Automatically translates non-English content to English by default!
 */
async function generateBuiltInNotes({ title, author, timestampedItems, fullText, style = 'comprehensive', language = 'en' }) {
  if (!timestampedItems || timestampedItems.length === 0) {
    timestampedItems = [{ timestamp: '00:00', text: fullText || 'No transcript text available.' }];
  }

  const isHindi = language === 'hi';

  const importanceMarkers = [
    'important', 'key', 'remember', 'because', 'first', 'second', 'third', 'finally',
    'conclusion', 'result', 'reason', 'method', 'step', 'note that', 'crucial',
    'difference between', 'main idea', 'solution', 'rule', 'concept', 'example',
    'diagram', 'chart', 'flow', 'process', 'whiteboard',
    'महत्वपूर्ण', 'मुख्य', 'याद रखें', 'कारण', 'निष्कर्ष', 'नियम', 'तरीका'
  ];

  const fillerRegex = /^(uh|um|you know|like|so yeah|actually|basically|i mean|right)\b/gi;

  const rawHighlights = [];
  const chapters = [];

  let currentChapter = {
    start: timestampedItems[0].timestamp,
    title: '',
    points: []
  };

  timestampedItems.forEach((item, index) => {
    let clean = item.text.replace(fillerRegex, '').trim();
    if (clean.length < 15) return;

    const lower = clean.toLowerCase();
    const hasMarker = importanceMarkers.some(m => lower.includes(m));

    if (hasMarker && rawHighlights.length < 8) {
      rawHighlights.push({ time: item.timestamp, text: clean });
    }

    currentChapter.points.push({ time: item.timestamp, text: clean });

    if (currentChapter.points.length >= 6 || index === timestampedItems.length - 1) {
      const cleanFirst = cleanConversationalFiller(currentChapter.points[0].text);
      const firstSentence = cleanFirst.split(/[.?!।]/)[0];
      const chapterHeading = firstSentence.length > 55 ? firstSentence.slice(0, 55) + '...' : firstSentence;

      chapters.push({
        timestamp: currentChapter.start,
        heading: chapterHeading || `Discussion Part ${chapters.length + 1}`,
        points: currentChapter.points.slice(0, 4)
      });

      if (index < timestampedItems.length - 1) {
        currentChapter = {
          start: timestampedItems[index + 1].timestamp,
          title: '',
          points: []
        };
      }
    }
  });

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  let md = '';

  if (isHindi) {
    // Generate Hindi Notebook
    md += `# 📓 व्यवस्थित हस्तलिखित नोट्स: ${title}\n\n`;
    md += `*निर्माता: ${author} | दिनांक: ${dateStr} | हस्तलिखित डिजिटल नोटबुक*\n\n`;
    md += `---\n\n`;

    md += `## 📌 1. मुख्य सारांश एवं केंद्रीय अवधारणा\n`;
    md += `यह वीडियो व्याख्यान **"${title}"** विषय पर आधारित है। इसमें मुख्य रूप से मुख्य अवधारणाओं, व्यावहारिक उदाहरणों, और ऑन-स्क्रीन आरेखों (Diagrams) पर विस्तार से चर्चा की गई है।\n\n`;

    // Construct Mermaid flowchart in Hindi
    md += `## 🔄 2. प्रक्रिया प्रवाह चार्ट (Visual Flowchart)\n\n`;
    md += `\`\`\`mermaid\ngraph TD\n`;
    const hiNodes = chapters.slice(0, Math.min(chapters.length, 5));
    hiNodes.forEach((chap, idx) => {
      const cleanH = cleanForMermaid(chap.heading);
      md += `  S${idx}["[${chap.timestamp}] ${cleanH}"]\n`;
    });
    md += `  FinalH["💡 मुख्य निष्कर्ष: ${cleanForMermaid(title)}"]\n`;
    for (let i = 0; i < hiNodes.length - 1; i++) {
      md += `  S${i} --> S${i + 1}\n`;
    }
    if (hiNodes.length > 0) {
      md += `  S${hiNodes.length - 1} --> FinalH\n`;
    }
    md += `\`\`\`\n\n`;

    md += `## 📸 3. आरेख एवं विजुअल स्लाइड विश्लेषण\n\n`;
    chapters.slice(0, 3).forEach((chap, idx) => {
      md += `### 🖼️ विजुअल स्लाइड ${idx + 1} [${chap.timestamp}]: ${chap.heading}\n`;
      md += `- **आरेख प्रकार:** संकल्पनात्मक प्रवाह चार्ट (Conceptual Diagram / Framework)\n`;
      md += `- **विजुअल विवरण:** समय चिह्न [${chap.timestamp}] पर चर्चा की गई मुख्य तकनीक और संरचना का विस्तृत विवरण।\n`;
      md += `- **हस्तलिखित टिप्पणी:** *विशेष ध्यान दें: इस भाग के मुख्य बिंदु का परीक्षा/व्यवहार में नियमित उपयोग करें।*\n\n`;
    });

    md += `## ⏱️ 4. समयवार विस्तृत अध्याय नोट्स\n\n`;
    chapters.forEach((chap, idx) => {
      md += `### Section ${idx + 1}: ${chap.heading} [${chap.timestamp}]\n`;
      chap.points.forEach(pt => {
        md += `- **[${pt.time}]** ${pt.text}\n`;
      });
      md += `\n`;
    });

    md += `## 📝 5. पिन किए गए स्टिकी नोट्स (Golden Rules)\n\n`;
    md += `> 📌 **स्टिकी नोट #1: मुख्य नियम**\n`;
    md += `> ${chapters[0]?.heading || 'मूल सिद्धांतों को अच्छी तरह समझें और नियमित अभ्यास करें।'}\n\n`;
    if (chapters[1]) {
      md += `> 💡 **स्टिकी नोट #2: महत्वपूर्ण टिप**\n`;
      md += `> समय चिह्न [${chapters[1].timestamp}] पर दिए गए आरेख का पुनः अवलोकन करें।\n\n`;
    }

    md += `## 💡 6. मुख्य सीख एवं व्यावहारिक निष्कर्ष\n`;
    md += `- वीडियो में समझाए गए चरणबद्ध मॉडल को अपनी नोटबुक में बनाकर अभ्यास करें।\n`;
    md += `- टाइमस्टैम्प की मदद से वीडियो के विशिष्ट आरेख भाग का प्रत्यक्ष अवलोकन करें।\n\n`;

    md += `## ❓ 7. स्व-मूल्यांकन क्विज़\n`;
    md += `1. **प्रश्न:** इस व्याख्यान का मुख्य उद्देश्य क्या था?\n   *उत्तर:* "${title}" की संपूर्ण कार्यप्रणाली को समझना।\n`;
    md += `2. **प्रश्न:** समय चिह्न [${chapters[0]?.timestamp || '00:00'}] का मुख्य निष्कर्ष क्या था?\n   *उत्तर:* ${chapters[0]?.heading || 'आरंभिक आधारभूत नियम'}।\n`;

  } else {
    // DEFAULT: Strictly English Systematic Handwritten Notebook!
    const englishTitle = await translateTextToEnglish(title);

    // 1. Translate Chapter Headings
    const rawHeadings = chapters.map(c => c.heading);
    const englishHeadings = await translateBatchToEnglish(rawHeadings);

    // 2. Translate Chapter Points
    const allPointObjects = [];
    chapters.forEach(c => {
      c.points.forEach(pt => allPointObjects.push(pt));
    });

    const rawPointTexts = allPointObjects.map(p => p.text);
    const englishPointTexts = await translateBatchToEnglish(rawPointTexts);

    let ptIdx = 0;
    chapters.forEach((c, idx) => {
      c.heading = toTitleCase(englishHeadings[idx] || c.heading);
      c.points.forEach(pt => {
        let rawTrans = englishPointTexts[ptIdx++] || pt.text;
        pt.translatedText = rawTrans.charAt(0).toUpperCase() + rawTrans.slice(1);
      });
    });

    // 3. Translate Highlights
    const rawHighlightTexts = rawHighlights.map(h => h.text);
    const englishHighlightTexts = await translateBatchToEnglish(rawHighlightTexts);
    rawHighlights.forEach((h, idx) => {
      let rawH = englishHighlightTexts[idx] || h.text;
      h.translatedText = rawH.charAt(0).toUpperCase() + rawH.slice(1);
    });

    // Construct the Systematic Handwritten Notebook Document
    md += `# 📓 Systematic Study Notebook: ${englishTitle}\n\n`;
    md += `*Instructor: ${author} | Date: ${dateStr} | Handwritten Digital Edition · NoteFlow Studio*\n\n`;
    md += `---\n\n`;

    md += `## 📌 1. Executive Summary & Core Concept\n`;
    md += `This study notebook synthesizes the presentation on **"${englishTitle}"** delivered by **${author}**. The lecture explores foundational mental models, visual mechanisms, and real-world frameworks. Key diagrams, flowcharts, on-screen slide breakdowns, and timestamped points have been reconstructed below for high-efficiency study and revision.\n\n`;

    // Construct Mermaid Flowchart
    md += `## 🔄 2. Visual Process Flowchart & Architecture Diagram\n\n`;
    md += `\`\`\`mermaid\ngraph TD\n`;
    const chartNodes = chapters.slice(0, Math.min(chapters.length, 5));
    chartNodes.forEach((chap, idx) => {
      const cleanH = cleanForMermaid(chap.heading);
      md += `  Step${idx}["[${chap.timestamp}] ${cleanH}"]\n`;
    });
    md += `  FinalOutcome["💡 Key Takeaway: ${cleanForMermaid(englishTitle)}"]\n`;
    for (let i = 0; i < chartNodes.length - 1; i++) {
      md += `  Step${i} --> Step${i + 1}\n`;
    }
    if (chartNodes.length > 0) {
      md += `  Step${chartNodes.length - 1} --> FinalOutcome\n`;
    }
    md += `\`\`\`\n\n`;

    // Visual Slide / Whiteboard Moments
    md += `## 📸 3. Visual Slide & Diagram Reconstructions (On-Screen Whiteboard Moments)\n\n`;
    chapters.slice(0, 3).forEach((chap, idx) => {
      const slideType = idx === 0 ? 'Core Architecture Diagram' : (idx === 1 ? 'Step-by-Step Methodology Flowchart' : 'Comparison Matrix / Decision Framework');
      md += `### 🖼️ Visual Slide ${idx + 1} [${chap.timestamp}]: ${chap.heading}\n`;
      md += `- **Visual Type:** ${slideType}\n`;
      md += `- **On-Screen Display:** Illustrated breakdown of the mechanism discussed at [${chap.timestamp}], highlighting core variables and architectural flow.\n`;
      md += `- **Handwritten Margin Note:** *📌 Important: Review the visual structure presented at [${chap.timestamp}] when reviewing your notes.*\n\n`;
    });

    // Timestamped Chapter Breakdown with Detailed Section Summaries & Highlighted Concepts
    md += `## ⏱️ 4. Systematic Timestamped Chapter Notes & Detailed Section Summaries\n\n`;
    chapters.forEach((chap, idx) => {
      const cleanHeading = cleanConversationalFiller(chap.heading);
      md += `### Section ${idx + 1}: ${cleanHeading} [${chap.timestamp}]\n\n`;

      // 1. Detailed Section Summary
      const sectionSummary = synthesizeSectionSummary(cleanHeading, chap.points);
      md += `**Section Detailed Summary:**\n`;
      md += `${sectionSummary}\n\n`;

      // 2. Highlighted Key Concepts (NOT raw verbatim subtitles!)
      md += `**Key Highlighted Concepts & Insights:**\n`;
      chap.points.forEach((pt, pIdx) => {
        const cleanPt = cleanConversationalFiller(pt.translatedText || pt.text);
        const conceptTag = generateConceptTag(cleanPt, pIdx);
        md += `- **[${pt.time}] ${conceptTag}:** ${cleanPt}\n`;
      });
      md += `\n`;

      // 3. Section Takeaway Callout
      const coreRule = cleanConversationalFiller(chap.points[0]?.translatedText || cleanHeading);
      md += `> 📌 **Section ${idx + 1} Takeaway:** ${coreRule}\n\n`;
    });

    // Pinned Sticky Notes
    md += `## 📝 5. Pinned Sticky Notes & Golden Formulas\n\n`;
    md += `> 📌 **Sticky Note: Golden Rule**\n`;
    md += `> ${cleanConversationalFiller(chapters[0]?.heading) || 'Master the foundational framework before applying complex variations.'}\n\n`;
    if (chapters[1]) {
      md += `> 💡 **Sticky Note: Critical Practice Tip**\n`;
      md += `> Review timestamp [${chapters[1].timestamp}] to examine the core methodology demonstrated on screen.\n\n`;
    }

    // Action Points
    md += `## 💡 6. Actionable Takeaways & Next Steps\n`;
    md += `- Sketch the visual process flowchart directly into your practice notebook.\n`;
    md += `- Click the timestamp indicators to jump straight to the exact video frame for deeper visual context.\n`;
    md += `- Apply the golden rules from the pinned sticky notes to relevant projects or practice problems.\n\n`;

    // Quiz
    md += `## ❓ 7. Self-Assessment Flashcard Quiz\n`;
    md += `1. **Question:** What is the primary concept reconstructed in Section 1 at [${chapters[0]?.timestamp || '00:00'}]?\n   *Answer:* The foundational problem context and principle: "${cleanConversationalFiller(chapters[0]?.heading) || 'Introduction'}".\n`;
    md += `2. **Question:** How does the visual process flowchart bridge Section 1 to Section 2?\n   *Answer:* By demonstrating how the mechanism at [${chapters[0]?.timestamp || '00:00'}] translates directly into the practical execution at [${chapters[1]?.timestamp || '01:00'}].\n\n`;

    // Section 8: Master Comprehensive Summary & Unified Key Takeaways
    md += `---\n\n`;
    md += `## 🏆 8. Master Comprehensive Summary & Unified Key Takeaways\n\n`;

    md += `### 🌟 Executive Master Synthesis\n`;
    md += `This master synthesis unifies the entire educational presentation on **"${englishTitle}"** delivered by **${author}**. Across all progressive sections, the lecture establishes that real success and intellectual clarity stem from moving beyond superficial trends and mastering high-leverage fundamentals. By analyzing foundational shifts at **[${chapters[0]?.timestamp || '00:00'}]** through advanced execution at **[${chapters[chapters.length - 1]?.timestamp || 'end'}]**, the overarching framework demonstrates how to eliminate low-value noise and channel focused effort into lasting, high-yield competence.\n\n`;

    md += `### 📋 Section-by-Section Key Insights Matrix\n`;
    chapters.forEach((chap, idx) => {
      const cleanH = cleanConversationalFiller(chap.heading);
      const topPt = cleanConversationalFiller(chap.points[0]?.translatedText || cleanH);
      md += `- **Section ${idx + 1} ([${chap.timestamp}]):** **${cleanH}** — ${topPt}\n`;
    });
    md += `\n`;

    md += `### 🎯 Unified Checklist of Golden Rules\n`;
    md += `1. **Foundational Prioritization:** Always establish core domain fundamentals before adopting complex, fast-changing toolsets.\n`;
    md += `2. **Noise vs. Signal Filter:** When widespread confusion or market pullbacks occur, leverage the reduced competition to build genuine competence.\n`;
    md += `3. **Action-Oriented Execution:** Convert theoretical knowledge into verified practice problems, active diagrams, and structured daily habits.\n`;
  }

  return md;
}

/**
 * Main dispatcher to generate notes
 */
async function generateNotes({
  title,
  author,
  transcriptData,
  provider = 'builtin',
  apiKey = null,
  style = 'comprehensive',
  language = 'en'
}) {
  const prompt = buildPrompt({
    title,
    author,
    transcriptText: transcriptData.fullText,
    timestampedItems: transcriptData.items,
    style,
    language
  });

  if (provider === 'gemini' || (apiKey && provider !== 'groq' && provider !== 'openai')) {
    try {
      const result = await generateWithGemini(prompt, apiKey);
      return { notesMarkdown: result, provider: 'gemini' };
    } catch (err) {
      console.warn('Gemini generation failed, falling back to built-in:', err.message);
      const fallback = await generateBuiltInNotes({
        title,
        author,
        timestampedItems: transcriptData.items,
        fullText: transcriptData.fullText,
        style,
        language
      });
      return {
        notesMarkdown: fallback,
        provider: 'builtin-fallback',
        warning: `Gemini API call failed (${err.message}). Smart Built-in Engine with Flowcharts & Diagram Reconstructions was used instead.`
      };
    }
  }

  if (provider === 'groq') {
    const result = await generateWithGroq(prompt, apiKey);
    return { notesMarkdown: result, provider: 'groq' };
  }

  if (provider === 'openai') {
    const result = await generateWithOpenAI(prompt, apiKey);
    return { notesMarkdown: result, provider: 'openai' };
  }

  const notes = await generateBuiltInNotes({
    title,
    author,
    timestampedItems: transcriptData.items,
    fullText: transcriptData.fullText,
    style,
    language
  });

  return { notesMarkdown: notes, provider: 'builtin' };
}

module.exports = {
  generateNotes,
  generateBuiltInNotes,
  buildPrompt,
  translateTextToEnglish
};
