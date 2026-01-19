---
description: How to use the Content Orchestrator agent to create presentations and content
---

# Content Orchestrator Workflow

This workflow guides you through using the Content Orchestrator agent to create presentations, research reports, and content deliverables.

## Prerequisites

Ensure the following are properly installed:
- `.agent/agents/content_orchestrator/AGENT.md` exists
- All bound skills are present in `.agent/skills/`:
  - `notebook_lm_research/SKILL.md`
  - `google_slides_storyboard/SKILL.md`
  - `image_generation/SKILL.md`
  - `video_generation/SKILL.md`

## Workflow: Research-to-Presentation

### 1. Define Your Content Brief
Provide a clear content brief with:
- **Topic**: What subject to research and present
- **Audience**: Who will consume this content
- **Format**: Presentation, report, or brief
- **Slide Count**: Target number of slides (if presentation)
- **Style**: Visual style preference (modern-dark, corporate-light, etc.)

### 2. Invoke the Content Orchestrator
Request the agent with your brief:
```
Create a [X]-slide presentation about [TOPIC] for [AUDIENCE].
Include research from [SOURCES] and use [STYLE] visual theme.
```

### 3. Review Planning Phase Output
// turbo
The agent will present:
- Proposed structure and outline
- Research sources identified
- Estimated fuel cost
- Asset requirements

Approve or request modifications before execution.

### 4. Monitor Execution Phase
The agent will:
- Activate `notebook_lm_research` for document analysis
- Activate `google_slides_storyboard` for presentation creation
- Activate `image_generation` for visual assets
- Activate `video_generation` if video content needed

### 5. Verify and Accept Deliverables
Review the completed output:
- Check content accuracy
- Verify citations
- Confirm visual quality
- Request refinements if needed

### 6. Export Final Deliverables
Receive:
- Google Slides link
- PDF export
- Research notes (if applicable)
- Asset library

## Example Commands

### Quick Presentation
```
@content-orchestrator Create a 10-slide executive summary about Q4 marketing results.
```

### Research Report
```
@content-orchestrator Generate a research report on AI trends in cleaning industry 2026.
Include citations from industry publications.
```

### Video Storyboard
```
@content-orchestrator Create a 60-second video storyboard for Instagram Reels 
showcasing our new product line.
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent not responding | Verify AGENT.md is properly formatted |
| Skills not activating | Check skill paths in AGENTS.md |
| Research fails | Provide alternative sources or URLs |
| Asset generation slow | Reduce asset complexity or count |

## Cost Guidelines

| Task Type | Estimated Fuel |
|-----------|----------------|
| 10-slide presentation | 50-80 PTS |
| Research report | 30-50 PTS |
| Full campaign brief | 100-150 PTS |
| Video storyboard | 150-300 PTS |
