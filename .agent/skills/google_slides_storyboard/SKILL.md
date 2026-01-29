---
name: google-slides-storyboard
description: Automates Google Slides presentation creation with storyboard-driven design. Generates professional slide decks from structured content, research findings, or narrative outlines using Google Slides API.
---

# Google Slides Storyboard Skill

Presentation automation and storyboard-driven slide deck generation for Google Slides.

## When to Use

Activate this skill when the task involves:
- Creating presentations from research or content
- Building pitch decks or proposal documents
- Generating visual storyboards for narratives
- Automating recurring presentation formats
- Converting documents to slide format

## Capabilities

### 1. Storyboard Generation
Convert narratives into visual slide sequences:
- Scene-by-scene breakdown
- Key message identification
- Visual cue suggestions
- Speaker notes generation

### 2. Slide Deck Creation
Generate complete presentations:
- Title slides with branding
- Content slides with layouts
- Data visualization slides
- Summary and CTA slides

### 3. Template Application
Apply consistent design systems:
- Brand color palettes
- Typography hierarchies
- Layout grids
- Animation patterns

### 4. Asset Integration
Incorporate visual elements:
- Generated images (via Imagen 3)
- Charts and graphs
- Icons and illustrations
- Video embeds

## Execution Pattern

```text
1. STRUCTURE → Define slide sequence and narrative arc
2. LAYOUT → Select templates and layouts per slide
3. CONTENT → Populate text, data, and placeholders
4. ASSETS → Generate or insert visual elements
5. POLISH → Apply animations and transitions
6. EXPORT → Deliver as Google Slides link or PDF
```

## Storyboard Input Format

```yaml
presentation:
  title: "Presentation Title"
  theme: "modern-dark" | "corporate-light" | "creative-vibrant"
  
slides:
  - type: title
    headline: "Main Title"
    subtitle: "Supporting tagline"
    
  - type: content
    headline: "Section Header"
    bullets:
      - "Key point 1"
      - "Key point 2"
    visual: "chart" | "image" | "icon-grid"
    
  - type: data
    headline: "Data Visualization"
    chart_type: "bar" | "line" | "pie" | "comparison"
    data_source: "inline" | "reference"
    
  - type: cta
    headline: "Call to Action"
    action: "Contact information or next steps"
```

## Output Format

```xml
<presentation_output>
  <metadata>
    <title>Presentation Title</title>
    <slide_count>12</slide_count>
    <google_slides_url>https://docs.google.com/presentation/d/...</google_slides_url>
    <pdf_export_url>...</pdf_export_url>
  </metadata>
  
  <slides>
    <slide number="1" type="title">
      <content_summary>...</content_summary>
      <speaker_notes>...</speaker_notes>
    </slide>
  </slides>
  
  <assets_used>
    <asset type="image" source="imagen-3" slide="3" />
  </assets_used>
</presentation_output>
```

## Integration Points

- **NotebookLM Research**: Receives research findings for content
- **Image Generation**: Requests visual assets for slides
- **Content Orchestrator**: Receives storyboard commands

## Slide Templates

| Template | Use Case |
|----------|----------|
| `title` | Opening and section dividers |
| `content-bullets` | Key points with bullets |
| `content-visual` | Text + image layout |
| `data-chart` | Charts and graphs |
| `comparison` | Side-by-side comparisons |
| `quote` | Featured quotes or testimonials |
| `cta` | Closing call-to-action |
| `blank` | Custom layouts |

## Best Practices

1. **Narrative Flow**: Ensure slides follow a logical story arc
2. **Visual Hierarchy**: One key message per slide
3. **Asset Quality**: Use high-resolution images (min 1920x1080)
4. **Accessibility**: Include alt text and readable fonts

## Error Handling

| Error | Recovery |
|-------|----------|
| API rate limit | Queue requests with exponential backoff |
| Asset generation fails | Use placeholder with manual note |
| Template mismatch | Fall back to default template |

## Cost Considerations

- **Fuel Cost**: 15-50 PTS per presentation
- **Optimization**: Reuse templates and cached assets
