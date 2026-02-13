/**
 * SkipLink - Keyboard accessibility skip navigation
 *
 * Allows keyboard users to skip to main content.
 * Only visible when focused via Tab key.
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      Skip to main content
    </a>
  )
}
