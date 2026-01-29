---
name: image-generation
description: Creates visual assets using AI image generation models (Imagen 3, DALL-E). Supports product renders, marketing imagery, infographics, and creative visuals for content and presentation workflows.
---

# Image Generation Skill

AI-powered visual asset creation for content, marketing, and presentation workflows.

## When to Use

Activate this skill when the task involves:
- Creating product imagery or renders
- Generating marketing visuals
- Building infographics and diagrams
- Creating presentation assets
- Producing social media graphics

## Capabilities

### 1. Photorealistic Renders
Generate high-fidelity product and scene imagery:
- **Model**: Imagen 3 (Google)
- **Resolution**: Up to 4K (4096x4096)
- **Styles**: Photorealistic, studio, lifestyle, editorial

### 2. Marketing Visuals
Create branded marketing assets:
- Social media graphics (1:1, 9:16, 16:9)
- Banner ads and hero images
- Email header graphics
- Campaign keyart

### 3. Infographics
Generate data-driven visuals:
- Process diagrams
- Comparison charts
- Timeline graphics
- Icon sets

### 4. Creative Concepts
Produce artistic and conceptual imagery:
- Abstract backgrounds
- Artistic illustrations
- Mood boards
- Style explorations

## Execution Pattern

```text
1. BRIEF → Define visual requirements and context
2. PROMPT → Craft detailed generation prompt
3. GENERATE → Execute image generation request
4. REVIEW → Evaluate output quality and accuracy
5. REFINE → Iterate with enhanced prompts if needed
6. DELIVER → Export in required formats and sizes
```

## Prompt Engineering

### Structure
```text
[Subject] + [Style] + [Composition] + [Lighting] + [Technical]
```

### Example Prompts

**Product Render:**
```text
Professional product photography of a modern steam cleaner,
studio lighting, white background, 45-degree angle,
high-key lighting, sharp focus, 8K resolution, commercial quality
```

**Marketing Visual:**
```text
Dynamic hero image for cleaning services website,
professional cleaner in action, modern office environment,
shallow depth of field, warm natural lighting,
contemporary style, aspirational mood
```

**Infographic Element:**
```text
Flat design icon set for cleaning industry,
minimalist style, consistent line weight,
cohesive color palette (blue, green, white),
vector-ready, transparent background
```

## Output Format

```xml
<image_output>
  <metadata>
    <prompt>Original generation prompt</prompt>
    <model>imagen-3</model>
    <resolution>2048x2048</resolution>
    <seed>12345</seed>
  </metadata>
  
  <files>
    <file format="png" size="original" path="..." />
    <file format="webp" size="web-optimized" path="..." />
    <file format="jpg" size="thumbnail" path="..." />
  </files>
  
  <variations>
    <variation id="1" prompt_modifier="..." path="..." />
  </variations>
</image_output>
```

## Aspect Ratios

| Ratio | Dimensions | Use Case |
|-------|------------|----------|
| 1:1 | 1024x1024 | Social media, thumbnails |
| 4:3 | 1024x768 | Presentations |
| 16:9 | 1920x1080 | Hero images, YouTube |
| 9:16 | 1080x1920 | Stories, shorts |
| 2:3 | 800x1200 | Pinterest, posters |

## Integration Points

- **Google Slides Storyboard**: Supplies presentation assets
- **Content Orchestrator**: Receives asset generation requests
- **Social Commander**: Provides social media graphics

## Quality Guidelines

### Do's
- Use specific, detailed prompts
- Include technical specifications
- Request multiple variations
- Specify lighting and composition

### Don'ts
- Avoid vague descriptions
- Don't request copyrighted elements
- Avoid text in images (use overlays instead)
- Don't exceed model capabilities

## Brand Consistency

When generating branded assets:
1. Reference brand color codes (hex values)
2. Specify typography style preferences
3. Include brand element descriptions
4. Maintain visual language consistency

## Error Handling

| Error | Recovery |
|-------|----------|
| Generation fails | Simplify prompt, retry |
| Low quality output | Enhance prompt specificity |
| Wrong style | Add explicit style modifiers |
| Policy rejection | Rephrase potentially flagged terms |

## Cost Considerations

- **Fuel Cost**: 5-20 PTS per generation
- **Optimization**: 
  - Batch similar requests
  - Cache reusable assets
  - Use lower resolution for drafts
