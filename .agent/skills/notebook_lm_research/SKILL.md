---
name: notebook-lm-research
description: Performs deep document analysis and research synthesis using NotebookLM for long-context document grounding. Enables multi-source research aggregation, citation extraction, and knowledge synthesis for content creation workflows.
---

# NotebookLM Research Skill

Long-context document grounding and research synthesis capability powered by Google NotebookLM.

## When to Use

Activate this skill when the task involves:
- Deep document analysis (PDFs, articles, reports)
- Multi-source research synthesis
- Citation extraction and verification
- Knowledge base building for content creation
- Literature review and summarization

## Capabilities

### 1. Document Ingestion
Upload and process documents for analysis:
- **Formats**: PDF, Google Docs, web pages, text files
- **Capacity**: Up to 50 sources per notebook
- **Context**: 1M+ token window for comprehensive analysis

### 2. Research Synthesis
Extract and synthesize information:
- Key themes and patterns
- Contradictions and gaps
- Citation mapping
- Expert quotes and statistics

### 3. Query-Based Analysis
Answer specific research questions:
- Fact verification
- Comparative analysis
- Timeline construction
- Entity relationship mapping

## Execution Pattern

```text
1. INGEST → Add source documents to NotebookLM notebook
2. ANALYZE → Run initial summary and theme extraction
3. QUERY → Execute targeted research questions
4. SYNTHESIZE → Aggregate findings into structured output
5. CITE → Generate citation references for all claims
```

## Output Format

Research outputs should follow this structure:

```xml
<research_output>
  <executive_summary>
    <!-- 2-3 paragraph overview -->
  </executive_summary>
  
  <key_findings>
    <finding source="[citation]" confidence="high|medium|low">
      <!-- Specific insight -->
    </finding>
  </key_findings>
  
  <themes>
    <theme name="Theme Name">
      <description><!-- Pattern description --></description>
      <sources><!-- List of supporting sources --></sources>
    </theme>
  </themes>
  
  <citations>
    <citation id="1" source="..." page="..." quote="..." />
  </citations>
</research_output>
```

## Integration Points

- **Content Orchestrator**: Primary consumer for content creation workflows
- **Google Slides Storyboard**: Feeds research into presentation narratives
- **GEO Marketing Agent**: Provides citation vectors for authority scoring

## Best Practices

1. **Source Quality**: Prioritize authoritative sources (academic, official, expert)
2. **Citation Precision**: Always include page numbers and direct quotes
3. **Bias Detection**: Flag potential biases in source materials
4. **Freshness**: Note publication dates for time-sensitive topics

## Error Handling

| Error | Recovery |
|-------|----------|
| Document upload fails | Retry with smaller chunks or alternative format |
| Context limit exceeded | Prioritize most relevant sources |
| No relevant findings | Expand search scope or reformulate queries |

## Cost Considerations

- **Fuel Cost**: 10-30 PTS per research session
- **Optimization**: Cache frequently accessed research for reuse
