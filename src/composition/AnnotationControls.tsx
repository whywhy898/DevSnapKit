import type { CompositionDocument } from './types';
import './annotations.css';
import { ANNOTATION_COLORS, ANNOTATION_WIDTHS, isAnnotation, styleAnnotation, deleteAnnotation } from './annotations';

export function AnnotationControls({ document: doc, selected, onChange, onFinish }: {
  document: CompositionDocument; selected: string; onChange: (doc: CompositionDocument) => void; onFinish: () => void;
}) {
  const node = doc.objects.find(item => item.id === selected);
  if (!isAnnotation(node)) return null;
  const change = (patch: Parameters<typeof styleAnnotation>[2]) => { onFinish(); onChange(styleAnnotation(doc, selected, patch)); };
  return <section data-annotation-controls className="annotation-controls">
    <h3>{node.name}</h3>
    <fieldset><legend>Color</legend><div className="annotation-options">
      {ANNOTATION_COLORS.map((color, index) => <button key={color} type="button" aria-label={`Annotation color ${['red', 'yellow', 'green', 'blue', 'white'][index]}`} aria-pressed={(node.annotation === 'highlight' ? node.fill : node.stroke) === color} onClick={() => change({ color })}><span className="annotation-swatch" style={{ backgroundColor: color }} />{['Red', 'Yellow', 'Green', 'Blue', 'White'][index]}</button>)}
    </div></fieldset>
    <fieldset><legend>Stroke width</legend><div className="annotation-options">
      {(Object.keys(ANNOTATION_WIDTHS) as (keyof typeof ANNOTATION_WIDTHS)[]).map(width => <button key={width} type="button" aria-label={`Annotation width ${width}`} aria-pressed={node.strokeWidth === ANNOTATION_WIDTHS[width]} onClick={() => change({ width })}>{width[0].toUpperCase() + width.slice(1)}</button>)}
    </div></fieldset>
    {node.annotation === 'highlight' && <p>35% opacity. Stroke width applies to arrows and outlines.</p>}
    <p>{node.annotation === 'arrow' ? 'Drag the arrow to move it. Drag either endpoint to change its direction and size.' : 'Drag to move. Use the corner handle to resize.'}</p>
    <button type="button" className="annotation-delete" onClick={() => { onFinish(); onChange(deleteAnnotation(doc, selected)); }}>Delete annotation</button>
  </section>;
}
