require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { extractVideoId, fetchVideoMetadata, fetchTranscript } = require('./lib/youtube');
const { generateNotes } = require('./lib/aiNotes');
const { createNotesPDF } = require('./lib/pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/marked.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules/marked/lib/marked.umd.js'));
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NoteFlow - Video to PDF Notes Generator'
  });
});

/**
 * Step 1: Extract Video Info and Transcript
 */
app.post('/api/extract', async (req, res) => {
  try {
    const { url, preferredLang } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Video URL zaroori hai. Kripya valid YouTube link paste karein.' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Valid YouTube link nahi mila. Kripya YouTube video link check karein.' });
    }

    // Fetch metadata and transcript in parallel
    const [metadata, transcriptResult] = await Promise.allSettled([
      fetchVideoMetadata(videoId),
      fetchTranscript(videoId, preferredLang)
    ]);

    const videoInfo = metadata.status === 'fulfilled' ? metadata.value : {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'YouTube Video',
      author: 'YouTube Channel',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };

    if (transcriptResult.status === 'rejected') {
      return res.status(422).json({
        error: transcriptResult.reason.message || 'Subtitles fetch nahi ho sake.',
        video: videoInfo,
        hasCaptions: false
      });
    }

    return res.json({
      success: true,
      video: videoInfo,
      transcript: transcriptResult.value,
      hasCaptions: true
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return res.status(500).json({ error: error.message || 'Server error during extraction.' });
  }
});

/**
 * Step 2: Generate Notes from Transcript
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { title, author, transcriptData, provider, apiKey, style, language } = req.body;

    if (!transcriptData || (!transcriptData.fullText && (!transcriptData.items || transcriptData.items.length === 0))) {
      return res.status(400).json({ error: 'Transcript data missing.' });
    }

    const result = await generateNotes({
      title: title || 'Video Notes',
      author: author || 'YouTube Creator',
      transcriptData,
      provider: provider || 'builtin',
      apiKey: apiKey || null,
      style: style || 'comprehensive',
      language: language || 'auto'
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ error: error.message || 'Notes generation failed.' });
  }
});

/**
 * Convenience All-In-One Route
 */
app.post('/api/process-all', async (req, res) => {
  try {
    const { url, manualTranscript, style, language, provider, apiKey } = req.body;

    let videoInfo = {
      videoId: 'manual',
      url: url || '',
      title: 'Study Notes',
      author: 'Notes Author',
      thumbnailUrl: ''
    };

    let transcriptData = null;

    if (manualTranscript && manualTranscript.trim().length > 0) {
      // User provided their own transcript / script
      transcriptData = {
        items: [{ timestamp: '00:00', text: manualTranscript.trim() }],
        fullText: manualTranscript.trim(),
        wordCount: manualTranscript.trim().split(/\s+/).length,
        approxDuration: 'N/A'
      };
      if (url) {
        const vid = extractVideoId(url);
        if (vid) {
          const meta = await fetchVideoMetadata(vid).catch(() => null);
          if (meta) videoInfo = meta;
        }
      }
    } else {
      if (!url) {
        return res.status(400).json({ error: 'Kripya YouTube video ka link enter karein.' });
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ error: 'Valid YouTube URL nahi mila. Kripya check karein.' });
      }

      videoInfo = await fetchVideoMetadata(videoId);
      transcriptData = await fetchTranscript(videoId);
    }

    const generated = await generateNotes({
      title: videoInfo.title,
      author: videoInfo.author,
      transcriptData,
      provider: provider || 'builtin',
      apiKey: apiKey || null,
      style: style || 'comprehensive',
      language: language || 'auto'
    });

    return res.json({
      success: true,
      video: videoInfo,
      transcriptSummary: {
        wordCount: transcriptData.wordCount,
        approxDuration: transcriptData.approxDuration
      },
      ...generated
    });
  } catch (error) {
    console.error('Process-all error:', error);
    return res.status(400).json({ error: error.message || 'Video process nahi ho saki.' });
  }
});

/**
 * Step 3: Direct PDF Generation & Download
 */
app.post('/api/download-pdf', (req, res) => {
  try {
    const { title, author, videoUrl, notesMarkdown } = req.body;

    if (!notesMarkdown) {
      return res.status(400).json({ error: 'Notes markdown missing.' });
    }

    const safeFilename = (title || 'Video_Notes')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}_Notes.pdf"`);

    createNotesPDF({
      title: title || 'Video Study Notes',
      author: author || 'YouTube Creator',
      videoUrl: videoUrl || '',
      notesMarkdown
    }, res);

  } catch (error) {
    console.error('PDF error:', error);
    res.status(500).json({ error: 'PDF generate karne mein samasya aayi.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 NoteFlow - Video to PDF Notes Server is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
