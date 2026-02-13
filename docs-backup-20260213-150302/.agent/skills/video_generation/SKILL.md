---
name: video-generation
description: Creates motion graphics and video content using AI video generation models (Veo, Runway). Supports product animations, social media videos, explainer content, and cinematic sequences for content workflows.
---

# Video Generation Skill

AI-powered motion graphics and video content creation for marketing and content workflows.

## When to Use

Activate this skill when the task involves:
- Creating product animations or demos
- Generating social media video content
- Building motion graphics and transitions
- Producing explainer or tutorial videos
- Creating cinematic B-roll footage

## Capabilities

### 1. Product Animations
Generate product showcase videos:
- **Model**: Veo 3.1 (Google)
- **Duration**: Up to 60 seconds
- **Quality**: 1080p - 4K
- **Styles**: Studio, lifestyle, abstract

### 2. Social Media Videos
Create platform-optimized content:
- Instagram Reels (9:16)
- YouTube Shorts (9:16)
- TikTok videos (9:16)
- Facebook/LinkedIn (16:9, 1:1)

### 3. Motion Graphics
Generate animated design elements:
- Logo animations
- Title sequences
- Transitions and overlays
- Data visualizations

### 4. Cinematic Sequences
Produce high-quality video footage:
- B-roll footage
- Establishing shots
- Abstract backgrounds
- Ambient loops

## Execution Pattern

```text
1. BRIEF → Define video requirements and narrative
2. STORYBOARD → Plan shot sequence and timing
3. PROMPT → Craft generation prompts per shot
4. GENERATE → Execute video generation requests
5. ASSEMBLE → Sequence clips and add audio
6. POLISH → Apply color grading and effects
7. EXPORT → Deliver in required formats
```

## Video Brief Structure

```yaml
video:
  title: "Video Title"
  duration: "30 seconds"
  aspect_ratio: "9:16" | "16:9" | "1:1"
  style: "cinematic" | "corporate" | "playful" | "minimal"
  
shots:
  - shot_number: 1
    duration: "5s"
    description: "Establishing shot of modern office"
    movement: "slow pan right"
    mood: "professional, clean"
    
  - shot_number: 2
    duration: "8s"
    description: "Product close-up with hero lighting"
    movement: "slow zoom in"
    mood: "premium, aspirational"
    
audio:
  music: "upbeat corporate" | "ambient" | "none"
  voiceover: true | false
  sound_effects: ["whoosh", "click", "ambient"]
```

## Prompt Engineering

### Structure
```text
[Scene Description] + [Camera Movement] + [Lighting] + [Mood] + [Technical]
```

### Example Prompts

**Product Animation:**
```text
Smooth rotating view of sleek steam cleaner product,
studio lighting with soft shadows, white cyclorama background,
professional product photography style, 4K quality,
slow 360-degree rotation over 8 seconds
```

**Social Media Video:**
```text
Dynamic cleaning transformation video, before and after,
split-screen effect, vibrant colors, energetic pacing,
satisfying cleaning content, vertical 9:16 format,
upbeat and engaging mood
```

**Motion Graphic:**
```text
Smooth logo reveal animation, modern minimal style,
particles converging to form logo, dark background,
subtle glow effect, professional corporate feel,
3 second duration
```

## Output Format

```xml
<video_output>
  <metadata>
    <title>Video Title</title>
    <duration>30s</duration>
    <resolution>1920x1080</resolution>
    <fps>30</fps>
    <model>veo-3.1</model>
  </metadata>
  
  <files>
    <file format="mp4" codec="h264" size="final" path="..." />
    <file format="webm" size="web-optimized" path="..." />
    <file format="gif" size="preview" path="..." />
  </files>
  
  <shots>
    <shot number="1" start="0:00" end="0:05" path="..." />
    <shot number="2" start="0:05" end="0:13" path="..." />
  </shots>
  
  <audio>
    <track type="music" source="..." />
    <track type="voiceover" source="..." />
  </audio>
</video_output>
```

## Platform Specifications

| Platform | Ratio | Resolution | Duration |
|----------|-------|------------|----------|
| Instagram Reels | 9:16 | 1080x1920 | 15-90s |
| YouTube Shorts | 9:16 | 1080x1920 | Up to 60s |
| TikTok | 9:16 | 1080x1920 | 15-180s |
| YouTube | 16:9 | 1920x1080 | Any |
| LinkedIn | 16:9/1:1 | 1920x1080 | Up to 10min |

## Integration Points

- **Google Slides Storyboard**: Provides video embeds for presentations
- **Content Orchestrator**: Receives video generation requests
- **Social Commander**: Delivers platform-ready video content
- **Image Generation**: Source imagery for video sequences

## Quality Guidelines

### Camera Movements
- `static` - No movement
- `pan` - Horizontal sweep (left/right)
- `tilt` - Vertical sweep (up/down)
- `zoom` - In/out movement
- `dolly` - Forward/backward movement
- `orbit` - Circular movement around subject

### Lighting Styles
- `studio` - Professional controlled lighting
- `natural` - Daylight simulation
- `dramatic` - High contrast, moody
- `soft` - Even, diffused lighting
- `neon` - Colorful accent lighting

## Error Handling

| Error | Recovery |
|-------|----------|
| Generation timeout | Reduce complexity, retry |
| Low quality output | Enhance prompt specificity |
| Motion artifacts | Simplify camera movement |
| Audio sync issues | Regenerate with adjusted timing |

## Cost Considerations

- **Fuel Cost**: 20-80 PTS per video
- **Optimization**: 
  - Use shorter clips when possible
  - Batch similar style requests
  - Cache reusable motion graphics
  - Generate at 1080p, upscale if needed
